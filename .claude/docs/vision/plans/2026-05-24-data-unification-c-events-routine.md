---
Status: Draft v1
Created: 2026-05-24
Branch: data-unification/items-meta-redesign
Owner-chat: main
Parent: .claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md
Previous: .claude/docs/vision/plans/2026-05-23-data-unification-b3-onwards-impl.md
---

# Plan: Data Unification — DU-C (Events role + Routine + RoutineGroup)

> 親計画書 (2026-05-21-data-unification-items-meta.md) の Phase 表 DU-C 行を具体化した子計画書。
> Routines / RoutineGroups / RoutineGroupAssignments / ScheduleItems の 4 Service を
> `items_meta + <role>_payload` 2-row 操作へ書き換え、Routine 由来 Event 自動生成 (`useScheduleItemsRoutineSync`) を復活させる。

---

## Context

### 動機

- DU-C/D pending stubs 投入後の実機検証で「Routine 削除→key duplicate 警告→無限ループ」バグが顕在化 (2026-05-23 chat-main HISTORY)。stub throw → ScheduleView の rollback ロジックが routine を append → 同一 key を持つ row が両方残る。
- 根本原因 = Routines/ScheduleItems Service が stub のまま。DU-C 本実装 = 根本治療。
- 同時に RoutineScheduleSync を no-op 化中 (web/src/schedule/RoutineScheduleSync.tsx)。DU-C 完了で復活。

### 制約

- 親計画書 DB 戦略 = ハイブリッド (items_meta + payload) / Q9 = 専用列厚く / Q11 = Routine 詳細仕様は DU-C 子計画書で確定 (=本ファイル)
- DU-B-3 で確立した DB-Q1/Q2/Q3 (R2 try/catch / mapper bump / composite FK NO ACTION) を Events / Routines に踏襲
- コスト $0 厳守 — Supabase 既存 DDL 拡張のみ、新規エクステンション不要
- main 直接 push 禁止 / pathspec commit / 並行チャット (chat-refactor 等) の未コミット変更を巻き込まない
- 0011 migration は **ローカルファイル先行 → ユーザー `supabase db push`** ルール厳守 (apply_migration MCP 単独使用禁止)

### Non-goals

- DU-D (Notes/Daily) — 別子計画書
- DU-E (Calendar 2 ビュー) — 別子計画書
- DU-F (WikiTag) — 別子計画書
- MCP Server 32 ツールの events_payload 対応 — 親計画書「MCP catch-up plan」へ
- reminder_at timestamptz への型統一 — 段階的、本計画では Phase 2 ScheduleItem 型互換 (reminderEnabled+reminderOffset) を維持
- Routine 生成 conflict 解決 UX — partial UNIQUE で重複防止のみ。既存 Event 上書きルールは DU-E

---

## Scope (Touchable Paths)

```
shared/src/services/routineMapper.ts
shared/src/services/routineGroupMapper.ts
shared/src/services/routineGroupAssignmentMapper.ts
shared/src/services/scheduleItemMapper.ts
shared/src/services/SupabaseDataService.ts   (lines 759–1076 のみ — SupabaseRoutinesService / RoutineGroups / Assignments / ScheduleItems スタブ群)
shared/src/utils/routineScheduleSync.ts      (events_payload 出力先アダプタ追加のみ。純粋ロジック維持)
shared/tests/routineMapper.test.ts            (新規)
shared/tests/scheduleItemMapper.test.ts       (新規)
supabase/migrations/0011_du_c_events_payload_fk.sql       (新規)
supabase/migrations/0011_rollback.sql                     (新規)
web/src/schedule/RoutineScheduleSync.tsx     (no-op → 本実装復活、Step 6)
web/src/schedule/useScheduleItemsRoutineSync.ts (catch ブロック外の notifyChanged を内に移動 = ハードニング、Step 6)
.claude/docs/vision/plans/2026-05-24-data-unification-c-events-routine.md  (本ファイル)
.claude/docs/vision/db-conventions.md         (§10 拡張 / 必要時)
.claude/docs/known-issues/02X-*.md            (発生時のみ追加)
.claude/memory/chat-main.md / .claude/history/chat-main.md (task-tracker 経由)
```

スコープ外: `frontend/**` (旧 Tauri / chat-refactor 領域) / `cloud/db/migrations/**` (D1 領域、Supabase と独立) / 他 Service (Tasks / Notes / Calendars)。

---

## Steps

