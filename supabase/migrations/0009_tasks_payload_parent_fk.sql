-- DU-B-1: tasks_payload composite FK for cross-role parent prevention
--         + parent_item_id ownership EXISTS hardening (security-reviewer Medium-1)
--         + redundant single-col index cleanup (security-reviewer Low-A).
--
-- WHY (parent plan「parent_item_id 設計判断」+ DU-B 子計画書 DB-Q3 確定):
--   tasks_payload.parent_item_id は items_meta(id) を指す。items_meta は 5
--   role (task / event / routine / note / daily) が同居するテーブルなので、
--   アプリ層のバグや SQL 直叩きで Note や Event の id を誤って Task の
--   parent に入れる余地が 0008 の単独 FK では残る。DU-B-1 はこれを DB
--   スキーマレベルで物理的に不可能にする。
--
-- WHAT THIS DOES:
--   1. items_meta に (id, role) UNIQUE 制約を追加（PK は id 単独なので
--      composite FK の参照先として別途必要）。
--   2. tasks_payload の既存単独 FK (parent_item_id -> items_meta(id)) を
--      drop し、composite FK ((parent_item_id, parent_item_role) ->
--      items_meta(id, role)) に張り替える。
--   3. tasks_payload に parent_item_role を generated stored 列として
--      追加し、常に 'task' 固定とする。これにより composite FK は parent
--      の role が 'task' でない行への参照を DB 側で拒否する。
--   4. R6 緩和の補助 index 2 本を追加 + Low-A 対応で 0008 の単独 index
--      `idx_tasks_payload_parent` を drop (複合 index `idx_tasks_payload_
--      parent_role` の prefix で代替可能、redundant)。
--   5. tasks_payload の insert/update policy を拡張: parent_item_id が
--      指す items_meta の所有者も auth.uid() であることを EXISTS で
--      二重防衛 (security-reviewer Medium-1; 0008 時点の IDOR 経路 +
--      side-channel を同時封鎖)。DU-D Notes 等でも同型を踏襲する型を確立。
--
-- WAVE (後続子計画書への波及):
--   * DU-D Notes でも同パターンを踏襲（notes_payload.parent_item_role
--     を 'note' 固定の generated 列 + composite FK + parent_item_id 側
--     EXISTS）。
--   * DU-C Events の routine_item_id は parent ではなく「生成元」を指す
--     ため対象外。RoutineGroup の親子も対象外（独立テーブル）。
--
-- ATOMICITY (DU-B 子計画書 DB-Q1):
--   本 migration は DDL のみ・データ消失なし（DU-A の破壊 reset と異なる）。
--   apply 失敗時の巻き戻しは 0009_rollback.sql を SQL Editor で実行。
--
-- IDEMPOTENCY: drop constraint if exists → add constraint パターンで
-- 再 apply 安全。add column は `drop column if exists → add column` で
-- 冪等。policy は drop policy if exists → create policy で冪等。
--
-- APPLY MANUALLY VIA THE SUPABASE SQL EDITOR, AFTER 0008. NOT YET APPLIED.

begin;

-- ===========================================================================
-- 1. items_meta (id, role) composite UNIQUE
-- ===========================================================================
-- PK は id 単独。composite FK の参照先として (id, role) ペアを UNIQUE に
-- する必要がある（PostgreSQL では FK の参照先は PK または UNIQUE 制約のある
-- 列の組合せでなければならない）。
alter table public.items_meta
  drop constraint if exists items_meta_id_role_uk;

alter table public.items_meta
  add constraint items_meta_id_role_uk unique (id, role);

-- ===========================================================================
-- 2. tasks_payload: drop existing single-col FK, add parent_item_role,
--    add composite FK
-- ===========================================================================
-- 0008 で `parent_item_id text references public.items_meta(id)` として
-- 暗黙生成された FK 名は `tasks_payload_parent_item_id_fkey`（PostgreSQL
-- 慣習名）。明示的に drop してから composite FK を張る。
alter table public.tasks_payload
  drop constraint if exists tasks_payload_parent_item_id_fkey;

-- parent_item_role は 'task' 固定の generated stored 列。Task の parent
-- は常に Task でなければならないという不変式を列レベルで表現する。
-- DROP COLUMN IF EXISTS は generated 列の再追加を冪等にするため、
-- まず drop → add の順で実行（再 apply 時にスキーマ差分が出ないように）。
alter table public.tasks_payload
  drop column if exists parent_item_role;

alter table public.tasks_payload
  add column parent_item_role text generated always as ('task') stored;

