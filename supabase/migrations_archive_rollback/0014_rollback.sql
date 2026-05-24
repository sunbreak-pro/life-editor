-- DU-D Step 5 rollback: revert 0014_notes_payload_parent_fk.sql.
--
-- Restores the 0008-shape notes_payload (single-col FK, no parent_item_role,
-- 0008-shape RLS without parent_item_id EXISTS hardening).
--
-- Apply MANUALLY VIA SQL Editor only if 0014 needs to be rolled back. NOT
-- run by `supabase db push`. The items_meta (id, role) UNIQUE added by
-- 0009 is left in place (DU-B still depends on it).

begin;

-- 1. Restore 0008-shape policies (drop the hardened versions, recreate
--    the original ones — no parent_item_id EXISTS, raw auth.uid()).
drop policy if exists notes_payload_insert_own on public.notes_payload;
create policy notes_payload_insert_own
  on public.notes_payload
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = notes_payload.item_id
        and items_meta.user_id = auth.uid()
    )
  );

drop policy if exists notes_payload_update_own on public.notes_payload;
create policy notes_payload_update_own
  on public.notes_payload
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = notes_payload.item_id
        and items_meta.user_id = auth.uid()
    )
  );

-- 2. Restore single-col index (drop the compound, recreate the single).
create index if not exists idx_notes_payload_parent
  on public.notes_payload (parent_item_id);

drop index if exists public.idx_notes_payload_parent_role;

-- 3. Drop composite FK + generated column, restore single-col FK.
alter table public.notes_payload
  drop constraint if exists notes_payload_parent_fk;

alter table public.notes_payload
  drop column if exists parent_item_role;

alter table public.notes_payload
  add constraint notes_payload_parent_item_id_fkey
    foreign key (parent_item_id)
    references public.items_meta (id);

-- 4. items_meta (id, role) UNIQUE is intentionally NOT dropped — 0009
--    relies on it. Removing it would break tasks_payload_parent_fk.

commit;
