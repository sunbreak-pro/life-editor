#!/usr/bin/env bash
#
# Stop hook: 後追い検証（バックグラウンド実行・即 exit）
#
# 目的:
#   - Claude が応答を終えた時点で shared/ または web/ に変更があれば web の
#     npm run build（tsc -b --force + vite build — shared も型検証される）を
#     裏で走らせ、型エラーがあれば .claude/comm/outbox/<chat>/stop-report.md に追記する
#   - 同期ブロックは避ける（ユーザー待ち時間 0）。結果は outbox を見るか、
#     次ターンで Claude に「stop-report 見せて」と頼んで参照
#
# 実装メモ:
#   - subshell + & + disown でバックグラウンド化
#   - hook 自体は即 exit 0 で Claude のフローを止めない
#   - scope drift 検出は v2（まずは型エラーだけ拾う）
#
# 起動条件:
#   .claude/settings.json の hooks.Stop に登録される
#

set -uo pipefail

# settings.json invokes this as ${CLAUDE_PROJECT_DIR}/.claude/hooks/stop-check.sh,
# so the env var is set per-worktree; the fallback derives the repo root from the
# script location for manual runs.
ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
CHAT=$(cat "${ROOT}/.claude/comm/.session-name" 2>/dev/null | tr -d '[:space:]' || true)
[ -z "${CHAT}" ] && CHAT="unknown"

OUTBOX="${ROOT}/.claude/comm/outbox/${CHAT}"
mkdir -p "${OUTBOX}"
REPORT="${OUTBOX}/stop-report.md"

# 変更ファイル取得（staged + unstaged）
CHANGED=$(git -C "${ROOT}" diff --name-only HEAD 2>/dev/null | grep -E '^(shared|web)/' | head -10)

if [ -z "${CHANGED}" ]; then
  exit 0  # shared/web に変更なし → 何もしない
fi

# バックグラウンドで build を走らせ、結果を outbox に追記
(
  cd "${ROOT}/web" || exit 0
  TS=$(date '+%Y-%m-%d %H:%M:%S')
  CHANGED_LINE=$(echo "${CHANGED}" | tr '\n' ' ')

  if BUILD_OUT=$(npm run build 2>&1); then
    {
      printf '\n## %s  build OK\n' "${TS}"
      printf '- changed: %s\n' "${CHANGED_LINE}"
    } >> "${REPORT}"
  else
    {
      printf '\n## %s  build FAILED\n' "${TS}"
      printf '- changed: %s\n\n' "${CHANGED_LINE}"
      printf '```\n'
      echo "${BUILD_OUT}" | tail -60
      printf '```\n'
    } >> "${REPORT}"
  fi
) >/dev/null 2>&1 &
disown

exit 0
