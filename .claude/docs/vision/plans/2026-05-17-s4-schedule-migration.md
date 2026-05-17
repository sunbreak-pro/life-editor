---
Status: IN PROGRESS — S4-0/S4-1 完了（0006 7 テーブル + mapper 7 種、QA/security PASS）。次 S4-2 SupabaseDataService。並行チャット同居のため本ファイルが S4 自レーン SSOT
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

## sync 区分判定（軸 1、S4-0 で確定済）

| テーブル                  | sync 区分（確定）                                             | 0006 での扱い                                                                                                                   |
| ------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| routines                  | versioned（soft-delete 完備）                                 | id PK + version + is_deleted/deleted_at                                                                                         |
| routine_groups            | versioned（version 有 / **soft-delete 無 = 物理削除**）       | id PK + version。**is_deleted 列を作らない**（frontend schema 乖離防止）                                                        |
| routine_group_assignments | relation + soft-delete（version 無）                          | id PK + updated_at + is_deleted/deleted_at。UNIQUE(routine_id,group_id)。soft-delete-aware delta（Issue 008）                   |
| schedule_items            | versioned + 論理一意                                          | id PK + version + is_deleted。`(routine_id,date) WHERE routine_id IS NOT NULL AND is_deleted=false` partial UNIQUE（Issue 011） |
| calendars                 | versioned（version 有 / **soft-delete 無 = 物理削除**）       | id PK + version。**is_deleted 列を作らない**。folder_id FK tasks(id)                                                            |
| calendar_tag_definitions  | versioned（V65 で sync 列付与）                               | **id integer generated always as identity**（CalendarTag.id=number 契約、UUID 化不可）。S4-6 必須（cta FK 先）                  |
| calendar_tag_assignments  | relation（version/soft-delete 共に無 = 物理削除 polymorphic） | id PK + updated_at。UNIQUE(entity_type,entity_id)=1:1。note_connections 同型 delta                                              |

全テーブル RLS enable + owner-only 4policy + `user_id default auth.uid()` 必須（relation の rga/cta/definitions にも user_id 付与＝owner policy 成立、note_connections 同型）。

### S4-0 確定事項（S4-1 実装の前提・厳守）

- **routine_groups / calendars に is_deleted/deleted_at を作らない**（frontend は version 有・物理削除のみ。soft-delete 列追加は schema 乖離 = S2/S3 の「frontend 型が正本」原則違反）
- **date/start_time/end_time は `text` 厳守**（`date`/`timestamptz` 型は PostgREST が TZ 変換し JST 境界で日付ズレ。frontend 純粋関数は `new Date(d+"T00:00:00")`=ローカル一貫で UTC 変換無し）。created_at/updated_at は timestamptz 可。`routine.frequency_days` は DB text(JSON文字列) ↔ TS `number[]` を mapper 内 parse（roundtrip で JSON 配列往復を必ずカバー）
- **`updateScheduleItem` は Issue 020 パターン適用**（read-then-write を単一 UPSERT-on-id LWW に置換、`noteUpdatesToPatch` whitelist patch 雛形）。生成器フック/純粋関数は改変禁止だが DataService 実装層（S4-2）で 020 を敷く
- **CalendarTag.id は integer identity**（number 契約。UUID 化不可。mapper は number↔integer 素通し）
- **0006 ヘッダ apply 運用 = 手動 SQL Editor**（MCP write 凍結中 = MEMORY 申し送り⑥。0005 ヘッダの「MCP apply」文言は陳腐化。0005 も実際は手動適用済）
- `ensureRoutineItemsForDateRange` は件数上限無し（既存仕様・改変禁止）。冪等性の最終防波堤＝schedule_items partial UNIQUE。S4-5 QA で月高速連打時の生成件数を観測

## スキーマ依存順（軸 2、S4-0 で 7 テーブルに修正）

0006 内 CREATE 順（FK 先行）: 1.calendars → 2.routines → 3.routine_groups → 4.routine_group_assignments(→3,2 cascade) → 5.schedule_items(→2 SET NULL、partial UNIQUE) → 6.calendar_tag_definitions → 7.calendar_tag_assignments(→6 cascade、task/schedule_item polymorphic は FK 張らず entity_type CHECK)。各直後に RLS+4policy。drop は逆順 cascade（cta→definitions→schedule_items→rga→routine_groups→routines→calendars）。

