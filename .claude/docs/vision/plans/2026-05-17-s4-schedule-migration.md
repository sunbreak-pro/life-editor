---
Status: IN PROGRESS — S4-0 調査着手。並行チャット同居のため本ファイルが S4 自レーン SSOT
Created: 2026-05-17
Task: Phase 2 S4 — Schedule ドメイン Web 移植（最大規模・最後）
Project path: /Users/newlife/dev/apps/life-editor
Branch: phase-2/schedule-migration（refactor/web-first-v2 から分岐、HEAD=c817c61）
Parent: .claude/docs/vision/plans/2026-05-16-phase2-core-migration.md（S4 の詳細展開）
SSOT: .claude/2026-05-04-cross-platform-migration.md（Phase 2）
---

# Plan: Phase 2 S4 Schedule 移植

## Context

Phase 2 コア機能移植の最終ドメイン。6 テーブル + Routine→schedule_items 生成器 + Schedule 3 分割 Provider。
過去最大規模で Known Issue 008/011/017/020 の地雷原。アーキ = **Option A**（shared は
context/hooks/services/types/utils のみ UI フリー / `web/src/schedule/` にリーン新規ミニ UI / @dnd-kit
等は web 側）。migration 適用は MCP write 凍結中につき**ユーザー手動 SQL Editor**、検証は MCP read-only

- S0 RLS ゲート。実ブラウザ確認は 0006 本番 apply 後＝次セッション初手（S3 と同フロー）。

**並行チャット同居**: `refactor/web-first-v2` に別チャット（frontend Phase5 / security 監査）が継続
commit 中。本 S4 は子ブランチ `phase-2/schedule-migration` で隔離。`frontend/` `src-tauri/` `cloud/`
不可侵（読み取りのみ）。`.claude/MEMORY.md` `.claude/HISTORY.md` は別チャット編集中の可能性が高いため
**本計画書を S4 SSOT** とし、tracker への重い編集は避ける（pathspec commit、`git add -A` 厳禁）。

## ユーザー決定（2026-05-17）

- **Q1 単一 0006 migration**（PM 推奨採用。S3 の 0005 3 テーブル単一成功・RLS no-split を踏襲）
- **Q2 Provider は段階的 3 段**（Routine → ScheduleItems → CalendarTags、別 commit / 別 QA）
- **Q3 calendar_tag_assignments は S4 末尾独立サブ**（S4-6。CalendarTag 本体テーブルの S4 内扱いは S4-0 で確定）
- **Q4 Routine 生成器は独立サブステップ**（S4-5。017/011 を独立 QA）
- **Q5 実ブラウザは 0006 本番 apply 後＝次セッション**（S3 同フロー。migration ヘッダの apply 手順は現運用=手動 SQL Editor に合わせて記述）
- **Q6 routine_groups/calendars のソフトデリート有無は S4-0 で frontend 実 schema 読み取りで確定**

## sync 区分判定（軸 1、db-conventions §3-4 + S1/S3 前例）

| テーブル                  | sync 区分                    | 要点                                                                                                           |
| ------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| routines                  | versioned                    | soft-delete + version + LWW。tasks/notes 同型                                                                  |
| routine_groups            | versioned（暫定）            | 型に isDeleted 無し → S4-0 で実 schema 確定                                                                    |
| routine_group_assignments | relation（soft-delete 付き） | junction。**soft-delete-aware delta 必須**（Issue 008 直系。親 updated_at で JOIN pull + is_deleted フィルタ） |
| schedule_items            | versioned + 論理一意特別扱い | `(routine_id, date)` partial UNIQUE index `WHERE routine_id IS NOT NULL AND is_deleted=false`（Issue 011）     |
| calendars                 | versioned（暫定）            | 型に isDeleted 無し → S4-0 で実 schema 確定                                                                    |
| calendar_tag_assignments  | relation                     | polymorphic（entityType task                                                                                   | schedule_item）。**soft-delete-aware delta 必須**（Issue 008、db-conventions §4 例示テーブル）。task 側 entity は FK 張らず polymorphic |

全テーブル RLS enable + owner-only 4policy + `user_id default auth.uid()` 必須（anon key 公開前提・S0 ゲート機械検証）。

## スキーマ依存順（軸 2）

0006 内 CREATE 順（FK 先行）: 1.calendars → 2.routines → 3.routine_groups → 4.routine_group_assignments(→3,2) → 5.schedule_items(→2、partial UNIQUE index) → 6.calendar_tag_assignments(→5、task polymorphic)。各直後に RLS+4policy。drop は子→親逆順 cascade（0005 冪等パターン）。

## Routine 生成仕様（軸 3）

frontend 既存ロジック（読み取り参照のみ・不可侵）:

- `frontend/src/utils/routineScheduleSync.ts`（純粋関数 `diffRoutineScheduleItems`/`shouldCreateRoutineItem`/`collectRoutineItemsForDates`）→ `shared/src/utils/` へ移植（改変しない）
- `frontend/src/utils/routineFrequency.ts`（`shouldRoutineRunOnDate`）→ `shared/src/utils/` へ
- `frontend/src/hooks/useScheduleItemsRoutineSync.ts`（生成器フック `ensureRoutineItemsForDate(Range)`）→ `shared/src/hooks/`、`getDataService()` 直呼びはコールバック注入化（§6.4。useNotesAPI パターン）
- 生成トリガー配線は `web/src/schedule/`

