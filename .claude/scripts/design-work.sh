#!/usr/bin/env bash
# design-work.sh — ClaudeDesign fan-out 作業セッションの worktree を規約どおり用意する。
# usage: bash .claude/scripts/design-work.sh <work-slug>
# 例:    bash .claude/scripts/design-work.sh design-materials-v2
# 有効な slug と各オーダーの内容は
# .claude/docs/vision/plans/2026-07-04-claudedesign-screen-design-fanout.md の Work Orders 節が正本。
set -euo pipefail

PLAN=".claude/docs/vision/plans/2026-07-04-claudedesign-screen-design-fanout.md"
VALID="design-schedule-v2 design-materials-v2 design-connect-v2 design-work-v2 design-analytics-v2 design-settings-v2 design-shell design-auth design-trash docs-terminal-retire"

SLUG="${1:-}"
ok=0
for v in $VALID; do [[ "$v" == "$SLUG" ]] && ok=1; done
if [[ "$ok" != 1 ]]; then
  echo "usage: bash .claude/scripts/design-work.sh <work-slug>" >&2
  echo "valid slugs:" >&2
  for v in $VALID; do echo "  $v" >&2; done
  exit 1
fi

# どの worktree から実行されてもメインリポジトリを起点にする
GIT_COMMON="$(git rev-parse --path-format=absolute --git-common-dir)"
ROOT="$(dirname "$GIT_COMMON")"
WT="$ROOT/.claude/worktrees/$SLUG"
BRANCH="claude/$SLUG"

if [[ -e "$WT" ]]; then
  echo "error: worktree already exists: $WT" >&2
  exit 1
fi

git -C "$ROOT" fetch origin main
git -C "$ROOT" worktree add "$WT" -b "$BRANCH" origin/main
echo "$BRANCH" > "$WT/.claude/comm/.session-branch"
echo "$SLUG" > "$WT/.claude/comm/.session-name"

echo
echo "worktree ready: $WT"
echo "branch        : $BRANCH (base: origin/main)"
echo "session-name  : $SLUG"
echo
echo "次を実行してください:"
echo "  cd $WT && claude"
echo
echo "起動後、最初のメッセージにこの 1 行を貼り付け:"
echo "  計画書 $PLAN の作業オーダー $SLUG をゴールまで実行してください。"
