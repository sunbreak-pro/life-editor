-- DU-C-1: events_payload composite FK + cache initialiser trigger
--          + RLS initplan-cache for events / routines / routine_groups /
--            routine_group_assignments (16 policies).
--
-- WHY (子計画書 .claude/docs/vision/plans/2026-05-24-data-unification-c-events-routine.md):
--   * `events_payload.routine_item_id` は items_meta(id) の任意 role を指せる
--     状態（0008 が単独 FK で張った形）。アプリ層のバグや SQL 直叩きで Task や
--     Note の id を誤って routine_item_id に入れる余地が残る。DU-B-1 (tasks_
--     payload.parent_item_id) と同パターンで composite FK 化し「routine_item_id
--     が指すのは role='routine' の items_meta のみ」を DB レベルで物理保証する。
--   * 0008 の UPDATE trigger (`trg_sync_event_deleted_cache`) は items_meta の
--     is_deleted 変化を events_payload.is_deleted_cache に伝播する。だが INSERT
--     時の cache 初期化は default false 任せだったため、もし items_meta を
--     `is_deleted=true` で先に作って後で events_payload を INSERT すると cache
--     が false で入る。本 migration の BEFORE INSERT trigger は items_meta から
--     現在の is_deleted を読み取って同期する（保険）。
--   * 0010 で items_meta / tasks_payload は `(select auth.uid())` initplan
--     キャッシュ化を済ませた。残る events / routines / routine_groups /
--     routine_group_assignments の 16 policy も同型に揃える（Supabase advisor
--     `auth_rls_initplan` WARN 消し / ホットパス性能）。
--
-- WHAT THIS DOES:
--   1. events_payload に `routine_item_role text GENERATED ALWAYS AS ('routine')
--      STORED` 列を追加（DROP COLUMN IF EXISTS → ADD COLUMN で冪等）。
--   2. 0008 の単独 FK (`events_payload_routine_item_id_fkey`) を DROP し、
--      composite FK `(routine_item_id, routine_item_role) -> items_meta(id, role)`
--      に張り替え (NO ACTION; MATCH SIMPLE — routine_item_id が NULL の手動
--      Event は FK チェック skip)。
--   3. events_payload に BEFORE INSERT trigger `trg_events_payload_init_cache`
--      を追加: items_meta.is_deleted を読んで is_deleted_cache を初期化。
--   4. events_payload / routines_payload / routine_groups / routine_group_
--      assignments の 16 policy を DROP + CREATE で initplan キャッシュ形式に
--      置き換え（auth.uid() を (select auth.uid()) でラップ）。EXISTS 二重防衛
--      ある policy も同型ラップ。
--
-- NOT INCLUDED (重複回避):
--   * items_meta.is_deleted -> events_payload.is_deleted_cache の UPDATE 同期
--     trigger は **0008 で既に存在** (`trg_sync_event_deleted_cache`)。重複作成
--     しない。
--   * items_meta(id, role) UNIQUE 制約は **0009 で既に追加済** (`items_meta_
--     id_role_uk`)。重複追加しない。
--
-- WAVE (後続子計画書への波及):
--   * DU-D Notes でも notes_payload.parent_item_role を 'note' 固定の generated
--     列 + composite FK に張り替える際は本 migration の (1)(2) と同型を用いる。
--   * DU-E Calendar はテーブル独立 (composite FK 不要)。
--
-- IDEMPOTENCY: drop constraint/policy if exists → create で冪等。drop column
-- if exists → add column で generated 列の再追加も冪等。drop trigger if exists
-- → create trigger で trigger も冪等。
--
-- APPLY MANUALLY VIA THE SUPABASE SQL EDITOR / `supabase db push`, AFTER 0010.
-- NOT YET APPLIED — Step 1 ユーザー承認後に push.

begin;

-- ===========================================================================
-- 1. events_payload に routine_item_role generated 列追加 + composite FK
-- ===========================================================================

-- 0008 が暗黙生成した既存 single-col FK を drop（PG 慣習名）。
alter table public.events_payload
  drop constraint if exists events_payload_routine_item_id_fkey;

-- routine_item_role は 'routine' 固定の generated stored 列。Event の
-- routine_item_id は常に role=routine の items_meta を指すという不変式を
-- 列レベルで表現する。DROP → ADD で冪等。
alter table public.events_payload
  drop column if exists routine_item_role;

alter table public.events_payload
  add column routine_item_role text generated always as ('routine') stored;

