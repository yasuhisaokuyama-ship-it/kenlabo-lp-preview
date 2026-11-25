#!/usr/bin/env python3
"""PreToolUse(Bash) フック: 削除・取り消せない操作は必ず人間の確認を挟む。

動画の運用:「削除しようとする動きは全てフックスで制御。確認してOKなものだけ消す」
- rm / rmdir / unlink / shred / find -delete / git rm / git clean
- git reset --hard / git push --force / git branch -D / git checkout -- / git restore
を検出したら permissionDecision=ask で止める。
一時ディレクトリ（/tmp 配下）だけを対象にした rm は確認なしで通す。
"""
import json
import re
import shlex
import sys

PATTERNS = [
    (r"(^|[;&|(`\s])(sudo\s+)?(rm|rmdir|unlink|shred)\s", "ファイル削除"),
    (r"\bfind\b[^;&|]*\s-delete\b", "find -delete による削除"),
    (r"\bgit\s+(rm|clean)\b", "git による削除"),
    (r"\bgit\s+reset\s+[^;&|]*--hard\b", "git reset --hard（変更の破棄）"),
    (r"\bgit\s+push\b[^;&|]*(\s--force\b|\s-f\b|\s--force-with-lease\b)", "強制プッシュ"),
    (r"\bgit\s+branch\s+[^;&|]*-D\b", "ブランチ強制削除"),
    (r"\bgit\s+(checkout\s+--\s|restore\s)", "作業中の変更の破棄"),
]


def only_tmp_rm(cmd: str) -> bool:
    """コマンド全体が /tmp 配下だけを対象にした rm なら True。"""
    if re.search(r"[;&|`$()]", cmd):
        return False
    try:
        parts = shlex.split(cmd)
    except ValueError:
        return False
    if not parts or parts[0] not in ("rm", "rmdir"):
        return False
    targets = [p for p in parts[1:] if not p.startswith("-")]
    return bool(targets) and all(t.startswith("/tmp/") and ".." not in t for t in targets)


def main() -> None:
    data = json.load(sys.stdin)
    if data.get("tool_name") != "Bash":
        return
    cmd = (data.get("tool_input") or {}).get("command", "")
    if only_tmp_rm(cmd.strip()):
        return
    hits = [label for pat, label in PATTERNS if re.search(pat, cmd)]
    if not hits:
        return
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "ask",
            "permissionDecisionReason": "削除ガード: " + " / ".join(dict.fromkeys(hits))
            + " を検出しました。対象を確認してから許可してください。",
        }
    }, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"guard_delete hook error: {e}", file=sys.stderr)
    sys.exit(0)
