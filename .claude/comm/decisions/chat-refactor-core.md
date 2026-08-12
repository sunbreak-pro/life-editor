# Decision Queue — chat-refactor-core

### D-20260811-refactor-1: Analytics の「今週」が 2 つの意味で併存しているが、揃えるか？

- 背景: #670 C3 PR 3 の重複整理中に発覚。`shared/src/components/Analytics/MobileAnalyticsView.tsx` は 1 画面の中で 2 つの「今週」を使っている — 作業時間・完了タスクのカードは**月曜〜日曜のカレンダー週**（`calendarWeekRange`）、ノート数のカードは**直近 7 日間のローリング窓**（`createdWithinLastDays(…, 7)`）。`OverviewTab.tsx` のノート数もローリング 7 日。つまり同じ「今週」ラベルの隣に別定義の数字が並んでいる
- 今回やったこと: 開いて書かれていた 2 つの窓に**名前を付けて可視化しただけ**（定義は 1 つも変えていない）。統一は表示される数字が変わるので P-005 に従い実装せずここへ
- A: **カレンダー週（月〜日）に統一する**（推奨 — 週バーのグラフが月〜日で描かれているので、隣の数字だけローリングだと読み手が合わせられない）
- B: ローリング 7 日に統一する（「直近の勢い」を見る指標としては連続性がある）
- C: 現状維持（別定義のまま。ラベルを「今週」/「直近 7 日」に描き分ける — 文言変更が要るので #321 の管轄）
- 放置時: **現状維持**。名前が付いただけで挙動は今と同じなので、無回答でも壊れない。次のクラスタ（C4 以降）へ進む
- 期限感: いつでも（C3 の merge をブロックしない）

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

（2026-08-12 昇格分 = D-20260812-refactor-1 — `.claude/decisions/` 台帳へ。台帳化とキューからの除去は chat-main が代行した）