-- Composite FK: (routine_item_id, routine_item_role) -> items_meta (id, role)
-- MATCH SIMPLE (DEFAULT): routine_item_id NULL の手動 Event は FK チェック skip。
-- ON DELETE NO ACTION: routine items_meta の hard-delete は events_payload に
-- 残行があれば PG が FK violation で拒否する。アプリ層
-- (`SupabaseRoutinesService.permanentDeleteRoutine`) が由来 events を先に
-- hard-delete する責務を持つ。
--
-- 注意: DU-B-1 (tasks_payload) と同じく、generated 列を含む composite FK は
-- SET NULL / CASCADE 不可 (PG SQLSTATE 42601 / KI-021)。NO ACTION 一択。
--
-- ※ items_meta の soft-delete (is_deleted=true) では FK は発火しない
-- （行は残るため）。permanentDelete (= Trash 完全消去) でのみ発火。
alter table public.events_payload
  drop constraint if exists events_payload_routine_fk;

alter table public.events_payload
  add constraint events_payload_routine_fk
    foreign key (routine_item_id, routine_item_role)
    references public.items_meta (id, role)
    match simple
    on delete no action;

-- 補助 index (composite FK lookup 高速化)。
create index if not exists idx_events_payload_routine_role
  on public.events_payload (routine_item_id, routine_item_role);

-- 0008 の idx_events_payload_routine は単独列 index で composite index の
-- prefix として代用可能 (DU-B-1 Low-A 同型処理) → drop。
drop index if exists public.idx_events_payload_routine;

-- ===========================================================================
-- 2. events_payload INSERT 時の is_deleted_cache 初期化トリガ
-- ===========================================================================
-- SECURITY INVOKER (0008 trigger と同型): 呼び出しユーザー自身の権限で動く
-- ので RLS bypass しない。set search_path で `function_search_path_mutable`
-- WARN 回避。
--
-- 0008 既存の UPDATE trigger `trg_sync_event_deleted_cache` は items_meta.
-- is_deleted の事後変化を events_payload.is_deleted_cache に伝播する。本
-- BEFORE INSERT trigger は「items_meta が既に is_deleted=true な状態で
-- events_payload を後から INSERT した場合」の保険として cache を初期化する。
create or replace function public.init_events_payload_is_deleted_cache()
  returns trigger
  language plpgsql
  security invoker
  set search_path = public, pg_temp
as $$
declare
  meta_is_deleted boolean;
begin
  select is_deleted into meta_is_deleted
    from public.items_meta
   where id = new.item_id;
  -- items_meta 行が存在しない場合 (= FK 違反になる経路) は default false で
  -- そのまま通す。PG が後段の FK チェックで弾く。
  if meta_is_deleted is null then
    new.is_deleted_cache := false;
  else
    new.is_deleted_cache := meta_is_deleted;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_events_payload_init_cache on public.events_payload;
create trigger trg_events_payload_init_cache
  before insert on public.events_payload
  for each row
  execute function public.init_events_payload_is_deleted_cache();

-- ===========================================================================
-- 3. RLS initplan キャッシュ化 (events_payload — 4 policy)
-- ===========================================================================
-- 0008 の素の `auth.uid()` を `(select auth.uid())` でラップ。EXISTS 内も同型。
drop policy if exists events_payload_select_own on public.events_payload;
create policy events_payload_select_own
  on public.events_payload
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists events_payload_insert_own on public.events_payload;
create policy events_payload_insert_own
  on public.events_payload
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = events_payload.item_id
        and items_meta.user_id = (select auth.uid())
    )
  );

drop policy if exists events_payload_update_own on public.events_payload;
create policy events_payload_update_own
  on public.events_payload
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = events_payload.item_id
        and items_meta.user_id = (select auth.uid())
    )
  );

drop policy if exists events_payload_delete_own on public.events_payload;
create policy events_payload_delete_own
  on public.events_payload
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 4. RLS initplan キャッシュ化 (routines_payload — 4 policy)
-- ===========================================================================
drop policy if exists routines_payload_select_own on public.routines_payload;
create policy routines_payload_select_own
  on public.routines_payload
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists routines_payload_insert_own on public.routines_payload;
create policy routines_payload_insert_own
  on public.routines_payload
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = routines_payload.item_id
        and items_meta.user_id = (select auth.uid())
    )
  );

drop policy if exists routines_payload_update_own on public.routines_payload;
create policy routines_payload_update_own
  on public.routines_payload
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = routines_payload.item_id
        and items_meta.user_id = (select auth.uid())
    )
  );