| #   | Step                                                                                    | Gate    | Acceptance                                                                                                           |
| --- | --------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | DU-C-1: 0011 migration ファイル作成 (events composite FK + sync trigger + initplan RLS) | 🛑 人手 | ユーザー `supabase db push` 通過 / `list_tables verbose=true` で composite FK + trigger 確認                         |
| 2   | DU-C-2: 4 mapper を payload 構造に書き換え (+ vitest 必須ケース)                        | 🤖 自律 | shared `npx tsc -b` 緑 / shared `npm test` 緑 / roundtrip 各 mapper 5 shape 以上                                     |
| 3   | DU-C-3: SupabaseRoutinesService 7 methods 本実装                                        | 🤖 自律 | shared `npx tsc -b` 緑 / DU-B-3 と同 pattern (DB-Q1 try/catch / DB-Q2 mapper bump / DB-Q3 descendants-first delete)  |
| 4   | DU-C-4: SupabaseRoutineGroups + Assignments 6 methods 本実装                            | 🤖 自律 | shared `npx tsc -b` 緑 / assignments の Issue 008 同型 soft-delete-aware delta query 維持                            |
| 5   | DU-C-5: SupabaseScheduleItemsService 14 methods 本実装 (events_payload 経由)            | 🤖 自律 | shared `npx tsc -b` 緑 / web `npm run build` 緑 / bulkCreate が partial UNIQUE 衝突を ON CONFLICT で吸収             |
| 6   | DU-C-6: RoutineScheduleSync 復活 + useScheduleItemsRoutineSync ハードニング             | 👀 目視 | Routine 作成 → 当日 Event 自動生成 / Routine 削除で key duplicate 警告ゼロ / catch ブロック内に notifyChanged 移動済 |
| 7   | DU-C-7: docs / known-issues 更新 + 本計画書 archive                                     | 🤖 自律 | db-conventions §10 に events_payload 案 A 完成記録 / 子計画書 Status=COMPLETED で .claude/archive/ へ                |

### Gate 凡例

- **🤖 自律** — Claude が完結。`npx tsc -b` / `npm test` / `npm run build` で検証
- **👀 目視** — UI 動作 (ループ消失 / Event 自動生成) はユーザー確認必須
- **🛑 人手** — `supabase db push` (Step 1)、DDL 適用後の DB state 確認

---

## Acceptance Criteria (機械検証可能)

- [ ] `cd shared && npx tsc -b` exit 0
- [ ] `cd shared && npm test` 全 pass (DU-B-4 の 91 件 + DU-C-2 の routineMapper/scheduleItemMapper 新規テスト)
- [ ] `cd web && npm run build` exit 0
- [ ] Supabase events_payload に `routine_item_role` generated 列が存在 (`list_tables verbose=true`)
- [ ] Supabase events_payload composite FK `(routine_item_id, routine_item_role) → items_meta(id, role)` 存在
- [ ] Supabase items_meta UPDATE トリガで events_payload.is_deleted_cache が同期される (SQL で 1 row テスト)
- [ ] Supabase events_payload / routines_payload / routine_groups / routine_group_assignments の RLS policy 全てが `(select auth.uid())` initplan キャッシュ形式
- [ ] golden path: Routine 作成 → 当日 Event 自動生成 / Routine softDelete → 由来 Event 同時削除 / Routine 復元 → Event 再生成 (👀 目視)

---

## DB Migration Notes

### 0011_du_c_events_payload_fk.sql の内容

**ローカルファイル先行ルール (MANDATORY)**:

1. Claude が `supabase/migrations/0011_du_c_events_payload_fk.sql` を作成 + SQL 記入
2. **ユーザー** が `supabase db push` 実行
3. Claude が `list_tables verbose=true` + 動作 SQL で確認

SQL 内容 (4 ブロック):

