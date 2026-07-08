#!/usr/bin/env bash
# impl-work.sh — 生成デザイン実装 fan-out の作業オーダー起動スクリプト
#
# Usage: bash .claude/scripts/impl-work.sh <slug>
#   slug は計画書の §作業レジストリ に載っているもののみ有効
#   （whitelist は計画書のレジストリ表を grep — 二重管理しない）
#
# やること: fetch → worktree + branch 作成 → .session-branch / .session-name 書き込み
# その後の手順（cd → claude → 1 行プロンプト）を echo する。
set -euo pipefail

PLAN_REL=".claude/docs/vision/plans/2026-07-05-design-implementation-fanout.md"
SLUG="${1:?usage: bash .claude/scripts/impl-work.sh <slug>}"

GIT_COMMON_DIR=$(git rev-parse --path-format=absolute --git-common-dir)
ROOT=$(dirname "$GIT_COMMON_DIR")
PLAN="$ROOT/$PLAN_REL"

if [ ! -f "$PLAN" ]; then
  echo "ERROR: plan not found: $PLAN" >&2
  exit 1
fi

# レジストリ表の行（| `slug` | ...）に slug が存在するか
if ! grep -qE "^\|[[:space:]]*\`${SLUG}\`[[:space:]]*\|" "$PLAN"; then
  echo "ERROR: slug '$SLUG' is not in the registry of $PLAN_REL" >&2
  echo "valid slugs:" >&2
  grep -oE "^\|[[:space:]]*\`[a-z-]+\`" "$PLAN" | tr -d '|` ' | sed 's/^/  - /' >&2
  exit 1
fi

BRANCH="claude/$SLUG"
WT="$ROOT/.claude/worktrees/$SLUG"

if [ -e "$WT" ]; then
  echo "ERROR: worktree already exists: $WT" >&2
  exit 1
fi

git -C "$ROOT" fetch origin main
git -C "$ROOT" worktree add "$WT" -b "$BRANCH" origin/main
echo "$BRANCH" > "$WT/.claude/comm/.session-branch"
echo "$SLUG" > "$WT/.claude/comm/.session-name"

echo ""
echo "worktree ready: $WT [$BRANCH]"
echo ""
echo "next steps:"
echo "  cd $WT && claude"
echo ""
echo "first message (1 行。import URL はレジストリ未登録なら末尾に添える):"
echo "  計画書 $PLAN_REL の作業オーダー $SLUG をゴールまで実行してください。"
