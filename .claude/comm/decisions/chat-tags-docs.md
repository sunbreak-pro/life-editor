# Decision Queue — chat-tags-docs

worktree `tags-docs`（担当 = #368 / #474 / #472 / #473）。

### D-20260902-tags-1: Status `REFERENCE` の計画書は `plans/` に残すか `archive/` へ移すか

- 背景: #1391。`rules/docs-consistency.md` §3 上は `COMPLETED` / `SUPERSEDED` だけが `archive/` 行きなので REFERENCE は `plans/` 残置が正だが、現物が割れている — `plans/2026-07-16-briefing-headless-claude-prototype.md` は残置、`archive/2026-05-23-cleanup-and-consolidation-deletion-targets.md` は移動済み
- A: **`plans/` 残置に統一**（推奨 — 規則の文言どおりで、REFERENCE は「今も参照する資料」なので現役棚に置くのが自然）。`archive/` 側の 1 本を `plans/` へ戻す
- B: **`archive/` 移動に統一**。「もう実行しない計画は棚から下ろす」という運用に寄せ、規則側の文言を直す
- 放置時: 現状のまま（割れたまま）。他の #1391 項目は先に着地済み（PR #1451）なので、この 1 件だけが宙に浮く
- 期限感: いつでも

### D-20260902-tags-2: `briefs/_COMMON-CONTEXT.md` の版数を上げるか、凍結プロンプトとして据え置くか

- 背景: #1390。Version 3（2026-07-05）のまま「Connect = Graph / Backlinks」「ユーティリティ枠 Settings / Trash」「More = Connect / Settings / Trash」「利用者は作者本人のみ（N=1）」を書いている。前 3 つは #1152 / #1171 / #1293 で、最後は D-20260829-main-1 で SUPERSEDE 済み
- A: **凍結プロンプトとして据え置く**（推奨 — 冒頭に「当時の生成条件の記録であり現行 IA ではない」と明記するだけで済む。brief は既に生成を終えた資材で、貼り直す予定が無いなら現行化のコストに見合わない）
- B: **版数を上げて現行に追随**。ただし `Settings / Trash` の言及は brief 9 本に計 88 箇所・`N=1` は 9 本全部にあり、**転記側も同時に直さないと版数だけ新しくなる**。`briefs/trash.md` は「もうセクションではない画面の brief」になるので扱いの判断も要る
- 放置時: `_COMMON-CONTEXT.md` と 9 本の brief は現状のまま（#1390 の他項目 = IA.md / README / tier-2 は PR #1461 で着地済み）
- 期限感: いつでも（これらの brief を ClaudeDesign に貼り直す予定が出たときが実質の期限）

---

判定材料: 「これらの brief をこれから ClaudeDesign に貼り直すのか、履歴として残すだけか」で A / B が決まります。

---

（回答済み 3 件は 2026-08-09 に `.claude/decisions/` 台帳へ昇格済み — D-20260730-tags-1 / D-20260731-tags-2 / D-20260731-tags-3。台帳化とキューからの除去は chat-main が代行した。2026-08-12 昇格分 = D-20260812-tags-1）
