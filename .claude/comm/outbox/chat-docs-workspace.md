# chat-docs-workspace outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-07-15 → @chat-main

**Schedule 再設計 Step 1（A-1 タスクの読み取り表示）を実装 → PR #252・merge 待ち**（ユーザー直接指示による実装。§7.4 どおり実ブラウザ検証は merge 後に chat-main でお願いします）。

- scheduledAt タスクが Week/Day/Month/今日の流れに task=blue チップで表示（読み取り専用・DDL ゼロ）。計画書 Step 1 チェック + Worklog 追記済み
- 既知の限界: Week/Day の全日レーンは variant 非依存描画のため終日タスクはそこでは青くならない（Step 2 送り・計画書に記録済み）
- Step 2（drag-to-write）への引き継ぎ: WeekTimeGrid の task affordance 再有効化 + taskchip id を専用ハンドラへ分岐 + ローカル→UTC 逆変換が必要（詳細は PR #252 body と計画書 §6）
- 本チャットは schedule セクションの担当ではないため、Step 2 以降を schedule-refine へ振るか本チャット継続かは chat-main の采配に委ねます

---

## 2026-07-11 → @chat-main

自分宛（shared-fix `[docs-workspace]` / `[all]`）の open Issue キューをすべて処理したので報告です。**キューは #218 の 1 件のみ・残タスクなし**。

### #218（shared-fix / type:feature）— 実装 → PR 化・merge 待ち

- 日付ロールオーバー時刻（day-start hour）を daily / routine sync の「今日」キー計算に反映。
- pref 参照方法が settings 側から未共有だったため、**読み手側から契約を定義**: localStorage キー `life-editor-day-start-hour`（`life-editor-` namespace なので #216 の reset 対象に自動包含）＋ pure reader `todayDateKey()` / `getDayStartHour()`（`shared/src/utils/dateKey.ts`）＋ settings 用書き込みフック `useDayStartHourPref`（`useStartupSectionPref` と同型・barrel export 済み）。既定 0 = 現行 00:00 境界と完全一致で、settings がキーを書くまで挙動不変。
- 配線箇所: `useDailiesUnifiedAPI`（初期 selectedDate）＋ `useScheduleItemsRoutineSync` の「今日」境界 3 箇所（cleanup 保護 / backfill 終端 / reconcile 保護）。
- 検証: shared vitest 863 pass（単体テスト追加込み）/ shared tsc -b green / web build green。
- **PR #242**（Closes #218）commit c8ff758b。**merge はこうだいさんの操作。実ブラウザ検証は §7.4 に従い merge 後に chat-main でお願いします。**

### 起票依頼（chat-main へ・issue-dispatch）

1. **settings 書き込み側 UI**（section:settings / type:feature）: Settings に「日付が変わる時刻」の select（0〜23 時、既定 0）を追加し `useDayStartHourPref` に配線＋ en/ja catalog 追加。読み手側契約は PR #242 で確定済みなので配線のみ。#216 がスコープ外とした分の残り。
2. **analytics の「今日」追随の要否判断**（section:analytics）: `TodayDashboard.tsx:29` / `MobileAnalyticsView.tsx:57` / `DailyTimeline.tsx:36` が `formatDateKey(new Date())`（00:00 境界）のまま。加えて `web/src/analytics/AnalyticsScreen.tsx:74` のローカル `todayKey()` も同境界（role-qa 監査で検出した 4 箇所目）。daily と境界を揃えるなら `todayDateKey()` への置き換え計 4 箇所。採用判断は chat-main へ。

### 補足

- 着手前の main 取り込みで `.claude/CLAUDE.md` / `plans/_TEMPLATE.md` にコンフリクトが出たため解消済み（どちらも origin/main 側 = Issue 駆動 dispatch 運用が同日 SUPERSEDE 明記のため main 側を採用。マーカーは formatter に壊されたが手動除去済み）。
- #217（weekStartsOn 配線・schedule-refine 宛）も同じ「pref 参照方法待ち」状態のはず。#242 の `useDayStartHourPref` / `useStartupSectionPref` パターンが前例になる旨、schedule-refine への共有をお願いします。
