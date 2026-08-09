# 030: PostToolUse formatter が frontmatter の長い配列を折り返し、行単位パーサが読めなくなる

**Status**: Fixed
**Category**: Tooling
**Severity**: Important
**Discovered**: 2026-08-09
**Resolved**: 2026-08-09

## Symptom

`.claude/decisions/D-*.md` を Write で新規作成した直後、PostToolUse hook が「likely a formatter」の通知を出す。その後 `node .claude/scripts/records.mjs check` が落ちる:

```
records: decisions/D-20260607-main-1.md: refs は配列にする
records: decisions/D-20260704-main-1.md: refs は配列にする
records: decisions/D-20260705-main-1.md: refs は配列にする
records: decisions/D-20260807-main-1.md: refs は配列にする
```

該当ファイルを開くと、書いたときは 1 行だった配列が複数行へ折り返されている:

```text
# 書いた形（1 行）
refs: ["archive/2026-06-07-web-desktop-parity-roadmap.md", "docs/vision/coding-principles.md §6", "#154", "#197"]

# formatter 通過後
refs:
  [
    "archive/2026-06-07-web-desktop-parity-roadmap.md",
    "docs/vision/coding-principles.md §6",
    "#154",
    "#197",
  ]
```

> このコードブロックを最初 ` ```yaml ` で囲んだところ、**formatter が「書いた形」のサンプルまで折り返して before / after が同一になった**（本 known-issue の症状そのもの）。整形されたくないサンプルは ` ```text ` で囲む。

同時に作った 7 本のうち、`refs` 行が 80 桁を超えた 4 本だけが該当した。

## Root Cause

formatter（prettier 系）は 80 桁を超える YAML の flow 配列を複数行へ展開する。一方 `records.mjs` の frontmatter パーサは **行単位** で `key: value` を読み、値が `[` で始まるときだけ配列として解釈していた。折り返された配列は「値が空の `refs:`」と読まれるため、配列判定に落ちて `refs は配列にする` を出す。

**80 桁を超えたときだけ**壊れるため、既存の D ファイル（`refs` が短い）では一度も表面化していなかった。

## Fix

`records.mjs` の `parseFrontmatter` に、折り返された配列を 1 行へ畳む前処理を入れた（`.claude/scripts/records.mjs` の `parseFrontmatter`）。書き手は 1 行でも複数行でも書けるようになり、formatter に触られても `check` が落ちない。

## Lessons Learned

- **PostToolUse formatter は Markdown 本文だけでなく frontmatter も書き換える**（026 は見出し消失・本件は YAML 配列の折り返し）。`.claude/` を機械で読むスクリプトは「書いたままの形が保たれる」前提を置かない
- **境界を跨いだときだけ壊れる**類の不具合は、既存データが全部その手前にあると通ってしまう。パーサを書いたら「formatter を通した後の形」でも読めるかを確認する
- 検索キーワード: formatter, prettier, frontmatter, YAML 配列, 折り返し, records.mjs, refs は配列にする

## References

- 関連: [026](./026-posttooluse-formatter-deletes-adjacent-heading.md)（同じ PostToolUse formatter の別症状 = 見出し消失。追跡は GitHub #119）
- 設計の正本: `docs/vision/plans/2026-08-09-record-graph-layer.md`（記録グラフ層 — `records.mjs` の出自）
