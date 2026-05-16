-- Phase 2 S2-1: dailies full schema (text id = `daily-<YYYY-MM-DD>`,
-- single-table UPSERT-on-date model, soft-delete, versioned).
--
-- APPLY VIA SUPABASE MCP: the main chat applies this with the Supabase
-- MCP `apply_migration` (write) tool — NOT `supabase db push`, NOT a
-- manual SQL Editor paste. The CLI migration-history table is absent on
-- this project and the non-timestamped `0001..` naming makes `db push` a
-- silent no-op (same operational constraint as 0001/0002/0003 — see
-- supabase/README.md / the Phase 1 + S1 handoff; SQL-Editor hand-paste is
-- retired by the S2 directive). The file is idempotent
-- (`drop table if exists ... cascade` + `create`), so re-applying it
-- (e.g. an `apply_migration` retry) is safe.
--
-- POST-APPLY READ-ONLY VERIFICATION (run after apply_migration to prove
-- the RLS guard landed; expect 4 rows + rowsecurity = true):
--   select policyname, cmd from pg_policies
--     where schemaname='public' and tablename='dailies' order by policyname;
--   select relrowsecurity from pg_class
--     where oid = 'public.dailies'::regclass;
--
-- SOURCE OF TRUTH for the column set: the Tauri SQLite `dailies` table
-- (src-tauri/src/db/migrations/v61_plus.rs V64 — `memos` renamed to
-- `dailies`, identical shape) and the Rust `DailyNode` projection
-- (src-tauri/src/db/daily_repository.rs). Postgres adaptations:
--   * `has_password boolean generated always as (password_hash is not
--     null) stored` — a Postgres GENERATED column (NOT a raw SQL
--     expression in the PostgREST `select=`; PostgREST only accepts real
--     column names, so the derived boolean must exist physically). This
--     is what lets the mapper read `has_password` as a plain column while
--     the raw `password_hash` is never selected back. It is read-only:
--     the data layer must NEVER include it in an INSERT/UPSERT payload
--     (Postgres rejects a non-DEFAULT write to a generated column).
--   * `id TEXT PRIMARY KEY`  — client-generated `daily-<date>` string,
--     NOT a uuid (CLAUDE.md §4.3 DailyNode id strategy).
--   * `user_id uuid not null default auth.uid()` — server-derived owner,
--     never written by the client (S1 pattern; RLS guard below).
--   * `date text not null unique` — the natural upsert key. The app does
--     `upsert ... on conflict (date)`; a UNIQUE constraint on `date` is
--     what makes that conflict target valid (the SQLite table had
--     `date TEXT NOT NULL UNIQUE`).
--   * INTEGER 0/1 boolean flags -> real `boolean` (is_deleted /
--     is_pinned / is_edit_locked).
--   * TEXT timestamps -> `timestamptz` (created_at / updated_at /
--     deleted_at). NOT NULL + default now() on the two always-set
--     columns; deleted_at nullable.
--   * `password_hash text` — kept exactly as the Tauri contract: the
--     value the backend stores/compares verbatim. The domain DailyNode
--     deliberately exposes only `hasPassword`; that boolean is served by
--     the `has_password` GENERATED column above (= password_hash IS NOT
--     NULL), so the raw hash itself is never selected back to the client
--     by the dailyMapper. (Pre-existing plaintext-equality weakness
--     carried over 1:1 — NOT changed here, flagged for security review;
--     the S2 plan mandates parity, not a crypto redesign.)
--   * `version integer not null default 1` — bumped on every mutation by
--     the data layer, mirroring the SQLite `version = version + 1`.
--
-- There is no prior `dailies` table in 0001/0002/0003 (Phase 1 shipped
-- only `tasks`), so this is a clean create after a defensive drop.
--
-- SECURITY (Phase 1 carry-over #1): the anon key is public (shipped in
-- the browser bundle). RLS is the ONLY data guard. This single file
-- contains the table, `enable row level security`, AND the four
-- owner-only policies so the table can never ship RLS-naked
-- (supabase/README.md "no split" rule, identical to 0003). Every policy
-- is `to authenticated` + a clean `auth.uid() = user_id` owner equality
-- (no `or true` / unscoped predicate / anon|public grant), so the
-- check-rls.sql gate passes with NO allowlist entry (offenders = 0).

-- 1. Defensive idempotent rebuild. `cascade` drops any dependent policy.
drop table if exists public.dailies cascade;

create table public.dailies (
  -- Identity. `id` = client-generated `daily-<YYYY-MM-DD>` (CLAUDE.md
  -- §4.3); `date` is the natural UPSERT conflict key (UNIQUE, like the
  -- SQLite source). One row per calendar day.
  id             text        primary key,
  user_id        uuid        not null default auth.uid(),
  date           text        not null unique,
  content        text        not null default '',

  -- State flags (SQLite INTEGER 0/1 -> boolean).
  is_pinned      boolean     not null default false,
  is_edit_locked boolean     not null default false,

  -- Optional password gate. Stored verbatim per the Tauri contract; the
  -- mapper NEVER projects this column back to the client (only the
  -- derived `has_password` GENERATED column just below).
  password_hash  text,

  -- Derived, read-only owner-visible flag. A Postgres GENERATED column so
  -- PostgREST can project it by plain name in `select=` (PostgREST does
  -- NOT evaluate raw SQL expressions in `select=`). `stored` so it is
  -- materialised + indexable. The raw `password_hash` is therefore never
  -- selected back to the client. The data layer MUST NOT write this
  -- column (Postgres rejects a non-DEFAULT INSERT/UPSERT into it); the
  -- password is mutated only via `password_hash` set/remove paths.
  has_password   boolean     generated always as (password_hash is not null) stored,

  -- Soft-delete (CLAUDE.md §4.4 — Dailies are TrashView-restorable).
  is_deleted     boolean     not null default false,
  deleted_at     timestamptz,

  -- Timestamps.
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Versioning (data layer bumps on every mutation; LWW input).
  version        integer     not null default 1
);

create index if not exists idx_dailies_user       on public.dailies (user_id);
create index if not exists idx_dailies_date        on public.dailies (date);
create index if not exists idx_dailies_deleted     on public.dailies (is_deleted);
create index if not exists idx_dailies_updated_at  on public.dailies (updated_at);

-- 2. RLS: the only data guard (anon key is public). Enable + owner-only.
alter table public.dailies enable row level security;

-- 3. Owner-only CRUD policies. `to authenticated` rejects the anon role
--    at the role layer (defense in depth); `auth.uid() = user_id` is a
--    clean owner equality with no short-circuit, so the leak-detection
--    gate (supabase/scripts/check-rls.sql) passes without an allowlist
--    row (byte-identical detector shape to 0003's four policies).
drop policy if exists dailies_select_own on public.dailies;
create policy dailies_select_own
  on public.dailies
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists dailies_insert_own on public.dailies;
create policy dailies_insert_own
  on public.dailies
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists dailies_update_own on public.dailies;
create policy dailies_update_own
  on public.dailies
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists dailies_delete_own on public.dailies;
create policy dailies_delete_own
  on public.dailies
  for delete
  to authenticated
  using (auth.uid() = user_id);
