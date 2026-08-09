#!/usr/bin/env bash
# regen-index (vendor 版) — memory/INDEX.md / history/INDEX.md の派生ビューを再生成する。
#
# 正本は $HOME/dev/Claude/hooks-lib/regen-index.sh（外部マシン資産）。本ファイルは
# hooks-lib が無い環境（remote / web セッション・新規クローン）向けの最小再実装で、
# hooks/regen-index.sh の fallback chain から呼ばれる。出力はどちらも git 非追跡の
# 派生ビュー（.gitignore 済み）なので、外部版との出力差異は無害。
#
# あわせて記録グラフ層の索引鮮度を warn-only で検査する（止めない）。
set -uo pipefail
CLAUDE_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

gen_memory_index() {
  local out="$CLAUDE_DIR/memory/INDEX.md"
  {
    echo "# MEMORY INDEX (auto-generated — vendor regen-index.sh)"
    echo
    echo "> git 非追跡の派生ビュー。SSOT は memory/chat-*.md（単一書込者）。手編集禁止。"
    echo
    echo "## 進行中 (across all chats)"
    echo
    for f in "$CLAUDE_DIR"/memory/chat-*.md; do
      [ -f "$f" ] || continue
      local name; name="$(basename "$f" .md)"
      awk -v chat="$name" '
        /^## 進行中/ { on=1; next }
        /^## / { on=0 }
        on && /^- / { printf "- [%s] %s\n", chat, substr($0, 3) }
      ' "$f"
    done
  } > "$out"
}

gen_history_index() {
  local out="$CLAUDE_DIR/history/INDEX.md"
  {
    echo "# HISTORY INDEX (auto-generated — vendor regen-index.sh)"
    echo
    echo "> git 非追跡の派生ビュー。SSOT は history/chat-*.md（直近分。それ以前は history/archive/YYYY-MM/）。手編集禁止。"
    echo
    echo "## 各チャットの最新エントリ"
    echo
    for f in "$CLAUDE_DIR"/history/chat-*.md; do
      [ -f "$f" ] || continue
      local name latest; name="$(basename "$f" .md)"
      latest="$(grep -m1 -E '^#{2,4} 20[0-9]{2}-[0-9]{2}-[0-9]{2}' "$f" | sed -E 's/^#+ //')"
      echo "- [$name] ${latest:-（日付見出しなし）}"
    done
  } > "$out"
}

gen_memory_index
gen_history_index

if command -v node >/dev/null 2>&1; then
  node "$CLAUDE_DIR/scripts/records.mjs" check >/dev/null 2>&1 ||
    echo "[regen-index] warn: records.mjs check が失敗（索引 stale か frontmatter 違反 — node .claude/scripts/records.mjs check で詳細）" >&2
fi
exit 0
