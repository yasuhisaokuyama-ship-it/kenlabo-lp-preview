#!/usr/bin/env python3
"""Stop フック: Claude Code との会話を vault/daily/_raw/YYYY-MM-DD.md に自動追記する。

- 会話ログ（transcript JSONL）のうち、前回処理以降の新しい行だけを読む
- ユーザー発言・Claude の返答テキスト・変更したファイル・使ったツールを記録
- 生ログは「汚くても入っていればいい」。整形は CLAUDE.md のルールに従い daily ノートへ
- 失敗しても会話を止めないよう、例外はすべて握りつぶして exit 0
"""
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone

JST = timezone(timedelta(hours=9))
USER_MAX = 800
ASSISTANT_MAX = 1500


def clean(text: str) -> str:
    text = re.sub(r"<system-reminder>.*?</system-reminder>", "", text, flags=re.S)
    text = re.sub(r"<(command-[a-z-]+|local-command-[a-z-]+)>.*?</\1>", "", text, flags=re.S)
    return text.strip()


def cut(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + f"…（以下 {len(text) - limit} 文字省略）"


def quote(text: str) -> str:
    return "\n".join("> " + line if line else ">" for line in text.splitlines())


def main() -> None:
    data = json.load(sys.stdin)
    transcript = data.get("transcript_path")
    session_id = data.get("session_id", "unknown")
    project = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()
    if not transcript or not os.path.exists(transcript):
        return

    state_dir = os.path.join(project, ".claude", "hooks", ".state")
    os.makedirs(state_dir, exist_ok=True)
    state_file = os.path.join(state_dir, f"{session_id}.json")
    done = 0
    if os.path.exists(state_file):
        with open(state_file, encoding="utf-8") as f:
            done = json.load(f).get("lines", 0)

    with open(transcript, encoding="utf-8") as f:
        lines = f.readlines()
    new = lines[done:]
    if not new:
        return

    entries, tools, files = [], {}, []
    for raw in new:
        try:
            ev = json.loads(raw)
        except ValueError:
            continue
        if ev.get("isMeta") or ev.get("isSidechain"):
            continue
        msg = ev.get("message") or {}
        content = msg.get("content")
        if ev.get("type") == "user":
            if isinstance(content, str):
                t = clean(content)
            elif isinstance(content, list):
                t = clean("\n".join(c.get("text", "") for c in content
                                    if isinstance(c, dict) and c.get("type") == "text"))
            else:
                t = ""
            if t:
                entries.append(("user", cut(t, USER_MAX)))
        elif ev.get("type") == "assistant" and isinstance(content, list):
            for c in content:
                if not isinstance(c, dict):
                    continue
                if c.get("type") == "text" and c.get("text", "").strip():
                    entries.append(("assistant", cut(c["text"].strip(), ASSISTANT_MAX)))
                elif c.get("type") == "tool_use":
                    name = c.get("name", "?")
                    tools[name] = tools.get(name, 0) + 1
                    fp = (c.get("input") or {}).get("file_path")
                    if name in ("Edit", "Write", "NotebookEdit") and fp:
                        rel = os.path.relpath(fp, project) if fp.startswith(project) else fp
                        if rel not in files:
                            files.append(rel)

    if entries or tools:
        now = datetime.now(JST)
        out_dir = os.path.join(project, "vault", "daily", "_raw")
        os.makedirs(out_dir, exist_ok=True)
        path = os.path.join(out_dir, now.strftime("%Y-%m-%d") + ".md")
        block = [f"\n### {now:%H:%M} セッション `{session_id[:8]}`\n"]
        for role, text in entries:
            block.append(("**👤 依頼**\n" if role == "user" else "**🤖 Claude**\n") + quote(text) + "\n")
        if files:
            block.append("**変更ファイル**: " + ", ".join(f"`{p}`" for p in files) + "\n")
        if tools:
            block.append("**ツール**: " + ", ".join(f"{k}×{v}" for k, v in sorted(tools.items())) + "\n")
        new_file = not os.path.exists(path)
        with open(path, "a", encoding="utf-8") as f:
            if new_file:
                f.write(f"# {now:%Y-%m-%d} 生ログ（自動記録・未整形）\n\n"
                        "> このファイルは Stop フックが自動で追記します。コミットしません（.gitignore）。\n"
                        f"> 整形版: [[{now:%Y-%m-%d}]]\n")
            f.write("\n".join(block))

    with open(state_file, "w", encoding="utf-8") as f:
        json.dump({"lines": len(lines)}, f)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # 会話は絶対に止めない
        print(f"daily_log hook error: {e}", file=sys.stderr)
    sys.exit(0)
