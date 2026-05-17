-- Phase 2 S3-1: notes domain full schema — notes (versioned, hierarchy,
-- soft-delete, password gate) + note_links (versioned) + note_connections
-- (relation, physical-delete).
--
-- APPLY VIA SUPABASE MCP: the main chat applies this with the Supabase
-- MCP `apply_migration` (write) tool — NOT `supabase db push`, NOT a
-- manual SQL Editor paste. The CLI migration-history table is absent on
-- this project and the non-timestamped `0001..` naming makes `db push` a
-- silent no-op (same operational constraint as 0001/0002/0003/0004 — see
-- supabase/README.md / the Phase 1 + S1 + S2 handoff; SQL-Editor
-- hand-paste is retired). The file is idempotent
-- (`drop table if exists ... cascade` + `create`), so re-applying it
-- (e.g. an `apply_migration` retry) is safe. NOT YET APPLIED — the main
-- chat applies it only after the S0 RLS gate + QA sign-off.
--
-- POST-APPLY READ-ONLY VERIFICATION (run after apply_migration to prove
-- the RLS guard landed; expect 4 policy rows + rowsecurity = true PER
-- TABLE):
--   select tablename, policyname, cmd from pg_policies
--     where schemaname='public'
--       and tablename in ('notes','note_links','note_connections')
--     order by tablename, policyname;
--   select relname, relrowsecurity from pg_class
--     where oid in ('public.notes'::regclass,
--                   'public.note_links'::regclass,
--                   'public.note_connections'::regclass);
--
-- SOURCE OF TRUTH for the column sets: the frontend type contracts, which
-- are the canonical column design here (frontend/src/services/data/notes.ts
-- is a thin Tauri-invoke passthrough and carries no column shape):
--   * notes              -> frontend/src/types/note.ts  (NoteNode)
--   * note_links         -> frontend/src/types/noteLink.ts  (NoteLink)
--   * note_connections   -> frontend/src/types/wikiTag.ts  (NoteConnection,
--                           ~L40 — id / sourceNoteId / targetNoteId /
--                           createdAt only)
--
-- SYNC CLASSIFICATION (.claude/docs/vision/db-conventions.md §3-4):
--   * notes       = VERSIONED. PK `id`, has `version`, soft-delete. The
--                   db-conventions doc uses `notes` itself as the
--                   canonical versioned example (§4 "versioned tables"
--                   UPSERT-on-id LWW + §3.3 `(id, version)` health check).
--   * note_links  = VERSIONED. noteLink.ts carries `version` + `isDeleted`
--                   + `deletedAt`; sync stamps it on `id`, LWW like notes.
--   * note_connections = RELATION. Minimal join row (NoteConnection has
--                   ONLY id / sourceNoteId / targetNoteId / createdAt — no
--                   version, no soft-delete). Deleted physically (the
--                   Tauri service exposes a hard `delete` /
--                   `delete_by_note_pair`, no is_deleted flag), so it is a
--                   relation table, NOT versioned. created_at is its only
--                   timestamp; sync pulls it via the parent note's
--                   updated_at (db-conventions §4 "relation tables").
--
-- Postgres adaptations (identical conventions to 0003 tasks / 0004
-- dailies):
--   * `id text primary key` — client-generated string
--     (`note-<uuid>` / `notefolder-<uuid>`, CLAUDE.md §4.3), NOT a uuid.
--     note_links / note_connections ids are likewise client strings.
--   * `user_id uuid not null default auth.uid()` — server-derived owner,
--     never written by the client (S1/S2 pattern; RLS guard below). Added
--     to ALL THREE tables so the leak gate's owner-scoped policy holds
--     even on the relation table.
--   * `has_password boolean generated always as (password_hash is not
--     null) stored` on notes — a Postgres GENERATED column, NOT a raw SQL
--     expression in the PostgREST `select=` (PostgREST only projects real
--     column names; a computed boolean MUST exist physically). This is
--     the S2 recurrence-prevention learning (0004 dailies has_password is
--     the exact template). It is read-only: the data layer must NEVER
--     include it in an INSERT/UPSERT payload (Postgres rejects a
--     non-DEFAULT write to a generated column); the noteMapper reads
--     `has_password` by plain name while raw `password_hash` is never
--     selected back.
--   * INTEGER 0/1 flags -> real `boolean` (is_pinned / is_edit_locked /
--     is_deleted). noteLink.ts types `isDeleted` as `number` (SQLite 0/1)
--     and `version` as `number`; in Postgres these become `boolean` /
--     `integer` — the data-layer mapper coerces, same as 0004.
--   * TEXT timestamps -> `timestamptz`. created_at/updated_at NOT NULL
--     default now() where always-set; deleted_at / note_links.updated_at
--     nullable (noteLink.ts: `updatedAt: string | null`).
--   * `version integer not null default 1` on notes + note_links —
--     bumped on every mutation by the data layer (LWW input), mirroring
--     the SQLite `version = version + 1`.
--
-- SECURITY (Phase 1 carry-over #1): the anon key is public (shipped in
-- the browser bundle). RLS is the ONLY data guard. This single file
-- contains each table, `enable row level security`, AND its four
-- owner-only policies so NO table can ship RLS-naked
-- (supabase/README.md "no split" rule, identical to 0003/0004). Every
-- policy is `to authenticated` + a clean `auth.uid() = user_id` owner
-- equality (no `or true` / unscoped predicate / anon|public grant), so
-- supabase/scripts/check-rls.sql passes with NO allowlist entry
-- (offenders = 0) for all three tables.

