---
Status: COMPLETED
Created: 2026-05-12
Completed: 2026-05-13
Project: /Users/newlife/dev/apps/life-editor
Task: Calendar 表示整合性の修正 A+B+C
---

# Plan: Calendar 表示整合性の修正（isDeleted filter / Routine 同期削除 / Progress 月次集計）

## Context

ユーザー報告（2026-05-12 セッション）に基づく 3 つの問題への対応。

### 動機

1. **`useCalendar.ts` の `isDeleted` filter 漏れ（バグ）**
   - `frontend/src/hooks/useCalendar.ts:29-61` の `tasksByDate` は `status` でしか filter しておらず、soft-deleted な task が Calendar 上に表示され続ける。
   - 同一ファイル内の `ScheduleSection.tsx::allTasksByDate` は `!task.isDeleted` を見ているため、Calendar とサイドバー進捗で食い違いが発生。

2. **Routine 同期削除の導線不足**
   - Rust 側 `routine_repository::soft_delete`（`src-tauri/src/db/routine_repository.rs:198-228`）は派生 `schedule_items` を cascade soft-delete する設計済み。
   - しかし「Calendar 表示物の一括削除」UI が存在しないため、ユーザーが DB を直接削除すると `routines` を消し忘れ、次に Calendar を開いたとき `ensureRoutineItemsForDateRange`（`CalendarView.tsx:328-341`）が schedule_items を再生成して「消えない」現象が起きる。
   - 一括削除導線を Settings の Danger Zone に追加し、論理削除（Trash 復元可）で実装する。

3. **Calendar の Progress が日単位（temporal scope のズレ）**
   - `ScheduleSection.tsx:255-338` の `calendarCategoryProgress` は `calendarProgressDate`（初期値 = 今日）の単日集計。
   - Calendar 本体は月全体を表示しているため、Calendar にタスクが見えていてもサイドバーは `0/0` と表示され誤解を招く。
   - DayFlow（`OneDaySchedule`）は表示自体が単日なので **現状の日単位集計を維持** する。

### 制約

- Cloud Sync 整合性を壊さないため、削除は基本 soft-delete（`is_deleted=1 + version+1 + updated_at` の delta path を経由）。
- 既存の Trash UI は触らない（Plan 外）。
- `monthlyScheduleItems`（`useScheduleContext`）は既に Calendar が month 単位で load しているので、これを集計ソースとして再利用。

### Non-goals

- Trash UI の改修。
- Cloud Sync の delete 戦略変更。
- DayFlow の Progress 仕様変更（明示的に日単位を維持）。
- 物理削除（DROP TABLE 相当）導線の提供。

---

## Steps

1. [ ] `useCalendar.ts` の `tasksByDate` filter に `!n.isDeleted` を追加（incomplete/completed 両分岐）。
2. [ ] `useCalendar.test.ts` に「soft-deleted task は `tasksByDate` に出ない」テストを追加。
3. [ ] `ScheduleSection.tsx::calendarCategoryProgress` を**月単位集計**に書き換え。
   - tasks: `allTasksByDate` を月全体で集計（month 内すべての date key を walk）。
   - routine / events: `monthlyScheduleItems`（既に month 単位で load 済み）を直接集計、`scheduleItems`（=単日キャッシュ）には依存しない。
   - daily / notes: `dailies` / `notes` を当該月の日付範囲で filter。
4. [ ] `ProgressSection.tsx` の `dateLabel` を「月単位 / 日単位」両対応にするための prop を追加（`scope: "day" | "month"`、デフォルト `"day"`）。Calendar 経由は `"month"`、DayFlow 経由は `"day"`。
5. [ ] `DayFlowSidebarContent.tsx` に `scope` prop を passthrough で追加（DayFlow は `"day"` を渡す）。
6. [ ] `ScheduleSection.tsx` で Calendar tab 時の `<DayFlowSidebarContent>` 呼び出しに `scope="month"` を渡す。`calendarProgressDate` は **Calendar 視点の現在月** を表すよう用途を再定義（初期値は `today`、月送りで月初に追従、`onDateSelect` は廃止または「選択月のハイライト」用途のみに縮小）。
7. [ ] Settings に「Calendar データ一括削除」セクションを新設。
   - 対象 checkbox: Tasks (scheduled のみ) / Events (routine_id NULL の schedule_items) / Routines (派生 schedule_items 含む) / Dailies / Notes。
   - 「全選択」「全解除」ボタン。
   - 確認ダイアログ（赤背景 + 「削除する」ボタン）。Soft-delete のため復元可。
