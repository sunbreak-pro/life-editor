#!/usr/bin/env bash
# pre-commit-index-guard (vendor 版) — 派生 INDEX の commit 混入を自動で外す。
#
# 正本は $HOME/dev/Claude/hooks-lib/pre-commit-index-guard.sh（外部マシン資産）。本ファイルは
# hooks-lib が無い環境向けの最小再実装で、hooks/pre-commit-index-guard.sh の fallback chain
# から呼ばれる。
#
# 対象は memory/INDEX.md と history/INDEX.md の 2 本だけ（どちらも .gitignore 済みの派生
# ビュー・SSOT は chat-*.md）。git 追跡している .claude/INDEX.md と
# .claude/decisions/INDEX.md は records.mjs の生成物で commit されるべきものなので、
# 対象に含めない（2026-08-09 実測で外部版も同じ 2 本限定と確認済み）。
#
# 方針は AUTO-FIX（ブロックしない）: staged に残っていたら git rm --cached で外すだけ。
# 作業ファイルには触らない（regen-index.sh が作り直す）。
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TARGETS=(".claude/memory/INDEX.md" ".claude/history/INDEX.md")

INPUT="$(cat 2>/dev/null || true)"
if command -v node >/dev/null 2>&1; then
  COMMAND="$(printf '%s' "$INPUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).tool_input?.command??""))}catch{process.stdout.write("")}})' 2>/dev/null || true)"
else
  COMMAND="$INPUT" # node が無ければ stdin 全体を対象に判定する（誤検知しても auto-fix は無害）
fi

# git commit の呼び出しにだけ反応する（単体実行 = stdin なしのときも検査する）
if [ -n "$INPUT" ] && ! printf '%s' "$COMMAND" | grep -qE '(^|;|&&|\|\|)[[:space:]]*git[[:space:]]+commit([[:space:]]|$)'; then
  exit 0
fi

TRACKED="$(git -C "$REPO_ROOT" ls-files -- "${TARGETS[@]}" 2>/dev/null || true)"
if [ -n "$TRACKED" ]; then
  git -C "$REPO_ROOT" rm --cached --quiet --ignore-unmatch -- "${TARGETS[@]}" >/dev/null 2>&1 || true
  {
    echo "[pre-commit-index-guard] NOTE: git 非追跡の派生 INDEX を staged から自動で外しました:"
    printf '    %s\n' $TRACKED
    echo "  作業ファイルは残っています（regen-index.sh が作り直します）。SSOT は chat-*.md 側です。"
  } >&2
fi
exit 0
