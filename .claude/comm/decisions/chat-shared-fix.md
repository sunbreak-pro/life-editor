# Decision Queue — chat-shared-fix

形式は [`README.md`](./README.md) 参照。回答は `ANSWERS.md` へ。

（2026-08-12 昇格分 = D-20260812-shared-fix-1 / D-20260812-shared-fix-2 — `.claude/decisions/` 台帳へ）
（2026-08-16 昇格分 = D-20260815-shared-fix-1 / D-20260816-shared-fix-1〜5 — 同上）
（2026-08-18 昇格分 = D-20260816-shared-fix-6（回答 = C・実装 = PR #1078 merged）— 同上）
（2026-08-19 昇格分 = D-20260818-shared-fix-1（回答 = A = rAF スロットル・実装 Issue #1103）— 同上。質問 / 転記 / 昇格は chat-main が代行した）

### D-20260824-shared-fix-1: MCP の `get_week_context` も日曜始まりに揃えるか

- 背景: #1102 でアプリの週は日曜固定になったが、`mcp-server/src/utils/localDate.ts:49` の `localWeekStart` は **月曜始まりの独立実装**（#782 ③）で localStorage も読まない。`get_week_context` を引数なしで呼ぶと `briefingHandlers.ts:326` がそこへ落ちるので、**朝刊を書く Claude が見る「今週」とアプリの「今週」が 1 日ずれる**
- A: 日曜に揃える（推奨 — タイトルの「everywhere」に含める。ずれたまま運用すると、週目標の期間キー（日曜始まり）と MCP の週窓（月曜始まり）が別の週を指す）。`localWeekStart` の演算 1 行と `tests/localDate.test.ts:43-48` の 5 ケースを日曜へ書き換える
- B: 月曜のまま据え置く（MCP の週窓は「読み取りの窓」でありアプリの表示とは別物、と割り切る。#1102 の DoD は触らなくても満たされている）
- 放置時: 月曜のまま（= B）。#1102 の DoD には影響しない
- 期限感: いつでも（PR #1126 は merge 済みで、この判断を待っていない）
