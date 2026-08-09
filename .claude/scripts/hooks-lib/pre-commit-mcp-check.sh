#!/usr/bin/env bash
# pre-commit-mcp-check (vendor 版) — .mcp.json のトークン平文展開を検知して commit を止める。
#
# 正本は $HOME/dev/Claude/hooks-lib/pre-commit-mcp-check.sh（外部マシン資産）。本ファイルは
# hooks-lib が無い環境向けの最小再実装で、hooks/pre-commit-mcp-check.sh の fallback chain
# から呼ばれる。規約: .mcp.json のトークンは ${SUPABASE_ACCESS_TOKEN} 等の参照のまま維持・
# 平文展開禁止（CLAUDE.md §9 鉄則・2026-05-17 流出未遂）。
#
# PreToolUse(Bash) で毎回呼ばれるため、stdin の JSON が git commit / git add を含むとき
# だけ検査する（単体実行 = stdin なしのときは常に検査）。検知したら exit 2 でブロック。
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MCP_JSON="$REPO_ROOT/.mcp.json"

INPUT="$(cat 2>/dev/null || true)"
if [ -n "$INPUT" ] && ! printf '%s' "$INPUT" | grep -qE 'git (commit|add)'; then
  exit 0
fi
[ -f "$MCP_JSON" ] || exit 0

# ${...} 参照行は除外し、値の位置に生トークン様文字列（sbp_ / JWT / 40 桁以上 hex）が
# あれば検知する。
HITS="$(grep -nE '"[^"]*(sbp_[A-Za-z0-9]{16,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_.-]{10,}|[A-Fa-f0-9]{40,})[^"]*"' "$MCP_JSON" | grep -v '\${' || true)"
if [ -n "$HITS" ]; then
  echo "[pre-commit-mcp-check] BLOCKED: .mcp.json にトークン平文らしき値があります。\${ENV_VAR} 参照に戻してください:" >&2
  printf '%s\n' "$HITS" >&2
  exit 2
fi
exit 0