-- ===========================================================================
-- 1. notes  (VERSIONED)
-- ===========================================================================

-- Defensive idempotent rebuild. `cascade` drops dependent FKs (note_links
-- / note_connections reference notes) and any prior policy. Order matters:
-- drop the children FIRST so the parent drop does not need to cascade them
-- in an unexpected order on re-apply.
drop table if exists public.note_connections cascade;
drop table if exists public.note_links cascade;
drop table if exists public.notes cascade;

create table public.notes (
  -- Identity / hierarchy. `id` = client-generated `note-<uuid>` /
  -- `notefolder-<uuid>` (CLAUDE.md §4.3). Self-referential parent_id for
  -- the folder/note tree (NoteNode.parentId).
  id             text        primary key,
  user_id        uuid        not null default auth.uid(),
  type           text        check (type in ('folder','note')),
  title          text        not null default '',
  content        text        not null default '',          -- TipTap JSON string
  parent_id      text        references public.notes(id),
  "order"        integer     not null default 0,

  -- UI / state flags (SQLite INTEGER 0/1 -> boolean).
  is_pinned      boolean     not null default false,
  is_edit_locked boolean     not null default false,

  -- Presentation.
  color          text,
  icon           text,

  -- Optional password gate. Stored verbatim per the Tauri contract; the
  -- mapper NEVER projects this column back to the client (only the
  -- derived `has_password` GENERATED column just below). NoteNode
  -- deliberately exposes only `hasPassword`.
  password_hash  text,

  -- Derived, read-only owner-visible flag. A Postgres GENERATED column so
  -- PostgREST can project it by plain name in `select=` (PostgREST does
  -- NOT evaluate raw SQL expressions in `select=`). `stored` so it is
  -- materialised + indexable. The data layer MUST NOT write this column
  -- (Postgres rejects a non-DEFAULT INSERT/UPSERT into it); the password
  -- is mutated only via `password_hash` set/remove paths.
  has_password   boolean     generated always as (password_hash is not null) stored,

  -- Soft-delete (CLAUDE.md §4.4 — Notes are TrashView-restorable).
  is_deleted     boolean     not null default false,
  deleted_at     timestamptz,

  -- Timestamps.
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Versioning (data layer bumps on every mutation; LWW input).
  version        integer     not null default 1
);

create index if not exists idx_notes_user        on public.notes (user_id);
create index if not exists idx_notes_parent       on public.notes (parent_id);
create index if not exists idx_notes_deleted      on public.notes (is_deleted);
create index if not exists idx_notes_updated_at   on public.notes (updated_at);

-- RLS: the only data guard (anon key is public). Enable + owner-only.
alter table public.notes enable row level security;