```sql
-- (1) events_payload に routine_item_role generated 列 + composite FK (NO ACTION)
ALTER TABLE public.events_payload
  ADD COLUMN routine_item_role text GENERATED ALWAYS AS ('routine') STORED;
-- ↑ Issue 021 知見: generated stored 列を FK ターゲットに使う場合は SET NULL/CASCADE 不可 → NO ACTION

ALTER TABLE public.events_payload
  ADD CONSTRAINT events_payload_routine_fk
  FOREIGN KEY (routine_item_id, routine_item_role)
  REFERENCES public.items_meta (id, role)
  ON UPDATE NO ACTION ON DELETE NO ACTION;
-- ↑ items_meta(id, role) UNIQUE 制約は DU-B 0009 で追加済

-- (2) items_meta.is_deleted → events_payload.is_deleted_cache 同期トリガ (案 A 完成)
CREATE OR REPLACE FUNCTION public.sync_events_payload_is_deleted_cache()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.is_deleted IS DISTINCT FROM OLD.is_deleted THEN
    UPDATE public.events_payload
    SET is_deleted_cache = NEW.is_deleted
    WHERE item_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_items_meta_sync_events_cache
AFTER UPDATE OF is_deleted ON public.items_meta
FOR EACH ROW EXECUTE FUNCTION public.sync_events_payload_is_deleted_cache();

-- (3) events_payload INSERT 時の is_deleted_cache 初期化トリガ
CREATE OR REPLACE FUNCTION public.init_events_payload_is_deleted_cache()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  SELECT is_deleted INTO NEW.is_deleted_cache
  FROM public.items_meta WHERE id = NEW.item_id;
  IF NEW.is_deleted_cache IS NULL THEN NEW.is_deleted_cache := false; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_events_payload_init_cache
BEFORE INSERT ON public.events_payload
FOR EACH ROW EXECUTE FUNCTION public.init_events_payload_is_deleted_cache();

-- (4) RLS initplan キャッシュ (DU-B-1 0010 同型 — auth.uid() を (select auth.uid()) でラップ)
-- 対象: events_payload / routines_payload / routine_groups / routine_group_assignments の各 4 policy (合計 16 policy)
-- DROP POLICY + CREATE POLICY の組で書く (PG は ALTER POLICY USING のみで全文置換不可)
-- ... (略 — Step 1 で全文展開)
```

### 0011_rollback.sql の内容

```sql
DROP TRIGGER IF EXISTS trg_events_payload_init_cache ON public.events_payload;
DROP TRIGGER IF EXISTS trg_items_meta_sync_events_cache ON public.items_meta;
DROP FUNCTION IF EXISTS public.init_events_payload_is_deleted_cache();
DROP FUNCTION IF EXISTS public.sync_events_payload_is_deleted_cache();
ALTER TABLE public.events_payload DROP CONSTRAINT IF EXISTS events_payload_routine_fk;
ALTER TABLE public.events_payload DROP COLUMN IF EXISTS routine_item_role;
-- RLS policy は 0010 の initplan-cache 形式から元の auth.uid() 直書きに戻す
-- (rollback 用 SQL は Step 1 で全文展開)
```

---

## 主要設計判断

### routineMapper の書き換え方針

- 既存 Phase 2 `routineMapper.ts` の RoutineRow を **2 row 分解**: `ItemsMetaRow (role=routine)` + `RoutinesPayloadRow`
- DU-B taskMapper と同 pattern: `rowsToRoutineNode(meta, payload)` / `routineNodeToRows(node) → {meta, payload}` / `routineUpdatesToPatches(updates) → {metaPatch, payloadPatch}`
- DB-Q2 enforcement: `metaPatch.updated_at = now()` を mapper 内で常時注入 (taskMapper §10.2 同型)
- payload 専用列 (frequency_type / frequency_days / start_time / end_time 等) は routines_payload に保持
- title / is_deleted / deleted_at / version / created_at / updated_at は items_meta に保持

### scheduleItemMapper の書き換え方針

- 既存 `ScheduleItemRow` を **2 row 分解**: `ItemsMetaRow (role=event)` + `EventsPayloadRow`
- ScheduleItem 型 (frontend) は維持 — `reminderEnabled` / `reminderOffset` は events_payload に列追加 (0011 では追加せず Phase 2 互換用に時間計算で吸収するか、列追加するかは Step 2 着手時に確定)
- routine_item_id / source_date / is_dismissed は events_payload に保持
- title / is_deleted / deleted_at は items_meta に保持

### SupabaseScheduleItemsService の本実装方針

- `fetchScheduleItemsByDateAll` / `fetchScheduleItemsByDate`: items_meta JOIN events_payload (events_payload.start_at = $date)、join-in-app pattern
- `createScheduleItem` / `bulkCreateScheduleItems`: items_meta INSERT → events_payload INSERT。R2 失敗時 items_meta hard delete (DU-B-3 createTask 同型 try/catch)
- bulkCreate は `events_payload.upsert({onConflict: "routine_item_id,source_date", ignoreDuplicates: true})` で partial UNIQUE 衝突を吸収 (Issue 011 後継の冪等性保証)
- `softDeleteScheduleItem` / `restoreScheduleItem`: items_meta.is_deleted UPDATE のみ。0011 同期トリガが events_payload.is_deleted_cache を自動同期
- `updateFutureScheduleItemsByRoutine`: events_payload WHERE routine_item_id = X AND start_at >= $fromDate を UPDATE + items_meta.updated_at bump

### Routine 削除→Event 連動削除の責務