-- Composite FK: (parent_item_id, parent_item_role) -> items_meta (id, role)
-- MATCH SIMPLE (デフォルト) = parent_item_id が NULL の場合は FK チェック
-- をスキップする（ルート Task のため）。MATCH FULL は採らない。
-- ON DELETE NO ACTION (DEFAULT; 明示): 子がいる親 Task の hard-delete は
-- PG が FK violation で拒否する。アプリ層 (SupabaseTasksService.
-- permanentDeleteTask) で descendants 再帰収集 → 子から順に DELETE する
-- 責務を持つ (Tauri 同型)。
--
-- ON DELETE 動作の選択経緯 (v2 → v3 → v3-rev2):
--   * v2 SET NULL: PG が GENERATED ALWAYS STORED 列を含む composite FK
--     に SET NULL を許容せず apply エラー (SQLSTATE 42601)。
--   * v3 CASCADE: tasks_payload は cascade されるが items_meta は items_meta
--     同士に FK がないので子 items_meta が「payload なし孤児」として残留。
--     1:1 invariant を破る。
--   * v3-rev2 NO ACTION: DB-Q3 の本懐 (cross-role 防止) は FK 参照先 role
--     一致で達成済、ON DELETE 動作は本質ではない。NO ACTION なら子がいる
--     状態での親 DELETE は PG エラー = アプリのバグで孤児発生する余地が
--     DB レベルでゼロ。アプリ層は子→親の順で削除する責務 (Tauri 同型)。
--
-- ※ items_meta の soft-delete (is_deleted=true) では FK は発火しない
-- （行は残るため）。permanentDelete (= Trash 完全消去) でのみ発火。
alter table public.tasks_payload
  drop constraint if exists tasks_payload_parent_fk;

alter table public.tasks_payload
  add constraint tasks_payload_parent_fk
    foreign key (parent_item_id, parent_item_role)
    references public.items_meta (id, role)
    match simple
    on delete no action;

-- ===========================================================================
-- 3. 補助 index (DU-B 子計画書 R6 緩和 — items_meta JOIN tasks_payload の
--    fetchTaskTree クエリ性能対策)
-- ===========================================================================
-- items_meta から role=task かつ未削除の行を引く WHERE 条件用 partial index。
-- mean_exec_time 100ms 超を防ぐ事前対策。`CREATE INDEX CONCURRENTLY` は
-- transaction 内で使えないため、本 migration では通常 CREATE INDEX を使う
-- （本番データ量が増えた段階で必要なら手動で REINDEX CONCURRENTLY）。
create index if not exists items_meta_role_isdel_idx
  on public.items_meta (role, is_deleted)
  where is_deleted = false;

-- tasks_payload (parent_item_id) の複合 index。composite FK は
-- (parent_item_id, parent_item_role) を参照するため、複合 index で FK
-- lookup を高速化。Low-A 対応で 0008 の単独 index `idx_tasks_payload_
-- parent` (line 161) は drop する (複合 index の先頭列 prefix として
-- Postgres planner が単独検索にも利用可能、書込み時のコスト二重化を回避)。
create index if not exists idx_tasks_payload_parent_role
  on public.tasks_payload (parent_item_id, parent_item_role);

drop index if exists public.idx_tasks_payload_parent;

-- ===========================================================================
-- 4. tasks_payload policy 補強 — parent_item_id 側の owner EXISTS 二重防衛
--    (security-reviewer Medium-1)
-- ===========================================================================
-- 0008 の `tasks_payload_insert_own` / `_update_own` は item_id 側の
-- items_meta 所有権のみ EXISTS チェックしており、parent_item_id 側は
-- チェック漏れだった。PostgreSQL の FK trigger は table owner 権限で
-- 動き RLS を bypass するため、attacker は他ユーザー所有の Task の id を
-- 自分の Task の parent に指定して INSERT 可能 (= 整合性違反 + id 存在
-- 判定 side-channel)。本 migration で parent_item_id (NOT NULL の場合のみ)
-- も自分所有を要求し、両経路を封鎖する。
--
-- DU-D Notes でも notes_payload に対して同パターンを必ず追加すること
-- (子計画書 WAVE 節)。
-- v3-rev3: `auth.uid()` を `(select auth.uid())` でラップ
-- (Supabase advisor `auth_rls_initplan` WARN 対策 / initplan キャッシュ化)
-- 素の `auth.uid()` は行ごとに再評価されるが、`(select ...)` で囲むと PG
-- planner が initplan として 1 回だけ実行し全行で再利用 = ホットパス性能向上。
-- Supabase 公式ベストプラクティス:
--   https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
drop policy if exists tasks_payload_insert_own on public.tasks_payload;
create policy tasks_payload_insert_own
  on public.tasks_payload
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = tasks_payload.item_id
        and items_meta.user_id = (select auth.uid())
    )
    and (
      tasks_payload.parent_item_id is null
      or exists (
        select 1 from public.items_meta
        where items_meta.id = tasks_payload.parent_item_id
          and items_meta.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists tasks_payload_update_own on public.tasks_payload;
create policy tasks_payload_update_own
  on public.tasks_payload
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = tasks_payload.item_id
        and items_meta.user_id = (select auth.uid())
    )
    and (
      tasks_payload.parent_item_id is null
      or exists (
        select 1 from public.items_meta
        where items_meta.id = tasks_payload.parent_item_id
          and items_meta.user_id = (select auth.uid())
      )
    )
  );

-- select_own / delete_own は 0008 のまま維持 (parent_item_id の所有権は
-- SELECT/DELETE 時点では既に attacker 自身の行に対する操作なので追加防衛
-- 不要)。

commit;

