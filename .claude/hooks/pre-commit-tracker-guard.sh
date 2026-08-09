#!/usr/bin/env bash
# pre-commit-tracker-guard — tracker（memory/ + history/ の chat-*.md）を実装コミットに
# 混ぜるのを止める（D-20260801-main-1 / CLAUDE.md §7.4 / worktree-policy）。
#
# life-editor 固有の規約なので外部 hooks-lib には無く、ここが実体（ラッパではない）。
#
# 何を止めるか: 1 つの commit に「tracker の追加 / 更新」と「それ以外のファイル」が
# 同居している状態。並行ブランチが同じ位置へ別々に追記するため必ず衝突する（2026-08-01 に
# schedule-refine の 4 ブランチが全滅し、1 本 merge するたび次が再衝突した実測）。
#
# 通すもの:
#   - tracker だけの commit（merge 後にまとめる 1 commit — 規約が求めている形）
#   - tracker の削除だけを含む commit（休眠レーンの退役 sweep。追記ではないので衝突しない）
#   - コマンドに [tracker-ok] を含む commit（誤検知時の逃がし道）
set -uo pipefail

INPUT="$(cat 2>/dev/null || true)"
if command -v node >/dev/null 2>&1; then
  COMMAND="$(printf '%s' "$INPUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).tool_input?.command??""))}catch{process.stdout.write("")}})' 2>/dev/null || true)"
else
  COMMAND="$INPUT"
fi

printf '%s' "$COMMAND" | grep -qE '(^|;|&&|\|\|)[[:space:]]*git[[:space:]]+commit([[:space:]]|$)' || exit 0
printf '%s' "$COMMAND" | grep -q '\[tracker-ok\]' && exit 0

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STAGED="$(git -C "$REPO_ROOT" diff --cached --name-status 2>/dev/null || true)"
[ -n "$STAGED" ] || exit 0

TRACKER_RE='\.claude/(memory|history)/chat-[^/]*\.md$'
# 追加 / 更新された tracker（削除 = D は対象外）
TRACKER_TOUCHED="$(printf '%s\n' "$STAGED" | grep -E "^[AMR][0-9]*[[:space:]]" | grep -E "$TRACKER_RE" || true)"
# tracker 以外に staged されているもの
OTHERS="$(printf '%s\n' "$STAGED" | grep -vE "$TRACKER_RE" || true)"

if [ -n "$TRACKER_TOUCHED" ] && [ -n "$OTHERS" ]; then
  {
    echo "[pre-commit-tracker-guard] BLOCKED: tracker の更新を実装コミットに混ぜています（D-20260801-main-1）。"
    echo "  混ざっている tracker:"
    printf '%s\n' "$TRACKER_TOUCHED" | sed 's/^/    /'
    echo "  対処: tracker を unstage して実装だけを commit し、tracker は merge 後に 1 commit でまとめてください。"
    echo "        git restore --staged .claude/memory/chat-*.md .claude/history/chat-*.md"
    echo "  意図的に同梱する場合はコマンドに [tracker-ok] を含めてください。"
  } >&2
  exit 2
fi
exit 0