8. [ ] Frontend に bulk delete API を追加（`DataService.bulkSoftDeleteCalendarData(kinds: CalendarDataKind[])`）。`TauriDataService` 側は IPC 呼び出し実装。
9. [ ] Rust 側 `bulk_soft_delete_calendar_data` コマンドを追加（既存の各 repository の `soft_delete` を順に叩く実装）。
10. [ ] `src-tauri/src/lib.rs` の `generate_handler![]` に登録（§7.2 4 点同期）。
11. [ ] 削除実行後、Frontend 各 Context (`TaskTreeContext` / `RoutineContext` / `ScheduleContext` / `DailyContext` / `NoteContext`) を強制 reload するヘルパーを発火させる（既存の各 `refresh*` API を順に呼ぶ）。
12. [ ] 既存 Settings の i18n（`en.json` / `ja.json`）にラベル追加。
13. [ ] 手動検証（下記 Verification）と `npm test` 実行。

---

## Files

| File                                                                       | Operation       | Notes                                                                                                                     |
| -------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/hooks/useCalendar.ts`                                        | Edit            | L32-34 の filter に `!n.isDeleted` 追加                                                                                   |
| `frontend/src/hooks/useCalendar.test.ts`                                   | Edit            | isDeleted filter テストケース追加                                                                                         |
| `frontend/src/components/ScheduleList/ScheduleSection.tsx`                 | Edit            | `calendarCategoryProgress` を月単位集計に書換／`calendarProgressDate` の用途整理／`<DayFlowSidebarContent scope="month">` |
| `frontend/src/components/Tasks/Schedule/DayFlow/DayFlowSidebarContent.tsx` | Edit            | `scope` prop を `ProgressSection` に passthrough                                                                          |
| `frontend/src/components/Tasks/Schedule/shared/ProgressSection.tsx`        | Edit            | `scope` prop（"day" / "month"）／`dateLabel` を scope に応じて切替                                                        |
| `frontend/src/components/Settings/Settings.tsx`                            | Edit            | Danger Zone セクション追加                                                                                                |
| `frontend/src/components/Settings/CalendarDataResetDialog.tsx`             | New             | 一括削除ダイアログ（対象選択 + 確認）                                                                                     |
| `frontend/src/services/DataService.ts`                                     | Edit            | `bulkSoftDeleteCalendarData(kinds)` インターフェース定義                                                                  |
| `frontend/src/services/TauriDataService.ts`                                | Edit            | invoke 実装                                                                                                               |
| `frontend/src/i18n/locales/en.json`                                        | Edit            | settings.calendarReset.\* キー追加                                                                                        |
| `frontend/src/i18n/locales/ja.json`                                        | Edit            | 同上                                                                                                                      |
| `src-tauri/src/commands/data_io_commands.rs`                               | Edit            | `db_bulk_soft_delete_calendar_data` コマンド追加（既存 repo soft_delete を順次呼ぶ）                                      |
| `src-tauri/src/lib.rs`                                                     | Edit            | `generate_handler![]` 登録                                                                                                |
| `src-tauri/src/db/task_repository.rs`                                      | Edit (optional) | `soft_delete_all_scheduled` ヘルパー追加（既存 soft_delete を全件 loop でも可）                                           |

---

## Verification

- [ ] `cd frontend && npm test src/hooks/useCalendar.test.ts` → グリーン。
- [ ] `cd frontend && npm run build` → 型エラーなし（CLAUDE.md feedback: tsc -b 経由）。
- [ ] `cargo tauri dev` 起動して以下を手動確認:
  - [ ] Calendar に表示中の Task を右クリック→削除 → Calendar から即座に消える（isDeleted filter）。
  - [ ] Routine を新規作成→Calendar 反映確認→Routine 削除 → Calendar からも派生 schedule_items も全部消える。
  - [ ] Calendar 画面の右サイドバー Progress が **月の合計** を表示している（タスク 5 件 / 完了 2 件なら 2/5）。
  - [ ] DayFlow 画面の右サイドバー Progress が **その日の合計** のまま（仕様変更なし）。
  - [ ] Settings > Danger Zone から「Calendar データ一括削除」を開き、Tasks のみ選択→削除 → Tasks のみ消え、他は残る。
  - [ ] 同様に Routines のみ選択→削除 → Routine + 派生 schedule_items が消える、Tasks / Events は残る。
  - [ ] 削除後 Trash から復元可能（Trash UI が既存のまま動くこと）。
- [ ] Cloud Sync を有効にしている環境で削除後に sync → 別端末でも削除が伝搬する（version + is_deleted+1 delta path）。

---

## Risks / 注意

- **Calendar の Progress 月次集計の計算量**: month 内すべての date key を走査するが、件数は数百レベルで O(n) のため問題なし。`useMemo` の依存配列を正しく設定すること。
- **`calendarProgressDate` 廃止 / 縮小**: 既に `MonthlyView` の `onDateSelect` を経由しているため、props の連鎖を辿って未使用化判定を行う必要あり（dead-code 残存を避ける）。
- **bulk delete の atomicity**: 各テーブル個別の soft_delete を順次呼ぶ実装。途中失敗時は partial delete が残る。Rust 側で 1 トランザクションにまとめる実装が安全（Step 9 で対応）。
- **MCP server / Cloud D1 の影響**: soft-delete 経路を踏むので追加対応不要（既存の delta sync で伝搬）。
