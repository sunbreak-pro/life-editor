---
Status: COMPLETED
Created: 2026-07-08
Branch: claude/schedule-impl
Owner-chat: schedule-impl
Parent: .claude/docs/vision/plans/2026-07-05-design-implementation-fanout.md
---

# Plan: Schedule 画面 目標 IA 実装（ClaudeDesign import）

> fan-out 計画書の schedule-impl オーダーの mini-plan。デザイン正本 = ClaudeDesign project
> `bc3c66e3-4d20-4793-95fb-a1b0a1bc5136` / `Schedule.dc.html`（turn1 v2 14 フレーム + turn2 v4 4 フレーム、
> DesignSync で import 済み）。brief = `.claude/docs/design/briefs/schedule.md`、IA = `.claude/docs/design/IA.md`。

---

## Context

- **動機**: Schedule セクションは現在 5 コンポーネント縦積みの開発ビュー（S4 期の data-path 検証 UI）のまま。
  目標 IA（Calendar / Routines の 2 タブ + rightSidebar「今日の流れ」+ Mobile アジェンダ）へ刷新する。
- **制約**: シェル部品（AppShell / HeaderTabs / SegmentedControl / RightSidebar 系 / MainScreen）の所有者は
  shell-impl — 変更要望は outbox 経由。`shared/src/styles/**` はトークン**追加のみ**可。
  デザインと規約の矛盾は規約優先で差分報告。コスト $0。
- **Non-goals**: schedule_items / routines のデータモデル変更、DataService 変更、DB migration、
  Google Calendar 連携、旧 5 ビューのファイル削除（未配線化に留める — 削除はコード整理 Issue の領分）。

---

## Scope (Touchable Paths)

```
shared/src/components/schedule/**        # 主戦場（新規部品 + WeekTimeGrid 拡張）
shared/src/components/index.ts           # export 追記のみ
shared/src/utils/scheduleGridLayout.ts   # 月グリッド date math 追記のみ
shared/src/styles/tokens.css             # @theme マッピング追加のみ（既存値変更禁止 🛑）
shared/src/i18n/locales/{en,ja}.json     # scheduleScreen 名前空間追加
shared/tests/**                          # 新規部品テスト
web/src/schedule/**                      # ScheduleScreen ホスト（画面配線）
web/src/MainScreen.tsx                   # ★最小配線のみ（下記「逸脱」参照）
.claude/docs/vision/plans/2026-07-08-schedule-implementation.md
.claude/memory/chat-schedule-impl.md
.claude/history/chat-schedule-impl.md
.claude/comm/outbox/chat-schedule-impl.md
```

### 逸脱の明示（PR 本文 + outbox で報告する）

1. **`web/src/MainScreen.tsx` を編集する**（所有者 = shell-impl）。範囲は機械的配線 3 点のみ:
   schedule ブロックの中身を `<ScheduleScreen />` 1 コンポーネントに差し替え / `fluidSection` 判定に
   schedule を追加 / Materials と同型の「HeaderTabs を画面側が持つ」分岐に schedule を追加。
   シェル部品のコンポーネント本体は一切触らない。
2. **Mobile 月ビュー導線**: デザインフレーム 2c/2d に月への切替 UI が無いため、Mobile セグメントを
   リスト｜時間｜月 の 3 択に拡張（IA の「デザイン未定義の補完 = 実装側責務」適用）。
3. **Mobile ヘッダーのハンバーガー**: デザインフレームに無いが IA 標準（rightSidebar drawer 導線）が
   要求するため付与（規約優先）。

---

## Steps

