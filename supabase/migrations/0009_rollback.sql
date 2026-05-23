-- DU-B-1 ROLLBACK: 0009_tasks_payload_parent_fk.sql を巻き戻す (v2 対応版)。
--
-- 用途:
--   * 0009 apply 後に DU-B-2 以降で致命的な不整合が見つかり、DB スキーマ
--     を 0008 時点に戻したい場合に手動 SQL Editor で実行する。
--   * 0009 apply 中の中途失敗で部分 apply 状態になった場合の手動回収にも
--     使える（drop ... if exists で冪等）。
--
-- WHAT IT DOES (0009 で行った 7 操作の対称巻き戻し):
--   1. tasks_payload policy 2 本 (insert_own / update_own) を 0008 形に
--      戻す (Medium-1 拡張を巻き戻し)。
--   2. composite FK (tasks_payload_parent_fk) を drop。
--   3. generated 列 parent_item_role を drop。
--   4. items_meta (id, role) UNIQUE を drop。
--   5. 0008 時点の単独 FK (parent_item_id -> items_meta(id)) を再 add。
--   6. R6 緩和の補助 index 2 本を drop。
--   7. 0008 の単独 index `idx_tasks_payload_parent` を復元 (Low-A 巻き戻し)。
--
-- IDEMPOTENCY: 全て if exists / drop ... if exists 利用で再 apply 安全。
--
-- 重要な注意:
--   * 0009 で追加した parent_item_role 列を drop した場合、shared/ 側の
--     SupabaseTasksService が parent_item_role を SELECT に含めていると
--     「列不在」エラーで Tasks 機能が止まる。Rollback 実行前に必ず
--     DU-B-2/3 のコード変更も同時に git revert すること。
--   * 再 0009 apply 前に違反行 0 件を確認:
--       SELECT t.item_id, t.parent_item_id, m.role FROM tasks_payload t
--         JOIN items_meta m ON m.id=t.parent_item_id
--        WHERE m.role <> 'task';
--     (security-reviewer Info-A 反映)

begin;

-- ===========================================================================
-- 1. tasks_payload policy を 0008 の形に戻す (Medium-1 巻き戻し)
-- ===========================================================================
drop policy if exists tasks_payload_insert_own on public.tasks_payload;
create policy tasks_payload_insert_own
  on public.tasks_payload
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = tasks_payload.item_id
        and items_meta.user_id = auth.uid()
    )
  );

drop policy if exists tasks_payload_update_own on public.tasks_payload;
create policy tasks_payload_update_own
  on public.tasks_payload
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = tasks_payload.item_id
        and items_meta.user_id = auth.uid()
    )
  );

-- ===========================================================================
-- 2. composite FK drop
-- ===========================================================================
alter table public.tasks_payload
  drop constraint if exists tasks_payload_parent_fk;

-- ===========================================================================
-- 3. parent_item_role generated 列 drop
-- ===========================================================================
alter table public.tasks_payload
  drop column if exists parent_item_role;

-- ===========================================================================
-- 4. items_meta (id, role) UNIQUE drop
-- ===========================================================================
alter table public.items_meta
  drop constraint if exists items_meta_id_role_uk;

-- ===========================================================================
-- 5. 0008 時点の単独 FK 復元
-- ===========================================================================
alter table public.tasks_payload
  drop constraint if exists tasks_payload_parent_item_id_fkey;

alter table public.tasks_payload
  add constraint tasks_payload_parent_item_id_fkey
    foreign key (parent_item_id)
    references public.items_meta (id);

-- ===========================================================================
-- 6. R6 緩和の補助 index drop
-- ===========================================================================
drop index if exists public.items_meta_role_isdel_idx;
drop index if exists public.idx_tasks_payload_parent_role;

-- ===========================================================================
-- 7. 0008 の単独 index `idx_tasks_payload_parent` 復元 (Low-A 巻き戻し)
-- ===========================================================================
create index if not exists idx_tasks_payload_parent
  on public.tasks_payload (parent_item_id);

commit;

-- ===========================================================================
-- POST-ROLLBACK VERIFICATION:
-- ===========================================================================
-- A. composite FK が drop 済
--    select conname from pg_constraint
--    where conrelid = 'public.tasks_payload'::regclass
--      and conname in ('tasks_payload_parent_fk');
--    -- expect: 0 rows
--
-- B. parent_item_role 列が drop 済
--    select column_name from information_schema.columns
--    where table_name = 'tasks_payload' and column_name = 'parent_item_role';
--    -- expect: 0 rows
--
-- C. items_meta UNIQUE が drop 済
--    select conname from pg_constraint
--    where conrelid = 'public.items_meta'::regclass
--      and conname = 'items_meta_id_role_uk';
--    -- expect: 0 rows
--
-- D. 単独 FK が復元済
--    select conname from pg_constraint
--    where conrelid = 'public.tasks_payload'::regclass
--      and conname = 'tasks_payload_parent_item_id_fkey';
--    -- expect: 1 row
--
-- E. policy が 0008 の形 (parent EXISTS なし) に戻っているか確認
--    select policyname, pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
--    from pg_policies, pg_policy
--    where tablename = 'tasks_payload' and policyname in
--      ('tasks_payload_insert_own', 'tasks_payload_update_own');
--    -- expect: with_check が item_id 側 EXISTS のみ含み parent_item_id 側
--    -- EXISTS は含まない (Medium-1 巻き戻し済)
--
-- F. 0008 単独 index が復元済
--    select indexname from pg_indexes
--    where tablename = 'tasks_payload' and indexname = 'idx_tasks_payload_parent';
--    -- expect: 1 row
