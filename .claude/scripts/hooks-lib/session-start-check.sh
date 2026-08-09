#!/usr/bin/env bash
# session-start-check (vendor 版) — .session-name / .session-branch の宣言整合を検査する。
#
# 正本は $HOME/dev/Claude/hooks-lib/session-start-check.sh（外部マシン資産）。本ファイルは
# hooks-lib が無い環境（remote / web セッション・新規クローン）向けの最小再実装で、
# hooks/session-start-check.sh の fallback chain から呼ばれる。
#
# informational only — 警告を出すだけでセッションは止めない（常に exit 0）。
# 外部版との差（意図的に落とした検査）:
#   - D: .session-name の mtime が HEAD commit より 3 日以上古い（stat の方言差が大きい）
#   - E: worktree の 24h 以上 dirty 放置（worktree はリポジトリ外へ移ったため列挙が別実装になる）
#   - outbox への追記（vendor は副作用を持たず stdout の警告行だけを出す）
# 残す検査は A（未宣言）/ B（chat- プレフィックス）/ C（不正文字）/ F（branch 不一致）。
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "${CLAUDE_PROJECT_DIR:-$PWD}")"

# per-chat 機構が無いプロジェクトでは何もしない
[ -d "$ROOT/.claude/memory" ] || exit 0

NAME="$(tr -d '[:space:]' < "$ROOT/.claude/comm/.session-name" 2>/dev/null || true)"
WARN=()

if [ -z "$NAME" ]; then
  WARN+=("A: .session-name が未宣言 — echo <name> > .claude/comm/.session-name で宣言してください")
elif [ "${NAME#chat-}" != "$NAME" ]; then
  WARN+=("B: chat- プレフィックスは不要（現在値 '$NAME'）— ファイル名側で chat- が付きます")
elif ! printf '%s' "$NAME" | grep -qE '^[A-Za-z0-9_-]+$'; then
  WARN+=("C: .session-name に使えない文字（現在値 '$NAME'）— 英数字 / ハイフン / アンダースコアのみ")
fi

BRANCH_FILE="$ROOT/.claude/comm/.session-branch"
if [ -f "$BRANCH_FILE" ]; then
  DECLARED="$(tr -d '[:space:]' < "$BRANCH_FILE" 2>/dev/null || true)"
  CURRENT="$(git -C "$ROOT" branch --show-current 2>/dev/null || true)"
  if [ -n "$DECLARED" ] && [ -n "$CURRENT" ] && [ "$DECLARED" != "$CURRENT" ]; then
    WARN+=("F: .session-branch ('$DECLARED') と現在の branch ('$CURRENT') が不一致 — worktree-policy 違反の可能性。ブランチを切り替えたら .session-branch も書き換えてください")
  fi
fi

if [ "${#WARN[@]}" -eq 0 ]; then
  exit 0
fi
printf '[session-start-check] %s\n' "${WARN[@]}"
exit 0