| #   | Step                                                                                                                                                                                                                       | Gate    | Acceptance                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------- |
| 1   | tokens.css `@theme` に schedule-\*/chip-routine-\*/chip-event-\* の lumen マッピング追加（`:root` 実値は不変更）                                                                                                           | 🤖 自律 | `cd web && npm run build` exit 0 |
| 2   | shared 純部品: WeekTimeGrid 拡張（variant 色符号 / now line / 今日列地色 / fillHeight / days=1 日ビュー）                                                                                                                  | 🤖 自律 | `cd shared && npm run test` 緑   |
| 3   | shared 純部品: MonthGrid（Desktop セル + Mobile ドット版）+ 月 date math util                                                                                                                                              | 🤖 自律 | 同上                             |
| 4   | shared 純部品: AgendaList（「今日の流れ」+ Mobile リスト共用・now line 区切り・完了チェック円）                                                                                                                            | 🤖 自律 | 同上                             |
| 5   | shared 純部品: ScheduleToolbar / EventEditorPane / RoutineSummaryCard / RoutineEditorForm（純表示・callback 注入）                                                                                                         | 🤖 自律 | 同上                             |
| 6   | i18n: `scheduleScreen` 名前空間を en / ja 両 catalog に追加                                                                                                                                                                | 🤖 自律 | `shared/tests/i18n.test.ts` 緑   |
| 7   | web ホスト: `ScheduleScreen.tsx`（Calendar タブ 日/週/月 + エディタペーン + 空/エラー + 歯車モーダル / Routines タブ MasterDetail / RightSidebarPortal「今日の流れ」/ Mobile 3 ビュー + FAB + Quick capture + 詳細シート） | 🤖 自律 | `cd web && npm run build` exit 0 |
| 8   | MainScreen 最小配線（逸脱 1）                                                                                                                                                                                              | 🤖 自律 | 同上 + outbox に逸脱報告 append  |
| 9   | 検証一式（shared build+test / web build / 新規ファイル hex grep = 0 / AC 自己チェック）                                                                                                                                    | 🤖 自律 | 下記 AC 全項目                   |
| 10  | role-qa 独立監査（別コンテキスト Agent）→ 指摘修正                                                                                                                                                                         | 🤖 自律 | 監査レポートの Blocking 0 件     |
| 11  | tracker END + draft PR `feat: schedule — target IA implementation (ClaudeDesign import)`                                                                                                                                   | 🤖 自律 | draft PR URL 提示                |
| 12  | PR レビュー & merge                                                                                                                                                                                                        | 🛑 人手 | ユーザー merge                   |

---

## Files

