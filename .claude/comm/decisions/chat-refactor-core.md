# Decision Queue — chat-refactor-core

（未決なし。回答済みの判断は `.claude/decisions/` の台帳へ昇格済み）

### D-20260811-refactor-2: `window.confirm` を自前ダイアログに置き換えるか（計画書 §C3 PR 4 の 1 項目）

- 背景: #670 C3 PR 4 で着手しようとして、**計画書とコード内の記録が食い違っている**のを見つけた。計画書は「`window.confirm` を既存 `RepeatScopeDialog` の形へ（規約ドリフト是正）」としているが、コード側は 3 箇所で「意図してそう選んだ」と明記している:
  - `web/src/schedule/CalendarTab.tsx:1492`（#628）— 「a browser confirm is the one dialog that cannot be missed on either platform」
  - `web/src/settings/SettingsScreen.tsx:124`（#216）— 「window.confirm is the app's existing lightweight confirm affordance for a one-shot destructive action」
  - `web/src/tasks/KanbanView.tsx` / `CalendarTab.tsx:1765`（#573）— 上の 2 つが参照している元パターン
- つまり調査時は「ドリフト（統一漏れ）」に見えたが、実際は**過去に下した判断**。ドリフト是正として黙って剥がすと、その判断を無言で覆すことになるので P-008 に従い実装せずここへ
- 影響範囲: 6 箇所（CalendarTab 4 / SettingsScreen 1 / KanbanView 1）+ 共有 `ConfirmDialog` 新設 + en/ja の文言。うち `CalendarTab.tsx:1494` の `askDiscard` だけは `decideUnsavedClose()` の**同期契約**（#628 が web/tests で固定した純関数）を非同期に変える必要があり、他の 5 箇所より重い
- A: **現状維持**（推奨 — コード側の記録が新しく、かつ具体的な理由「どのプラットフォームでも見落とされない」を持っている。計画書 §C3 のこの項目を取り下げる）
- B: 全 6 箇所を共有 `ConfirmDialog` に置き換える（見た目の管轄は Epic #290 なので、`RepeatScopeDialog` の形を流用し新規デザインはしない）
- C: `askDiscard` 以外の 5 箇所だけ置き換える（同期契約に手を入れない範囲）
- 放置時: **現状維持**（A と同じ）。#670 の DoD にこの項目は無いので、C3 の完了はブロックしない
- 期限感: いつでも（#290 Schedule redesign の着手時に一緒に決めるのが自然）
