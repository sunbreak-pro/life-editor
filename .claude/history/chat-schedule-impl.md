# HISTORY (chat-schedule-impl)

### 2026-07-08 - Schedule 画面 目標 IA 実装（ClaudeDesign import）

#### 概要

Schedule セクションを S4 期の開発ビュー縦積みから目標 IA（Calendar / Routines 2 タブ + rightSidebar「今日の流れ」+ Mobile 単画面）へ刷新し、draft PR を作成した。デザイン正本は ClaudeDesign `Schedule.dc.html`（turn1 14 + turn2 4 フレーム）。（計画書: archive/2026-07-08-schedule-implementation.md）

#### 変更点

- **shared 純部品**: MonthGrid / AgendaList / ScheduleToolbar / EventEditorPane / RoutineSummaryCard / RoutineEditorForm を新規作成、WeekTimeGrid を拡張（variant 色符号・now line・今日列地色・fillHeight・自動スクロール）
- **トークン**: tokens.css @theme に schedule-\*/chip-routine-\*/chip-event-\* マッピング 10 行追加（既存値変更なし）
- **date math**: scheduleGridLayout.ts に startOfMonthKey / addMonthsKey / monthGridKeys 追加
- **i18n**: scheduleScreen 名前空間 58 キーを en / ja 両 catalog に追加
- **web ホスト**: ScheduleScreen / CalendarTab / RoutinesTab / scheduleLabels 新規。MainScreen は最小配線 3 点のみ（逸脱として outbox 報告）
- **テスト**: 新規 6 ファイル + QA 指摘の境界テスト 2 件（計 608 全緑）
- **品質**: role-qa 独立監査 = 出荷可（Blocking 0）。指摘反映 4 件（月ビュー追加時の日ビュー遷移 / 月送り時の Mobile 選択日追随 / MonthGrid aria-label ローカライズ / AgendaList 境界テスト）
- **Issue 017 遵守**: routine 由来 item は Dismiss のみ・Delete 経路なし（EventEditorPane がゲート + テスト検証）