-- Owner-only CRUD policies. `to authenticated` rejects the anon role at
-- the role layer (defense in depth); `auth.uid() = user_id` is a clean
-- owner equality with no short-circuit, so the leak-detection gate
-- (supabase/scripts/check-rls.sql) passes without an allowlist row
-- (byte-identical detector shape to 0003/0004's four policies).
drop policy if exists notes_select_own on public.notes;
create policy notes_select_own
  on public.notes
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists notes_insert_own on public.notes;
create policy notes_insert_own
  on public.notes
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists notes_update_own on public.notes;
create policy notes_update_own
  on public.notes
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists notes_delete_own on public.notes;
create policy notes_delete_own
  on public.notes
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ===========================================================================
-- 2. note_links  (VERSIONED)
-- ===========================================================================
-- frontend/src/types/noteLink.ts NoteLink. A link's source is EITHER a
-- note (source_note_id) OR a daily memo (source_memo_date) — both
-- nullable, mutually exclusive at the app layer. target_note_id is the
-- only required ref. Versioned (version + is_deleted + deleted_at), sync
-- stamps on `id` LWW like notes.
create table public.note_links (
  id              text        primary key,
  user_id         uuid        not null default auth.uid(),

  -- Source: a note OR a daily-memo date (mutually exclusive, both null
  -- never both set at the app layer). FK only on the note side; the
  -- memo-date string is not a referenceable PK.
  source_note_id  text        references public.notes(id),
  source_memo_date text,

  -- Target: always a note. FK to notes.
  target_note_id  text        not null references public.notes(id),
  target_heading  text,
  target_block_id text,

  -- Presentation / link semantics.
  alias           text,
  link_type       text        not null default 'inline'
                              check (link_type in ('inline','embed')),

  -- Timestamps. updated_at is nullable (noteLink.ts: `string | null`).
  created_at      timestamptz not null default now(),
  updated_at      timestamptz,

  -- Soft-delete + versioning (VERSIONED table; LWW on id).
  is_deleted      boolean     not null default false,
  deleted_at      timestamptz,
  version         integer     not null default 1
);

create index if not exists idx_note_links_user        on public.note_links (user_id);
create index if not exists idx_note_links_source_note on public.note_links (source_note_id);
create index if not exists idx_note_links_source_memo on public.note_links (source_memo_date);
create index if not exists idx_note_links_target_note on public.note_links (target_note_id);
create index if not exists idx_note_links_deleted     on public.note_links (is_deleted);
create index if not exists idx_note_links_updated_at  on public.note_links (updated_at);

-- RLS: the only data guard (anon key is public). Enable + owner-only.
alter table public.note_links enable row level security;

drop policy if exists note_links_select_own on public.note_links;
create policy note_links_select_own
  on public.note_links
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists note_links_insert_own on public.note_links;
create policy note_links_insert_own
  on public.note_links
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists note_links_update_own on public.note_links;
create policy note_links_update_own
  on public.note_links
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists note_links_delete_own on public.note_links;
create policy note_links_delete_own
  on public.note_links
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ===========================================================================
-- 3. note_connections  (RELATION — physical delete, no version/soft-delete)
-- ===========================================================================
-- frontend/src/types/wikiTag.ts NoteConnection (~L40): EXACTLY id /
-- sourceNoteId / targetNoteId / createdAt. The Tauri service
-- (frontend/src/services/data/notes.ts) exposes a HARD delete /
-- delete_by_note_pair — no is_deleted flag — so this is a relation table:
-- no `version`, no soft-delete columns. user_id is still added so the
-- owner-scoped RLS policy holds (the leak gate's owner-table heuristic
-- requires an auth.uid()-scoped policy on any table exposing user_id).
-- Sync pulls it via the parent note's updated_at (db-conventions §4
-- "relation tables") since it has no updated_at of its own.
create table public.note_connections (
  id              text        primary key,
  user_id         uuid        not null default auth.uid(),
  source_note_id  text        not null references public.notes(id),
  target_note_id  text        not null references public.notes(id),
  created_at      timestamptz not null default now()
);

create index if not exists idx_note_connections_user        on public.note_connections (user_id);
create index if not exists idx_note_connections_source_note on public.note_connections (source_note_id);
create index if not exists idx_note_connections_target_note on public.note_connections (target_note_id);

-- RLS: the only data guard (anon key is public). Enable + owner-only.
alter table public.note_connections enable row level security;

drop policy if exists note_connections_select_own on public.note_connections;
create policy note_connections_select_own
  on public.note_connections
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists note_connections_insert_own on public.note_connections;
create policy note_connections_insert_own
  on public.note_connections
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists note_connections_update_own on public.note_connections;
create policy note_connections_update_own
  on public.note_connections
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists note_connections_delete_own on public.note_connections;
create policy note_connections_delete_own
  on public.note_connections
  for delete
  to authenticated
  using (auth.uid() = user_id);
