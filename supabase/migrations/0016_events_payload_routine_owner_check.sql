-- M-2: events_payload の insert / update WITH CHECK に routine_item_id 側の
--       items_meta owner EXISTS 二重防衛を追加。
--
-- WHY:
--   * 0011 で events_payload の insert/update policy は `item_id` 側の
--     items_meta owner を EXISTS でチェックするが、`routine_item_id`
--     (生成元 routine への参照) 側の owner チェックは無い。
--   * これは 0009 (tasks_payload.parent_item_id の Medium-1 対策) /
--     0014 (notes_payload.parent_item_id の同対策) と非対称で、events_payload
--     だけ防御層が 1 枚薄い状態。
--   * PostgreSQL の FK trigger は table owner 権限で動き RLS を bypass するため、
--     attacker は他ユーザー所有の Routine の id を自分の Event の
--     routine_item_id に指定して INSERT/UPDATE できる:
--       - id-existence side-channel (他人の routine id の存在判定が可能)
--       - Issue 011 の partial unique index (同一 routine + source_date の
--         重複生成防止) を他人 routine id を使って妨害できる理論的経路
--     本 migration で routine_item_id (NOT NULL の場合のみ) も自分所有を要求し、
--     両経路を封鎖する。0009/0014 の parent owner EXISTS と対称な防御に揃える。
--   * 漏洩リスクなし: 0011 の既存条件 (owner-only + item_id owner EXISTS +
--     initplan キャッシュ形式) を **1:1 で保ったまま**、routine_item_id の
--     owner EXISTS を AND で追加するだけ。アクセス可能範囲は縮小方向のみ
--     (他人 routine 参照を拒否)、正当な自分所有 routine 参照は不変。
--
-- WHAT THIS DOES:
--   1. events_payload_insert_own を DROP + CREATE。既存 WITH CHECK
--      (item_id owner EXISTS) を維持しつつ、
--      `(routine_item_id is null or exists(... owner ...))` を AND で追加。
--   2. events_payload_update_own を同型で DROP + CREATE。
--      USING ((select auth.uid()) = user_id) は 0011 のまま維持。
--
-- NOT INCLUDED:
--   * select_own / delete_own は変更不要 (0009 と同じ理由: routine_item_id の
--     所有権は SELECT/DELETE 時点では既に attacker 自身の行に対する操作なので
--     追加防衛不要)。0011 のまま維持。
--   * routine_item_role 列 / composite FK / cache trigger は 0011 で導入済。
--     本 migration は policy のみを触る。composite FK は role 整合
--     (routine_item_id が role='routine' を指すこと) を保証するが、owner
--     (user_id 一致) は保証しないため policy 側の owner EXISTS が別途必要。
--
-- IDEMPOTENCY: drop policy if exists → create policy で再 apply 安全。
--
-- APPLY MANUALLY VIA THE SUPABASE SQL EDITOR / `supabase db push`, AFTER 0015.
-- NOT YET APPLIED — ユーザー承認後に push。

begin;

-- ===========================================================================
-- 1. events_payload INSERT: item_id owner + routine_item_id owner 二重防衛
-- ===========================================================================
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
    and (
      events_payload.routine_item_id is null
      or exists (
        select 1 from public.items_meta
        where items_meta.id = events_payload.routine_item_id
          and items_meta.user_id = (select auth.uid())
      )
    )
  );

-- ===========================================================================
-- 2. events_payload UPDATE: 同型 (USING は owner-only のまま維持)
-- ===========================================================================
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
    and (
      events_payload.routine_item_id is null
      or exists (
        select 1 from public.items_meta
        where items_meta.id = events_payload.routine_item_id
          and items_meta.user_id = (select auth.uid())
      )
    )
  );

commit;

-- ===========================================================================
-- POST-APPLY VERIFICATION (run after commit):
-- ===========================================================================
-- A. events_payload の insert/update with_check に routine_item_id owner
--    EXISTS が追加されているか確認:
--    select policyname, with_check
--    from pg_policies
--    where schemaname = 'public'
--      and tablename = 'events_payload'
--      and policyname in ('events_payload_insert_own', 'events_payload_update_own')
--    order by policyname;
--    -- expect: with_check に items_meta.id = events_payload.item_id の EXISTS と
--    --         items_meta.id = events_payload.routine_item_id の EXISTS が両方含まれ、
--    --         routine_item_id IS NULL の OR 分岐がある。全て `( SELECT auth.uid() AS uid)`。
--
-- B. routine_item_id NULL の手動 Event は INSERT 成功 (回帰確認)
--    insert into items_meta (id, role, title) values ('event-m2-test', 'event', 'M2');
--    insert into events_payload (item_id, routine_item_id, start_at)
--      values ('event-m2-test', null, '2026-01-01T09:00:00');
--    -- expect: 両 INSERT 成功
--    delete from items_meta where id = 'event-m2-test';
--
-- C. 自分所有 routine を指す Event は INSERT 成功
--    insert into items_meta (id, role, title) values ('routine-m2-own', 'routine', 'M2R');
--    insert into routines_payload (item_id) values ('routine-m2-own');
--    insert into items_meta (id, role, title) values ('event-m2-own', 'event', 'M2E');
--    insert into events_payload (item_id, routine_item_id, start_at)
--      values ('event-m2-own', 'routine-m2-own', '2026-01-01T09:00:00');
--    -- expect: 全 INSERT 成功
--    delete from items_meta where id in ('event-m2-own', 'routine-m2-own');
--    -- (他人 routine_item_id ケースは別 user 擬似が必要なため web/E2E 側で
--    --  spot check: 別ブラウザ・別 auth の routine id を routine_item_id に
--    --  指定 → WITH CHECK 違反で RLS が拒否されることを確認)
--
-- D. Supabase advisor 再取得で events_payload に新規 WARN が出ないこと
--    (auth_rls_initplan は 0 件のまま、追加 EXISTS も (select auth.uid()) 形式)
