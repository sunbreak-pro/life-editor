-- Phase 1 step 7: RLS policies for public.tasks.
--
-- 0001 created the table and enabled RLS with NO policies (deny-all,
-- fail-safe). This migration:
--   1. Forces user_id to default to auth.uid() so a client can never
--      insert a row attributed to another user (the client never sends
--      user_id at all; the column is server-derived from the JWT).
--   2. Adds the four CRUD policies, each scoped to auth.uid() = user_id.
--
-- The anon key is public (shipped in the browser bundle). RLS is the
-- ONLY data guard — every policy below intentionally requires an
-- authenticated user whose JWT subject matches the row's user_id.
--
-- Idempotent: column default is unconditionally re-set; each policy is
-- dropped (if present) before being recreated, so re-applying is safe.
--
-- Each policy is also scoped `to authenticated` (defense-in-depth): the
-- anon role is rejected at the role layer, not only by the auth.uid()
-- expression, so a future policy-expression change can't silently open
-- an anon path.

-- 1. Server-derived ownership. Clients must NOT pass user_id; this
--    default binds every inserted row to the caller's JWT subject.
alter table public.tasks
  alter column user_id set default auth.uid();

-- 2. CRUD policies — owner-only access.

drop policy if exists tasks_select_own on public.tasks;
create policy tasks_select_own
  on public.tasks
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists tasks_insert_own on public.tasks;
create policy tasks_insert_own
  on public.tasks
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists tasks_update_own on public.tasks;
create policy tasks_update_own
  on public.tasks
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists tasks_delete_own on public.tasks;
create policy tasks_delete_own
  on public.tasks
  for delete
  to authenticated
  using (auth.uid() = user_id);
