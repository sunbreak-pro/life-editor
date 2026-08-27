---
id: D-20260824-shared-fix-1
type: decision
status: answered
asked: 2026-08-24
answered: 2026-08-26
chat: shared-fix
answer: A
topics: [mcp, week-start, briefing, date]
refs:
  [
    "#1138",
    "#1102",
    "#872",
    "#782",
    "mcp-server/src/utils/localDate.ts:49",
    "mcp-server/src/handlers/briefingHandlers.ts:326",
  ]
supersedes: []
superseded-by: []
implemented-by: []
promoted-to: null
---

# D-20260824-shared-fix-1: MCP の `get_week_context` も日曜始まりに揃えるか

## 背景

（キュー `.claude/comm/decisions/chat-shared-fix.md` のエントリ本文をそのまま貼る）

- 背景: #1102 でアプリの週は日曜固定になったが、`mcp-server/src/utils/localDate.ts:49` の `localWeekStart` は **月曜始まりの独立実装**（#782 ③）で localStorage も読まない。`get_week_context` を引数なしで呼ぶと `briefingHandlers.ts:326` がそこへ落ちるので、**朝刊を書く Claude が見る「今週」とアプリの「今週」が 1 日ずれる**
- A: 日曜に揃える（推奨 — タイトルの「everywhere」に含める。ずれたまま運用すると、週目標の期間キー（日曜始まり）と MCP の週窓（月曜始まり）が別の週を指す）。`localWeekStart` の演算 1 行と `tests/localDate.test.ts:43-48` の 5 ケースを日曜へ書き換える
- B: 月曜のまま据え置く（MCP の週窓は「読み取りの窓」でありアプリの表示とは別物、と割り切る。#1102 の DoD は触らなくても満たされている）
- 放置時: 月曜のまま（= B）。#1102 の DoD には影響しない
- 期限感: いつでも（PR #1126 は merge 済みで、この判断を待っていない）

## 選択肢と裁定

- **A: 日曜に揃える**（**採用** — こうだいさんの回答 2026-08-26。回答は「日曜にそろえる」の一言）。#872 / #1102 で入った週目標の期間キーは日曜始まりなので、月曜のまま残すと期間キーと MCP の週窓が別の週を指し、朝刊を書く Claude とアプリの表示が食い違い続ける
- B: 月曜のまま据え置く（却下 — 「読み取りの窓は別物」で押し通せるのは窓が独立している間だけで、週目標が週キーで保存される今は両者が同じ週を指す必要がある）

## 波及

- 実装 = [#1138](https://github.com/sunbreak-pro/life-editor/issues/1138)（`mcp-server/src/utils/localDate.ts` + `mcp-server/tests/localDate.test.ts`）
- #1102 が畳んだ「週開始曜日の切替」の最後の取り残しがここ。アプリ側にはもう月曜前提の経路は無い
