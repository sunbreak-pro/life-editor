-- 0027: #1404 — private Storage bucket `attachments` + owner-only policies for
--       the editor's image / file embeds.
--
-- WHY:
--   The slash command can now attach a picture or a file to a note. The bytes
--   cannot go in the repo (CLAUDE.md §9 の鉄則) and must not go in
--   `notes_payload` either — a base64 body would be re-read by every
--   `listNotesUnified` and would blow past the row sizes the sync cursor
--   assumes. So the bytes go to Storage and the TipTap document stores only
--   the object PATH.
--
-- WHY PRIVATE, unlike `sounds`:
--   The `sounds` bucket (W3-C) is public because its five ambient loops are
--   the same for everybody. These objects are the user's own notes — a
--   screenshot dropped into a private journal must not be readable by anyone
--   who has the URL. The client therefore reads through
--   `createSignedUrl` (1 hour, shared/src/constants/attachments.ts) and never
--   stores a URL in the document.
--
-- THE PATH SHAPE IS THE AUTHORISATION:
--   Every object is written as `<uid>/<uuid>.<ext>` by
--   SupabaseAttachmentsService, and every policy below authorises a row only
--   when `(storage.foldername(name))[1]` equals the caller's uid. There is no
--   owner column to check — `storage.objects.owner` records who uploaded a
--   row, which is not the same statement and is nullable for objects written
--   with a service key. Changing the naming rule in the service without
--   changing these policies makes every upload fail with a policy error, and
--   vice versa; the two are one contract.
--
-- $0 GUARD:
--   `file_size_limit` = 10 MiB, matching ATTACHMENT_MAX_BYTES in
--   shared/src/constants/attachments.ts. The Supabase free plan gives 1 GB of
--   file storage, 5 GB of monthly egress and a 50 MB hard ceiling per upload
--   (supabase.com/pricing, checked 2026-09-01), so this is a deliberate floor
--   far under the ceiling: a client that skips its own check still cannot
--   spend more than the plan allows, and 100 files is the whole budget.
--
-- IDEMPOTENCY: `on conflict do nothing` + `drop policy if exists` → create,
--   so a re-apply is safe.
--
-- APPLY MANUALLY: LOCAL FILE FIRST → ユーザーが `supabase db push`
--   (apply_migration MCP の単独使用禁止 / CLAUDE.md §7.3 Plan Gate Convention)。
--   バケット作成とポリシー投入は DDL push と同枠の 🛑 人手ゲート (#1404)。
--
-- NOT IN THE REALTIME PUBLICATION: `storage.objects` is not a domain table and
--   nothing subscribes to it (shared/tests/syncRealtimeTables.test.ts reads the
--   publication out of 0017 + its deltas; this file adds none).

-- ---------------------------------------------------------------------------
-- 1. The bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 10485760)
on conflict (id) do nothing;

-- Re-apply onto a bucket created by hand (or by an earlier run with a
-- different limit) still converges on the values above. `public` especially:
-- a bucket flipped public by accident is the one mistake here that silently
-- undoes the privacy the signed-URL path exists for.
update storage.buckets
   set public = false,
       file_size_limit = 10485760
 where id = 'attachments';

-- `allowed_mime_types` is deliberately left NULL (= no restriction). The
-- client decides what it offers to upload; a server-side allow-list would have
-- to be edited every time the author wants to attach a file type nobody
-- thought of, and it protects nothing extra — the bucket is private and only
-- its owner can read it.

-- ---------------------------------------------------------------------------
-- 2. Owner-only policies on storage.objects, scoped to this bucket
-- ---------------------------------------------------------------------------
-- RLS on storage.objects is enabled by Supabase itself; this migration only
-- adds the four policies for `attachments`. `(select auth.uid())` rather than a bare
-- `auth.uid()` so the planner evaluates it once as an initplan instead of per
-- row — the same convention 0019 applied across the public schema.

drop policy if exists attachments_select_own on storage.objects;
create policy attachments_select_own
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists attachments_insert_own on storage.objects;
create policy attachments_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- UPDATE needs BOTH clauses: `using` decides which rows may be targeted,
-- `with check` decides what they may become. Without the second, a caller
-- could rename their own object into somebody else's folder.
drop policy if exists attachments_update_own on storage.objects;
create policy attachments_update_own
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists attachments_delete_own on storage.objects;
create policy attachments_delete_own
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
