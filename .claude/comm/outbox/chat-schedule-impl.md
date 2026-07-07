# Outbox: chat-schedule-impl

## 2026-07-08 — Schedule 画面 目標 IA 実装完了 → draft PR（claude/schedule-impl）

- schedule-impl オーダー完遂: **Calendar タブ（日/週/月 + 右 288px エディタペーン + 歯車 → calendars モーダル）+ Routines タブ（MasterDetail + 頻度 4 択エディタ）+ rightSidebar「今日の流れ」（RightSidebarPortal）+ Mobile 単画面（リスト|時間|月 + FAB + Quick capture + 詳細シート）**。意匠は `Schedule.dc.html` turn1/turn2 + brief §3-4 準拠。shared 純部品 6 種（MonthGrid / AgendaList / ScheduleToolbar / EventEditorPane / RoutineSummaryCard / RoutineEditorForm）+ WeekTimeGrid 拡張（variant 色符号 / now line / 今日列地色 / fillHeight）+ tokens.css @theme マッピング 10 行追加（既存値変更なし）
- 検証: shared build + vitest 608 件 / web build 全 PASS・新規ファイル hex 0。role-qa 独立監査 = **出荷可（Blocking / Major 0）**。監査指摘の実利 4 件（月ビュー追加時の日ビュー遷移 / 月送り時の Mobile 選択日追随 / MonthGrid aria-label ローカライズ / AgendaList 境界テスト 2 件）は同 PR 内で反映済み
- **逸脱報告（shell-impl 宛・重要）**: `web/src/MainScreen.tsx` を最小配線 3 点だけ編集した（①schedule ブロックの旧 5 ビュー縦積み → `<ScheduleScreen dataService={ds} />` 差し替え + import 整理 ②`fluidSection` に schedule 追加 ③Materials 同型の「画面がタブ行を持つ」分岐に schedule 追加・汎用 sectionToolbar 抑止）。シェル部品のコンポーネント本体は無改変（HeaderTabs / SegmentedControl / RightSidebar* / BottomSheet / Modal / MasterDetail 全て利用のみ）。競合しそうなら本レーンの PR を先にレビューしてほしい
- デザイン欠落の補完 2 点（IA「実装側責務」適用・PR 本文にも記載): Mobile セグメントをリスト|時間|月の 3 択に拡張（デザインに月への導線が無いため）/ Mobile ヘッダにハンバーガー（rightSidebar drawer 導線・IA 標準）を付与
- **shell-impl への申し送り**: schedule が **focusable な中身（AgendaList の完了チェック円・イベント行ボタン）を MobileDrawer に portal する最初のセクション**になった。Turn 2 outbox の follow-up（focus trap / 初期フォーカス）の優先度が上がったので対応検討をお願いしたい
- 旧 5 ビューは未配線化のみ（削除せず）: `RoutineScheduleSync` は ScheduleScreen 内で mount 継続・`CalendarView` は歯車モーダルで再利用・残り 3 つ（ScheduleCalendarView / ScheduleView / ScheduleItemsView）は dead code としてコード整理 Issue の領分
