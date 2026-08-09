#!/usr/bin/env bash
#
# docs-lint — .claude ドキュメント整合の機械検査（#173 / docs-consistency-cleanup Phase 7）
#
# 検査項目:
#   (a) 相対リンク実在   : .claude/**/*.md の [..](target) が実在するか（#528 で docs/ 限定から拡大）
#   (b) 旧トークン名残存 : notion-* / ink-*（known-issues/ は凍結アーカイブのため除外、
#                          「旧称」「仮称」「retired」「旧トークン」の歴史注記行も除外）
#   (c) plans/ Status enum: Draft / IN PROGRESS / BLOCKED / COMPLETED / SUPERSEDED /
#                          DEFERRED / REFERENCE / ACTIVE (adopted policy) のみ許可
#   (d) 完了プラン残置   : Status: COMPLETED / SUPERSEDED のファイルが plans/ に残っていないか
#
# 実行: bash scripts/docs-lint.sh
#   - ローカル: リポジトリ内どこからでも可（git toplevel へ cd する）
#   - CI: .github/workflows/ci.yml の docs-lint ジョブが PR / main push で実行
# 違反は 1 行 1 件で報告し、1 件でもあれば exit 1。
#
# 規約の正本: .claude/rules/docs-consistency.md（enum 語彙・歴史注記の除外条件）

set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

FAIL=0
report() {
  printf '%s\n' "$1"
  FAIL=1
}

PLANS_DIR=".claude/docs/vision/plans"

# ---------------------------------------------------------------------------
# (a) 相対リンク実在チェック
#     対象: .claude/**/*.md 全部（#528 で docs/ 限定から拡大 — archive/ 移動時の
#           リンク切れを検出するため）
#     除外: http(s) / mailto / file: の絶対 URL、ページ内アンカー（#...）、
#           git 非追跡の派生ビュー（memory/INDEX.md / history/INDEX.md —
#           hooks/regen-index.sh が再生成するため CI の checkout には
#           存在しない。CLAUDE.md §9 参照。リンク元としても同様に除外）、
#           旧式 worktree 置き場（.claude/worktrees/ — 別 checkout の実体）
# ---------------------------------------------------------------------------
ALL_MD_FILES=$(find .claude -path '.claude/worktrees' -prune -o -name '*.md' -print | sort)
for f in ${ALL_MD_FILES}; do
  case "$f" in
    *memory/INDEX.md | *history/INDEX.md) continue ;; # derived views
  esac
  dir=$(dirname "$f")
  while IFS= read -r target; do
    [ -z "$target" ] && continue
    case "$target" in
      http://* | https://* | mailto:* | file:* | \#*) continue ;;
    esac
    path="${target%%#*}"
    [ -z "$path" ] && continue
    case "$path" in
      *memory/INDEX.md | *history/INDEX.md) continue ;; # derived views
    esac
    if [ ! -e "$dir/$path" ]; then
      report "docs-lint(a) broken link: $f -> $target"
    fi
  done < <(
    # コードフェンス（```...```）とインラインコード（`...`）はリンクとして扱わない
    # （sed / grep のコマンド例に ](...) 形が現れて誤検知するため — #528）
    awk '/^[[:space:]]*```/{fence=!fence; next} !fence' "$f" 2>/dev/null |
      sed 's/`[^`]*`//g' |
      grep -oE '\]\([^)]+\)' | sed -E 's/^\]\(//; s/\)$//'
  )
done

# ---------------------------------------------------------------------------
# (b) 旧トークン名（notion-* / ink-*）残存チェック
#     known-issues/ は凍結アーカイブ（旧トークン本文を意図して保持）のため除外。
#     歴史注記行（旧称 / 仮称 / retired / 旧トークン を含む行）も除外。
# ---------------------------------------------------------------------------
OLD_TOKEN_HITS=$(grep -rnE '\b(notion|ink)-[a-z0-9]' .claude/CLAUDE.md .claude/docs .claude/rules 2>/dev/null |
  grep -v '\.claude/docs/known-issues/' |
  grep -vE '旧称|仮称|retired|旧トークン' || true)
if [ -n "${OLD_TOKEN_HITS}" ]; then
  while IFS= read -r hit; do
    report "docs-lint(b) old token name: $hit"
  done <<<"${OLD_TOKEN_HITS}"
fi

# ---------------------------------------------------------------------------
# (c) plans/ frontmatter の Status enum 準拠チェック
#     enum 値の後ろには空白区切りの注記（— ... / # ... 等）を許可する。
# ---------------------------------------------------------------------------
STATUS_ENUM='Draft|IN PROGRESS|BLOCKED|COMPLETED|SUPERSEDED|DEFERRED|REFERENCE|ACTIVE \(adopted policy\)'
for f in "${PLANS_DIR}"/*.md; do
  status_line=$(grep -m1 -E '^Status:' "$f" || true)
  if [ -z "${status_line}" ]; then
    report "docs-lint(c) missing Status line: $f"
    continue
  fi
  if ! printf '%s' "${status_line}" | grep -qE "^Status:[[:space:]]*(${STATUS_ENUM})([[:space:]].*)?$"; then
    report "docs-lint(c) non-enum Status: $f: ${status_line}"
  fi
done

# ---------------------------------------------------------------------------
# (d) 完了プランの plans/ 残置検出（COMPLETED / SUPERSEDED は archive/ へ移動する規約）
# ---------------------------------------------------------------------------
for f in "${PLANS_DIR}"/*.md; do
  if grep -m1 -qE '^Status:[[:space:]]*(COMPLETED|SUPERSEDED)' "$f"; then
    report "docs-lint(d) completed plan left in plans/ (move to .claude/archive/): $f"
  fi
done

# ---------------------------------------------------------------------------
# (e) 記録グラフ層の検証（正本 = .claude/scripts/records.mjs）
#     decisions/ frontmatter スキーマ・supersede 双方向・ANSWERS 突合・
#     索引（.claude/INDEX.md / .claude/decisions/INDEX.md）の鮮度。
#     stale なら `node .claude/scripts/records.mjs index` で再生成して同一コミットへ。
# ---------------------------------------------------------------------------
if command -v node >/dev/null 2>&1; then
  RECORDS_OUT=$(node .claude/scripts/records.mjs check 2>&1) || while IFS= read -r line; do
    report "docs-lint(e) ${line}"
  done <<<"${RECORDS_OUT}"
else
  echo "docs-lint: warn — node が無いため (e) records check をスキップ" >&2
fi

if [ "${FAIL}" -ne 0 ]; then
  echo "docs-lint: FAILED（上記の違反を修正してください。規約 = .claude/rules/docs-consistency.md）"
  exit 1
fi
echo "docs-lint: OK"
