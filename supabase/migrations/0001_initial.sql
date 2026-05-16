-- Phase 1 initial schema: tasks table only.
-- Apply after the Supabase project is created (do NOT run before that).
-- Full schema (Schedule / Notes / Daily / WikiTags) lands in 0002 (Phase 1 step 10).
--
-- WARNING: RLS is enabled below with NO policies = deny-all (fail-safe).
-- The anon key is public (embedded in the browser bundle), so RLS is the only
-- data guard. This file intentionally adds no policy yet; Phase 1 step 7 adds
-- `auth.uid() = user_id` policies + `user_id uuid not null default auth.uid()`.
-- Until step 7 lands, this table is unreadable/unwritable by anon/authenticated
-- by design. Do NOT put real data in / publicly deploy before step 7.

create table if not exists public.tasks (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null,
  title      text        not null,
  status     text,
  created_at timestamptz not null default now()
);

-- Fail-safe: deny-all until step 7 introduces explicit policies.
alter table public.tasks enable row level security;