## Routine 生成仕様（軸 3）

frontend 既存ロジック（読み取り参照のみ・不可侵）:

- `frontend/src/utils/routineScheduleSync.ts`（純粋関数 `diffRoutineScheduleItems`/`shouldCreateRoutineItem`/`collectRoutineItemsForDates`）→ `shared/src/utils/` へ移植（改変しない）
- `frontend/src/utils/routineFrequency.ts`（`shouldRoutineRunOnDate`）→ `shared/src/utils/` へ
- `frontend/src/hooks/useScheduleItemsRoutineSync.ts`（生成器フック `ensureRoutineItemsForDate(Range)`）→ `shared/src/hooks/`、`getDataService()` 直呼びはコールバック注入化（§6.4。useNotesAPI パターン）
- 生成トリガー配線は `web/src/schedule/`

**Issue 017 両系統ガード（最重要・S4-5 で必須）**: (a) schedule_items/tasks の by-date/range クエリに `.eq('is_deleted', false)` 必須 (b) Routine 削除時に routine_id 一致 schedule_items を明示削除（掃除漏れ＝無限復活）(c) `(routine_id,date)` partial UNIQUE（Issue 011）(d) `shouldCreateRoutineItem` の isDeleted/isArchived/!isVisible 弾きロジックは改変しない。生成器 update は Issue 020（read-then-write 406 race）と同 pattern が schedule_items にも該当しうる点に注意。

## Steps（サブステップ分割境界 = 1 PR に抱えない）

- [x] **S4-0 調査**（role-engineer read-only・2026-05-17 完了）: スキーマ正本特定（SQLite full_schema+v61_plus V69 / D1 0001+0004+0007 / shared/src/types 既存 forward-port 済）。sync 区分 7 テーブル確定、is_deleted 非作成 2 テーブル、date/time text 厳守、updateScheduleItem 020 適用、CalendarTag integer identity、生成仕様 timezone/先読み/レース解消。ブロッカー無し（上記「S4-0 確定事項」に反映済）
- [x] **S4-1 migration + mapper**（2026-05-17 完了）: 0006（7 テーブル + RLS 4policy×7 + partial UNIQUE、手動 SQL Editor ヘッダ）+ mapper 7 種 + roundtrip 16/16 + vitest 54/54。**role-qa PASS（Blocker0 Major0、Minor2/Nit1=申し送り反映済）+ security-reviewer PASS（Critical0 High0 Medium0、Low1=N=1 実害無）**。check-rls selftest 20/20・全述語照合 offender0。frontend/src-tauri/cloud diff0 非破壊
- [ ] **S4-2 SupabaseDataService**: routines/groups/assignments/schedule_items/calendars/cta の Proxy throw 置換。relation の soft-delete-aware delta（Issue 008）。→ role-qa
- [ ] **S4-3 RoutineProvider**: shared context(Pattern A)+hooks + web ミニ UI。Provider 依存順先頭。→ role-qa
- [ ] **S4-4 ScheduleItemsProvider**: schedule_items CRUD + 論理一意（Issue 011）。**Routine 生成は含めない**。→ role-qa
- [ ] **S4-5 Routine 生成器**: 純粋関数 shared 移植 + 生成器フック。**Issue 017 両系統ガード専用 QA**。→ role-qa（017 再発を専用検証）
- [ ] **S4-6 Calendar + CalendarTags**: calendars + **calendar_tag_definitions（本体・必須）** + calendar_tag_assignments（polymorphic）+ Mobile Optional バリアント（CalendarTags は Mobile 省略 Provider）。→ role-qa

各サブステップ末: session-verifier（web `tsc -b`/eslint/vite build、shared `tsc -b`+vitest）→ pathspec commit。S4-3 以降は Provider 依存順のため直列（並列不可）。

## Files