| File                                                     | Operation | Notes                                                                                                                                                            |
| -------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared/src/styles/tokens.css`                           | Edit      | `@theme` に 10 行追加（schedule-routine-bg / schedule-other-bg / schedule-event-bg / schedule-event-border / chip-routine-{bg,fg,dot} / chip-event-{bg,fg,dot}） |
| `shared/src/components/schedule/WeekTimeGrid.tsx`        | Edit      | item `variant?: "routine" \| "event"`・now line（今日列のみ・accent 2px + 左端ドット）・今日列ヘッダ強調・`fillHeight?` で `max-h-[60vh]` を差し替え             |
| `shared/src/utils/scheduleGridLayout.ts`                 | Edit      | `monthGridKeys(monthKey)`（月グリッド 7×N の日付 key 行列）+ `startOfMonthKey` / `addMonthsKey` 追記                                                             |
| `shared/src/components/schedule/MonthGrid.tsx`           | Create    | Desktop: 7 列セル + 日数字バッジ + チップ最大 2 件 +「他 N 件」/ Mobile: `compact` でドット表示。onSelectDay / onSelectItem                                      |
| `shared/src/components/schedule/AgendaList.tsx`          | Create    | 終日チップ + past/future 分割 now line + 完了チェック円 + variant 色。rightSidebar と Mobile リストで共用                                                        |
| `shared/src/components/schedule/ScheduleToolbar.tsx`     | Create    | 今日 / ◀▶ / 期間ラベル / 日\|週\|月 Segmented / 歯車 / ＋予定を追加（accent）                                                                                    |
| `shared/src/components/schedule/EventEditorPane.tsx`     | Create    | 完了 / タイトル / 開始終了 / 由来チップ（routine 藍・event 紫）/ スキップ or 削除 / メモ。callback 注入                                                          |
| `shared/src/components/schedule/RoutineSummaryCard.tsx`  | Create    | 未選択時の右ペーン: マイルーチンサマリー +「Routines タブを開く →」                                                                                              |
| `shared/src/components/schedule/RoutineEditorForm.tsx`   | Create    | タイトル / 開始終了 / 頻度 4 択 Segmented / 曜日チップ / interval / 所属グループ / 削除。純表示                                                                  |
| `shared/src/components/schedule/index.ts`                | Edit      | 新規部品 export                                                                                                                                                  |
| `shared/src/components/index.ts`                         | Edit      | 同上                                                                                                                                                             |
| `shared/src/i18n/locales/en.json` / `ja.json`            | Edit      | `scheduleScreen.*` 追加                                                                                                                                          |
| `shared/tests/monthGrid.test.tsx` ほか                   | Create    | MonthGrid / AgendaList / WeekTimeGrid 拡張 / 月 date math のテスト                                                                                               |
| `web/src/schedule/ScheduleScreen.tsx`                    | Create    | ホスト: タブ・ビュー・日付 state、context 配線、RightSidebarPortal、Mobile 分岐、歯車モーダル（既存 CalendarView を内包）、Quick capture（BottomSheet）          |
| `web/src/MainScreen.tsx`                                 | Edit      | 最小配線 3 点（逸脱 1）                                                                                                                                          |
| `web/src/schedule/ScheduleCalendarView.tsx` ほか旧ビュー | 温存      | 未配線化のみ。`RoutineScheduleSync` は ScheduleScreen 内に mount 継続、`CalendarView` は歯車モーダルで再利用                                                     |

---

## Acceptance Criteria (機械検証可能)

- [ ] `cd shared && npm run build` exit 0
- [ ] `cd shared && npm run test` 全 pass（新規テスト含む）
- [ ] `cd web && npm run build` exit 0
- [ ] 新規作成ファイルに hex 直書き 0: `grep -rniE '#[0-9a-f]{3,8}\b' <新規ファイル>` ヒット 0（tokens.css の追加は変数参照のみなので対象外のまま 0）
- [ ] `git diff main -- shared/src/styles/tokens.css` に既存行の変更・削除が無い（追加のみ）
- [ ] i18n: en / ja 両方に同一キー集合（`i18n.test.ts` が検証）
- [ ] MainScreen の diff が schedule 配線 3 点のみ（シェル部品 import 変更なし）
- [ ] draft PR タイトル = `feat: schedule — target IA implementation (ClaudeDesign import)`

---

## Risks / Known Issues 参照

- Issue 017（routine 項目の ghost-revival）: routine 由来 item は Dismiss のみ・Delete 禁止 — EventEditorPane は
  routineId 有無でアクションを出し分ける（既存 ScheduleItemsView の bug2 fix を踏襲）。
- 未定義 `bg-lumen-*` クラスは silent fail で透明落ち — Step 1 の @theme マッピングを部品実装より先に行う。
- shell-turn2 outbox の申し送り: MobileDrawer に focus trap 未実装。schedule は focusable な中身
  （AgendaList のチェック円）を drawer に portal する最初の画面になりうる → outbox で shell-impl に報告し、
  本レーンでは受け入れる（トラップ実装はシェル所有）。
- パレット外 hex（デザイン中の #bfdbfe / #25252b 等）は IA の指示どおり既存トークンへ丸める。

---

## References

- 親: `.claude/docs/vision/plans/2026-07-05-design-implementation-fanout.md`（作業オーダー: schedule-impl）
- デザイン: scratchpad `Schedule.dc.html`（DesignSync import・turn1 14 + turn2 4 フレーム）
- brief: `.claude/docs/design/briefs/schedule.md` / IA: `.claude/docs/design/IA.md`
- 型・context: `shared/src/types/{schedule,routine,calendar}.ts` / `useScheduleItemsAPI` / `useRoutinesAPI` / `useCalendarsAPI`

---

## Worklog

- 2026-07-08: 棚卸し完了（旧 5 ビュー / context API / BottomSheet / SegmentedControl / i18n 既存キー /
  tokens.css @theme 未マッピング確認）。本計画書作成。
- 2026-07-08: role-engineer 2 段で実装完了（A: shared 純部品 6 種 + WeekTimeGrid 拡張 + tokens @theme +
  i18n 58 キー + テスト 6 本 / B: ScheduleScreen + CalendarTab + RoutinesTab + scheduleLabels +
  MainScreen 最小配線 3 点）。検証全緑（shared build / test 608 / web build / hex 0）。
- 2026-07-08: role-qa 独立監査 = 出荷可（Blocking 0）。指摘反映 4 件: 月ビューの「＋予定を追加」で
  日ビューへ自動遷移 / 月送り時に Mobile 選択日を月初へ追随 / MonthGrid セルの aria-label を
  ローカライズ注入 / AgendaList now-line の全 past・全 future 境界テスト追加。
  残 Minor（未使用 schedule-other-bg マッピング / Quick capture 初期時刻 / 今日キーのマウント時固定 /
  範囲フェッチのエラー代理 / 空状態カード簡略化）はフォロー対象として PR 本文に記録。
- 実装で判明した差分: `shared/src/components/index.ts` は wildcard export のため編集不要だった
  （Files 表の Edit 予定は不発・欠落ではない）。Step 12（PR merge）のみ 🛑 人手で残存。