-- ===========================================================================
-- POST-APPLY VERIFICATION (run after commit; should all return expected
-- rows / counts):
-- ===========================================================================
-- A. items_meta UNIQUE 制約が存在
--    select conname from pg_constraint
--    where conrelid = 'public.items_meta'::regclass and conname = 'items_meta_id_role_uk';
--    -- expect: 1 row
--
-- B. tasks_payload composite FK が存在 + 単独 FK が drop 済
--    select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.tasks_payload'::regclass and contype = 'f';
--    -- expect: tasks_payload_parent_fk (composite) + tasks_payload_item_id_fkey
--    --         (item_id -> items_meta) のみ。tasks_payload_parent_item_id_fkey は不在
--
-- C. parent_item_role generated 列が存在し常に 'task'
--    select column_name, generation_expression from information_schema.columns
--    where table_name = 'tasks_payload' and column_name = 'parent_item_role';
--    -- expect: 'task'::text
--
-- D. NULL parent のルート Task INSERT 可能（R5 動作確認）
--    insert into items_meta (id, role, title) values ('task-r5-test', 'task', 'R5');
--    insert into tasks_payload (item_id, task_type, status, parent_item_id)
--      values ('task-r5-test', 'task', 'NOT_STARTED', null);
--    -- expect: 両 INSERT 成功
--    delete from items_meta where id = 'task-r5-test';
--
-- E. cross-role parent への INSERT が拒否されること（DB-Q3 動作確認）
--    insert into items_meta (id, role, title) values ('note-q3-test', 'note', 'Q3');
--    insert into items_meta (id, role, title) values ('task-q3-test', 'task', 'Q3');
--    insert into tasks_payload (item_id, task_type, status, parent_item_id)
--      values ('task-q3-test', 'task', 'NOT_STARTED', 'note-q3-test');
--    -- expect: ERROR (FK violation: parent_item_role='task' but
--    --         items_meta.role='note' for note-q3-test)
--    delete from items_meta where id in ('task-q3-test', 'note-q3-test');
--
-- F. ON DELETE NO ACTION + generated 列の組合せ挙動確認 (v3-rev2)
--    (子がいる親 Task の hard-delete は FK violation で拒否される。アプリ
--    層が descendants を先に削除する責務を持つ Tauri 同型を実機確認)
--    insert into items_meta (id, role, title) values ('task-parent-h1', 'task', 'P');
--    insert into items_meta (id, role, title) values ('task-child-h1', 'task', 'C');
--    insert into tasks_payload (item_id, task_type, status, parent_item_id)
--      values ('task-parent-h1', 'task', 'NOT_STARTED', null);
--    insert into tasks_payload (item_id, task_type, status, parent_item_id)
--      values ('task-child-h1', 'task', 'NOT_STARTED', 'task-parent-h1');
--    -- F-1: 子がいる親の hard-delete はエラーで拒否される
--    delete from items_meta where id = 'task-parent-h1';
--    -- expect: ERROR (FK violation: tasks_payload_parent_fk on task-child-h1)
--    -- F-2: 子を先に消せば親も消せる (アプリ層が踏襲すべき順序)
--    delete from items_meta where id = 'task-child-h1';
--    delete from items_meta where id = 'task-parent-h1';
--    -- expect: 両方成功 (0008 cascade で tasks_payload も自動削除)
--    select count(*) from items_meta where id in ('task-parent-h1', 'task-child-h1');
--    -- expect: 0
--    select count(*) from tasks_payload where item_id in ('task-parent-h1', 'task-child-h1');
--    -- expect: 0
--
-- G. parent_item_id 側 owner EXISTS の動作確認（security-reviewer Medium-1）
--    -- 通常ケース: 自分所有の parent は INSERT 成功
--    insert into items_meta (id, role, title) values ('task-own-parent', 'task', 'OP');
--    insert into tasks_payload (item_id, task_type, status, parent_item_id)
--      values ('task-own-parent', 'task', 'NOT_STARTED', null);
--    insert into items_meta (id, role, title) values ('task-own-child', 'task', 'OC');
--    insert into tasks_payload (item_id, task_type, status, parent_item_id)
--      values ('task-own-child', 'task', 'NOT_STARTED', 'task-own-parent');
--    -- expect: 全部 INSERT 成功
--    delete from items_meta where id in ('task-own-parent', 'task-own-child');
--    -- 他人 parent ケース (SQL Editor 単独では別 user の擬似は困難。
--    -- 代替: shared/web 側で create 後、別ブラウザ・別 supabase auth で
--    -- 同 parent_item_id を指定する E2E は DU-B-3 完了後の手動 spot check)
--
-- H. RLS gate 緑（payload EXISTS ケース selftest 含む）
--    bash supabase/scripts/check-rls.sh
--    -- expect: sentinel ___RLS_GATE_OK___
--
-- I. advisor lint 0 (auth_leaked_password_protection 既知 WARN を除く)
--
-- ※ DU-B-1 タスクの DoD として、A-I 全件を SQL Editor で手動実行し、
--    結果を outbox に貼り付けること (migration-validator H2)。