drop policy if exists routines_payload_delete_own on public.routines_payload;
create policy routines_payload_delete_own
  on public.routines_payload
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 5. RLS initplan キャッシュ化 (routine_groups — 4 policy)
-- ===========================================================================
-- routine_groups は dedicated テーブル (payload ではない) なので EXISTS 二重
-- 防衛は不要 (parent への参照を持たない)。素の `(select auth.uid()) = user_id`
-- のみ。
drop policy if exists routine_groups_select_own on public.routine_groups;
create policy routine_groups_select_own
  on public.routine_groups
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists routine_groups_insert_own on public.routine_groups;
create policy routine_groups_insert_own
  on public.routine_groups
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists routine_groups_update_own on public.routine_groups;
create policy routine_groups_update_own
  on public.routine_groups
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists routine_groups_delete_own on public.routine_groups;
create policy routine_groups_delete_own
  on public.routine_groups
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 6. RLS initplan キャッシュ化 (routine_group_assignments — 4 policy)
-- ===========================================================================
-- relation テーブル: routine_item_id が指す items_meta の所有者も自分である
-- ことを EXISTS で二重防衛 (0008 既存)。auth.uid() ラップを適用。
drop policy if exists routine_group_assignments_select_own on public.routine_group_assignments;
create policy routine_group_assignments_select_own
  on public.routine_group_assignments
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists routine_group_assignments_insert_own on public.routine_group_assignments;
create policy routine_group_assignments_insert_own
  on public.routine_group_assignments
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = routine_group_assignments.routine_item_id
        and items_meta.user_id = (select auth.uid())
    )
  );

drop policy if exists routine_group_assignments_update_own on public.routine_group_assignments;
create policy routine_group_assignments_update_own
  on public.routine_group_assignments
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = routine_group_assignments.routine_item_id
        and items_meta.user_id = (select auth.uid())
    )
  );

drop policy if exists routine_group_assignments_delete_own on public.routine_group_assignments;
create policy routine_group_assignments_delete_own
  on public.routine_group_assignments
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;

-- ===========================================================================
-- POST-APPLY VERIFICATION (run after commit; expected results inline):
-- ===========================================================================
-- A. events_payload composite FK が存在 + 単独 FK が drop 済
--    select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.events_payload'::regclass and contype = 'f';
--    -- expect: events_payload_routine_fk (composite) +
--    --         events_payload_item_id_fkey (item_id -> items_meta)。
--    --         events_payload_routine_item_id_fkey は不在。
--
-- B. routine_item_role generated 列が常に 'routine'
--    select column_name, generation_expression from information_schema.columns
--    where table_name = 'events_payload' and column_name = 'routine_item_role';
--    -- expect: 'routine'::text
--
-- C. cross-role routine_item_id への INSERT が拒否されること
--    insert into items_meta (id, role, title) values ('task-q-test', 'task', 'Q');
--    insert into items_meta (id, role, title) values ('event-q-test', 'event', 'Q');
--    insert into events_payload (item_id, routine_item_id, start_at)
--      values ('event-q-test', 'task-q-test', '2026-05-24');
--    -- expect: ERROR (FK violation: routine_item_role='routine' but
--    --         items_meta.role='task' for task-q-test)
--    delete from items_meta where id in ('event-q-test', 'task-q-test');
--
-- D. INSERT 時の is_deleted_cache 初期化
--    insert into items_meta (id, role, title, is_deleted)
--      values ('routine-d-test', 'routine', 'D', true);
--    insert into items_meta (id, role, title) values ('event-d-test', 'event', 'D');
--    insert into events_payload (item_id, routine_item_id, source_date)
--      values ('event-d-test', 'routine-d-test', '2026-05-24');
--    select is_deleted_cache from events_payload where item_id = 'event-d-test';
--    -- expect: false (events_payload の items_meta は is_deleted=false なので)
--    -- もし event の items_meta も is_deleted=true で作っていれば true になる。
--    delete from items_meta where id in ('event-d-test', 'routine-d-test');
--
-- E. RLS initplan キャッシュ化確認
--    select tablename, policyname, qual, with_check
--    from pg_policies
--    where schemaname = 'public'
--      and tablename in ('events_payload', 'routines_payload',
--                        'routine_groups', 'routine_group_assignments')
--    order by tablename, policyname;
--    -- expect: qual / with_check 列のいずれにも `( SELECT auth.uid() AS uid)`
--    --         を含む。素の `auth.uid()` が残っていない。
--
-- F. Supabase advisor 再取得で events / routines / routine_groups / rga の
--    auth_rls_initplan WARN が 0 件であること
--    (mcp__supabase__get_advisors type=performance)
--
-- ※ DU-C-1 タスクの DoD として、A-F 全件を SQL Editor で手動実行し、
--    結果を outbox / chat-main.md に貼り付けること。