**Issue 017 両系統ガード（最重要・S4-5 で必須）**: (a) schedule_items/tasks の by-date/range クエリに `.eq('is_deleted', false)` 必須 (b) Routine 削除時に routine_id 一致 schedule_items を明示削除（掃除漏れ＝無限復活）(c) `(routine_id,date)` partial UNIQUE（Issue 011）(d) `shouldCreateRoutineItem` の isDeleted/isArchived/!isVisible 弾きロジックは改変しない。生成器 update は Issue 020（read-then-write 406 race）と同 pattern が schedule_items にも該当しうる点に注意。

## Steps（サブステップ分割境界 = 1 PR に抱えない）

- [ ] **S4-0 調査**（role-engineer read-only）: frontend 実 schema（rusqlite migrations / cloud schema）で routine_groups/calendars のソフトデリート列確定（Q6）/ 6 テーブル全列セット確定 / CalendarTag 本体テーブルの S4 内要否確定（Q3 補足）/ Routine 生成 timezone・先読み範囲・編集時 update レースの曖昧点を列挙。**書き込みなし**、結果をメインに返す
- [ ] **S4-1 migration + mapper**: `supabase/migrations/0006_schedule_full_schema.sql`（6 テーブル + RLS 4policy×6 + schedule_items partial UNIQUE index、ヘッダは手動 SQL Editor 運用記述）+ mapper 6 種 + roundtrip テスト（shared vitest 利用）。→ role-qa + **security-reviewer 並列**（RLS naked/anon 流出 Critical、`check-rls.sql` offender0 静的保証）
- [ ] **S4-2 SupabaseDataService**: routines/groups/assignments/schedule_items/calendars/cta の Proxy throw 置換。relation の soft-delete-aware delta（Issue 008）。→ role-qa
- [ ] **S4-3 RoutineProvider**: shared context(Pattern A)+hooks + web ミニ UI。Provider 依存順先頭。→ role-qa
- [ ] **S4-4 ScheduleItemsProvider**: schedule_items CRUD + 論理一意（Issue 011）。**Routine 生成は含めない**。→ role-qa
- [ ] **S4-5 Routine 生成器**: 純粋関数 shared 移植 + 生成器フック。**Issue 017 両系統ガード専用 QA**。→ role-qa（017 再発を専用検証）
- [ ] **S4-6 Calendar + CalendarTags**: calendars + calendar_tag_assignments + Mobile Optional バリアント（CalendarTags は Mobile 省略 Provider）。→ role-qa

各サブステップ末: session-verifier（web `tsc -b`/eslint/vite build、shared `tsc -b`+vitest）→ pathspec commit。S4-3 以降は Provider 依存順のため直列（並列不可）。

## Files

| File / Dir                                                                               | Operation | Notes                                                                                     |
| ---------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------- |
| `supabase/migrations/0006_schedule_full_schema.sql`                                      | Add       | 6 テーブル単一ファイル + RLS 4policy×6 + partial UNIQUE。手動 SQL Editor apply 前提ヘッダ |
| `shared/src/services/SupabaseDataService.ts`                                             | Edit      | schedule 系 Proxy throw → 実装。relation soft-delete-aware delta                          |
| `shared/src/services/{routine,routineGroup,scheduleItem,calendar,calendarTag}Mapper*.ts` | Add       | mapper + roundtrip（vitest）                                                              |
| `shared/src/context/{Routine,ScheduleItems,CalendarTags}Context*`                        | Add       | Pattern A 3 ファイル。Mobile 省略 Provider は Optional バリアント                         |
| `shared/src/hooks/use{Routine,ScheduleItems,CalendarTags}*.ts`                           | Add       | DataService コールバック注入                                                              |
| `shared/src/utils/{routineScheduleSync,routineFrequency}.ts`                             | Add       | frontend 純粋関数の忠実移植（改変禁止）                                                   |
| `web/src/schedule/*`                                                                     | Add       | リーン新規ミニ UI + 生成トリガー配線                                                      |
| `frontend/` `src-tauri/` `cloud/`                                                        | 不可侵    | 読み取りのみ                                                                              |
| `.claude/docs/vision/plans/2026-05-17-s4-schedule-migration.md`                          | Edit      | 本 SSOT。サブステップ完了で [x]                                                           |
| `.claude/docs/vision/plans/2026-05-16-phase2-core-migration.md`                          | Edit      | S4 完了時に [x] 化（並行チャット競合回避でパス指定）                                      |

## Verification

- [ ] 6 テーブル mapper roundtrip vitest green（shared）
- [ ] `check-rls.sql` 静的 offender0（6 テーブル全 RLS+4policy）/ security-reviewer Critical0
- [ ] Routine 生成: 削除後に schedule_items が復活しない（Issue 017）/ `(routine_id,date)` 重複なし（Issue 011）/ soft-deleted 非表示
- [ ] relation（assignments/cta）が delta sync で is_deleted 反映（Issue 008）
- [ ] web `tsc -b` / eslint / vite build green、`frontend/`/`src-tauri/`/`cloud/` diff 0（非破壊）
- [ ] 実ブラウザ Schedule CRUD/Routine 生成/Calendar 表示 = 次セッション（0006 本番 apply 後）

## スコープ外（クリープ防止）

CalendarTag 本体拡張 / WikiTags(S5) / Realtime(S8) / オフラインバナー(S7) / Analytics 連携 / frontend の凝った Achievement UI 移植（リーン最小のみ）。