- `softDeleteRoutine(routine_id)`: items_meta.is_deleted=true on routine row → 0011 同期トリガが連動しない (events 用トリガは items_meta.id=event_item_id でフィルタするため routine_id では発火しない)
- → アプリ層 (`softDeleteRoutine` メソッド) 内で events_payload WHERE routine_item_id = X の items_meta を別途 soft-delete する必要あり
- 戻り値 `{ deletedScheduleItemIds: string[] }` を維持 (frontend 互換)

### RoutineScheduleSync 復活手順 (DU-C-6)

1. `web/src/schedule/RoutineScheduleSync.tsx` の `return null` を取り消し、Phase 2 実装を復元 (git history から逆引き)
2. `useScheduleItemsRoutineSync.ts:116-118` の `if (toCreate.length > 0) notifyChanged()` を try ブロック内に移動 (catch ブロック外で発火していた = 無限ループ landmine — 修正済 7fd7100 履歴参照)
3. bulkCreate 成功時のみ notifyChanged を発火する条件分岐に変更 (失敗時の rollback ループ防止)

---

## Risks / Known Issues 参照

| ID  | リスク                                                               | レベル | 緩和策                                                                                 |
| --- | -------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| C1  | composite FK 追加時の既存 routine 由来 Event 行で INSERT 失敗        | 低     | 現状 events_payload rows=0 なので問題なし (Supabase MCP で確認済)                      |
| C2  | partial UNIQUE 衝突時の bulkCreate 挙動                              | 中     | `events_payload.upsert({onConflict, ignoreDuplicates:true})` で吸収。Issue 011 知見    |
| C3  | items_meta hard delete 時の events_payload 孤児 (FK NO ACTION)       | 中     | softDeleteRoutine が events_payload の routine_item_id を持つ rows を先に soft delete  |
| C4  | RoutineScheduleSync 復活時の無限ループ再発                           | 高     | useScheduleItemsRoutineSync の notifyChanged を try 内に移動 (DU-C-6 ハードニング必須) |
| C5  | reminder_at vs reminderEnabled/Offset の型変換ミス                   | 中     | Step 2 着手時に列追加で簡略化するか時間計算で吸収するか確定                            |
| C6  | parallel chat (chat-refactor) の SupabaseDataService.ts 同時編集     | 中     | pathspec commit / Step 完了ごとに rebase 確認                                          |
| C7  | DU-B 0010 と同じ「auth.uid() ラップ漏れ」が DU-C policies で発生する | 中     | 0011 内で全 16 policy を一括 DROP+CREATE。Step 1 で SQL レビュー必須                   |

### 既存 known-issues 参照

- `021-pg-generated-composite-fk-set-null-forbidden.md` — generated 列を FK ターゲットにする時の制約 (Step 1 で踏まないように)
- `022-supabase-sql-editor-postgres-role-auth-uid-null.md` — SQL Editor 経由のテストが false-negative になる落とし穴
- `023-supabase-cli-csv-output-rejection.md` — `list_migrations` の出力フォーマット (Step 1 適用後の確認手順)
- `011-routine-duplicate-generation.md` (Phase 2) — partial UNIQUE 設計の起源

### 新規 known issue 化候補

- DU-C 完了時に「RoutineScheduleSync の notifyChanged を try 内に置く」設計判断を `02X-routine-sync-notify-position.md` として化、または coding-principles に統合
- bulkCreate の ON CONFLICT 戦略を db-conventions §10.7 として追加

---

## References

- 親計画書: `.claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md`
- 前フェーズ: `.claude/docs/vision/plans/2026-05-23-data-unification-b3-onwards-impl.md` (DU-B-3〜B-6 詳細実装プラン)
- vision: `.claude/docs/vision/db-conventions.md` §10 (Payload Mapper 規約)
- vision: `.claude/docs/vision/coding-principles.md` §4–§5 (Provider Pattern A / DataService 抽象化)
- 既存純粋関数 (再利用): `shared/src/utils/routineFrequency.ts` / `shared/src/utils/routineScheduleSync.ts`
- related skills: `db-migration` (Step 1) / `task-tracker` (Step 完了ごと) / `git-orchestrator` (commit/push) / `session-verifier` (各 Step 完了時)
- 失敗履歴: chat-main HISTORY 2026-05-23 「Schedule 無限ループ修正」(landmine 経路 6 ステップ記載)

---

## Worklog

(実装中に判明した設計判断や、計画から逸脱した部分を時系列で追記。完了後に Known Issue 化すべき知見はここから docs/known-issues/ へ移送)

- 2026-05-24: 子計画書 v1 ドラフト作成。DB の partial UNIQUE は既存 / composite FK と同期トリガと initplan-cache RLS が未適用と確認 → 0011 へ集約方針確定
