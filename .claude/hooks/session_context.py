#!/usr/bin/env python3
"""SessionStart フック: 保管庫（vault）の直近の記録をセッション冒頭で Claude に読ませる。

「AI は記憶を持っていない。毎回1から読んでいるだけ」→ だから読むべきものを毎回渡す。
- 最新の整形済みデイリーノート（2件）
- 決定ログの一覧
- プロジェクトノートの「未完了」
標準出力に出したテキストがセッションのコンテキストに追加される。
"""
import glob
import os
import re
import sys

LIMIT = 2500


def tail(path: str, limit: int = LIMIT) -> str:
    with open(path, encoding="utf-8") as f:
        text = f.read().strip()
    return text if len(text) <= limit else "…（前略）\n" + text[-limit:]


def section(path: str, heading: str) -> str:
    with open(path, encoding="utf-8") as f:
        text = f.read()
    m = re.search(rf"^## {re.escape(heading)}.*?(?=^## |\Z)", text, flags=re.S | re.M)
    return m.group(0).strip() if m else ""


def main() -> None:
    root = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    vault = os.path.join(root, "vault")
    if not os.path.isdir(vault):
        return
    out = ["# vault（第二の脳）からの引き継ぎ — 詳細は vault/ を読むこと"]

    dailies = sorted(p for p in glob.glob(os.path.join(vault, "daily", "*.md"))
                     if re.search(r"\d{4}-\d{2}-\d{2}\.md$", p))
    for p in dailies[-2:]:
        out.append(f"\n## 直近のデイリーノート: {os.path.basename(p)}\n" + tail(p))

    raws = sorted(glob.glob(os.path.join(vault, "daily", "_raw", "*.md")))
    pending = [os.path.basename(p) for p in raws
               if not os.path.exists(os.path.join(vault, "daily", os.path.basename(p)))]
    if pending:
        out.append("\n## 未整形の生ログあり: " + ", ".join(pending)
                   + " → CLAUDE.md の手順でデイリーノートに整形すること")

    dec = os.path.join(vault, "decisions", "README.md")
    if os.path.exists(dec):
        out.append("\n## 決定ログ一覧\n" + tail(dec, 1500))

    for p in sorted(glob.glob(os.path.join(vault, "projects", "*.md"))):
        todo = section(p, "未完了")
        if todo:
            out.append(f"\n## {os.path.basename(p)} の未完了\n" + todo[:1500])

    print("\n".join(out))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"session_context hook error: {e}", file=sys.stderr)
    sys.exit(0)