| File / Dir                                                                                                                                                                                                             | Operation | Notes                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------- |
| `supabase/migrations/0006_schedule_full_schema.sql`                                                                                                                                                                    | Add ✅    | 7 テーブル単一 + RLS 4policy×7 + partial UNIQUE。手動 SQL Editor ヘッダ。QA/security PASS |
| `shared/src/services/SupabaseDataService.ts`                                                                                                                                                                           | Edit      | schedule 系 Proxy throw → 実装（S4-2）。relation soft-delete-aware delta                  |
| `shared/src/services/{routine,routineGroup,routineGroupAssignment,scheduleItem,calendar,calendarTagDefinition,calendarTagAssignment}Mapper.ts` + `scheduleMapper.roundtrip.ts` + `shared/tests/scheduleMapper.test.ts` | Add ✅    | mapper 7 種 + roundtrip 16/16 + vitest 54/54 PASS                                         |
| `shared/src/context/{Routine,ScheduleItems,CalendarTags}Context*`                                                                                                                                                      | Add       | Pattern A 3 ファイル。Mobile 省略 Provider は Optional バリアント                         |
| `shared/src/hooks/use{Routine,ScheduleItems,CalendarTags}*.ts`                                                                                                                                                         | Add       | DataService コールバック注入                                                              |
| `shared/src/utils/{routineScheduleSync,routineFrequency}.ts`                                                                                                                                                           | Add       | frontend 純粋関数の忠実移植（改変禁止）                                                   |
| `web/src/schedule/*`                                                                                                                                                                                                   | Add       | リーン新規ミニ UI + 生成トリガー配線                                                      |
| `frontend/` `src-tauri/` `cloud/`                                                                                                                                                                                      | 不可侵    | 読み取りのみ                                                                              |
| `.claude/docs/vision/plans/2026-05-17-s4-schedule-migration.md`                                                                                                                                                        | Edit      | 本 SSOT。サブステップ完了で [x]                                                           |
| `.claude/docs/vision/plans/2026-05-16-phase2-core-migration.md`                                                                                                                                                        | Edit      | S4 完了時に [x] 化（並行チャット競合回避でパス指定）                                      |

## Verification

- [ ] 6 テーブル mapper roundtrip vitest green（shared）
- [ ] `check-rls.sql` 静的 offender0（6 テーブル全 RLS+4policy）/ security-reviewer Critical0
- [ ] Routine 生成: 削除後に schedule_items が復活しない（Issue 017）/ `(routine_id,date)` 重複なし（Issue 011）/ soft-deleted 非表示
- [ ] relation（assignments/cta）が delta sync で is_deleted 反映（Issue 008）
- [ ] web `tsc -b` / eslint / vite build green、`frontend/`/`src-tauri/`/`cloud/` diff 0（非破壊）
- [ ] 実ブラウザ Schedule CRUD/Routine 生成/Calendar 表示 = 次セッション（0006 本番 apply 後）

## 申し送り / 後続追跡（S4-1 監査由来）

- **reminder_time forward-port 債務（QA Minor 2）**: main の commit `284ae73`（V71 + D1 0008）が tasks/schedule_items/routines に `reminder_time` を追加済だが、本ブランチ基底 `c817c61` に未到達のため 0006 は当該列を含まない（本ブランチ時点では正しい）。`refactor/web-first-v2` rebase / main 取込時に 0006 へ追補 or 後続 migration で追加すること。S4-2 着手時に再確認
- **論理 UNIQUE が user_id 非包含（security Low 1）**: `uq_schedule_items_routine_date` / `cta UNIQUE(entity_type,entity_id)` / `ctd UNIQUE(name)` は user_id を含まずグローバル。N=1（作者のみ Cloud Sync、CLAUDE.md §1 Non-Goals マルチテナント）で実害ゼロ。将来マルチユーザー化時のみ `UNIQUE(user_id, ...)` 化 TODO（apply ブロッカーではない）
- **ctd の sync full-replicate 整合（QA Minor 1）**: calendar_tag_definitions は VERSIONED_TABLES 外＝full-replicate 扱いのため Supabase 側で is_deleted 等を意図的 drop（0006 ヘッダに理由追記済）。S4-6（ctd 本体実装）の QA で full-replicate 経路の整合を再検証対象に
- **0006 apply 後**: ヘッダ L24-40 の post-verify クエリ（7 テーブル×4policy 行 + relrowsecurity=true）を実 DB で必ず実行（次セッション・実ブラウザ確認時）

## スコープ外（クリープ防止）

CalendarTag 本体「機能拡張」（新規プロパティ追加等。忠実移植の calendar_tag_definitions は S4-6 スコープ内） / WikiTags(S5) / Realtime(S8) / オフラインバナー(S7) / Analytics 連携 / frontend の凝った Achievement UI 移植（リーン最小のみ）。
