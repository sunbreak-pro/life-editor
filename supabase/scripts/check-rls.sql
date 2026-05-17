-- RLS leak detection gate (Phase 1 carry-over #1 / Phase 2 S0a).
--
-- The anon key is public (shipped in the browser bundle), so Row Level
-- Security is the ONLY data guard for every public table. A table that is
-- RLS-disabled, has ZERO policies, OR has a policy that is effectively
-- wide-open (granted to anon/public, an unscoped `true` predicate, or an
-- INSERT policy with no WITH CHECK) is a Critical full-row leak.
--
-- DESIGN PRINCIPLE: false positive over false negative. When in doubt the
-- gate BLOCKS. A legitimate policy that the `auth.uid()` heuristic flags
-- by mistake is escaped operationally (see "ALLOWLIST" below) — never by
-- weakening the detector. A missed leak ships an open database.
--
-- This query walks pg_catalog and returns one row per OFFENDING table.
-- `reason` values (most severe first):
--   * 'rls_disabled'            RLS never enabled                  (Critical)
--   * 'rls_enabled_no_policy'   RLS on, 0 policies                 (safe-ish*)
--   * 'policy_anon_or_public'   a policy granted to anon/public    (Critical)
--   * 'policy_unscoped_true'    SELECT/UPDATE/DELETE/ALL with qual
--                               NULL or literally `true`           (Critical)
--   * 'policy_qual_no_authuid'  permissive policy whose qual either
--                               does not reference auth.uid() OR
--                               references it without an owner
--                               equality (e.g. `auth.uid() is not
--                               null`, `true or auth.uid()=user_id`)
--                                                                  (Critical)
--   * 'insert_no_with_check'    INSERT policy WITH CHECK NULL or
--                               literally `true`                   (Critical)
--   * 'owner_table_no_authuid'  public table HAS a user_id column
--                               but ZERO auth.uid()-scoped policy
--                               BLOCKS (exit 1). It is only downgraded
--                               to WARN (allowlisted_review) when an
--                               explicit (table, this-reason) allowlist
--                               row exists. "High" = severity, not
--                               "non-blocking".               (BLOCK/Hi)
--
-- * 'rls_enabled_no_policy' (deny-all, e.g. 0001 before 0002) is locked
--   down — not leaking — but is still surfaced as an offender so the gate
--   blocks an unusable table from shipping. The wrapper treats ANY data
--   row as a fail; tune the wrapper, not this query, if a deny-all table
--   must be allowed through intentionally.
--
-- Scope: ordinary + partitioned BASE TABLES in `public` only (relkind in
-- ('r','p')). Supabase / Postgres internal objects live in other schemas
-- (auth, storage, realtime, extensions, supabase_migrations, ...) and are
-- NOT touched (nspname = 'public' filter). Views, SECURITY DEFINER
-- functions, foreign tables, and the table-owner RLS bypass
-- (relforcerowsecurity unset) are OUT OF SCOPE — see supabase/README.md
-- "Gate scope (what this does NOT catch)".
--
-- PG 15/17 (Supabase) column names: pg_policies exposes
-- qual / with_check / roles / permissive / cmd.
--
-- ALLOWLIST: a legitimate policy that does not literally contain
-- `auth.uid()` (e.g. it calls a SECURITY DEFINER helper that wraps
-- auth.uid(), or scopes via a join table) will trip
-- 'policy_qual_no_authuid' / 'owner_table_no_authuid'. Do NOT relax the
-- heuristic. Instead document the exception: add a (table_name, reason)
-- pair to the _rls_gate_allowlist VALUES list below WITH a one-line
-- justification in the reason text. The allowlist is keyed on the
-- COMPOUND (table_name, reason): only the offending reason that was
-- explicitly reviewed is downgraded to the WARN-only reason
-- 'allowlisted_review'. A different/new offence on the same table (e.g.
-- 'policy_anon_or_public') still BLOCKS — table-wide exemption is
-- deliberately impossible. The gate still reports downgraded rows
-- (visibility) without blocking the push.
--
-- Contract for the wrapper script:
--   * the LAST row is always the sentinel  '___RLS_GATE_OK___'
--   * sentinel only            -> every public table is safe   (exit 0)
--   * >=1 non-sentinel row     -> at least one leak/offender    (exit 1)
--   * no sentinel at all       -> query did not run             (exit 2)

with
  -- Operational allowlist, COMPOUND-keyed on (table_name, why_reason).
  -- `why_reason` MUST be one of the detector reason strings
  -- ('policy_qual_no_authuid', 'owner_table_no_authuid', ...) — it is
  -- matched against _offenders.reason, NOT free text. Add a row ONLY with
  -- a justification appended after the reason via the comment. ONLY the
  -- matching (table, reason) offence is downgraded to 'allowlisted_review';
  -- every other offence on that same table still BLOCKS (no table-wide
  -- exemption). Empty allowlist => every offender keeps its real reason
  -- and the gate exits 1.
  _rls_gate_allowlist (table_name, why_reason) as (
    values
      -- ('example_table', 'policy_qual_no_authuid')  -- scoped via SECURITY DEFINER fn current_org(), reviewed 2026-05-16
      (null::name, null::text)
  ),

  -- Every public base/partitioned table + its RLS flag.
  _tables as (
    select
      c.oid            as reloid,
      c.relname        as table_name,
      c.relrowsecurity as rls_enabled
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n
      on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')   -- ordinary + partitioned base tables
  ),

  -- Per-table policy rollups (all from pg_policies, public schema only).
  _pol as (
    select
      pol.tablename                                            as table_name,
      count(*)                                                 as policy_count,
      -- (A) any policy granted to anon/public.
      bool_or(pol.roles && array['anon','public']::name[])     as has_anon_public,
      -- (B) unscoped predicate on a read/mutate command.
      bool_or(
        pol.cmd in ('SELECT','DELETE','UPDATE','ALL')
        and (
              pol.qual is null
           or lower(btrim(pol.qual)) in ('true','(true)')
        )
      )                                                        as has_unscoped_true,
      bool_or(
        lower(btrim(coalesce(pol.with_check,''))) in ('true','(true)')
      )                                                        as has_check_true,
      -- (B') permissive policy whose qual does NOT owner-scope. Ways a
      --      permissive policy leaks despite "looking" guarded:
      --        1. qual never mentions auth.uid() at all, OR
      --        2. qual mentions auth.uid() but NOT in an owner equality
      --           (e.g. `auth.uid() is not null`, `auth.uid() <> x`), OR
      --        3. qual contains an OR-with-`true` short-circuit
      --           (`true or auth.uid()=user_id`, `... or true`) that
      --           makes the whole predicate vacuously true even though
      --           the literal substring `auth.uid()=user_id` is present.
      --      Heuristic — biased to over-report. The owner-equality escape
      --      is intentionally loose (any auth.uid()/user_id equality,
      --      either order) BUT is itself revoked when an `or true` /
      --      `true or` short-circuit is detected (case 3) so the
      --      disjunction cannot smuggle a wide-open policy past the
      --      escape. A legitimate non-equality owner scope is escaped via
      --      the allowlist, never by relaxing this predicate. `or true` /
      --      `true or` never appears in a correctly-scoped owner policy,
      --      so flagging it is safe-side. See README "False positives".
      bool_or(
        pol.permissive = 'PERMISSIVE'
        and pol.qual is not null
        and (
              pol.qual not ilike '%auth.uid()%'
           or (
                  pol.qual ilike '%auth.uid()%'
              and pol.qual not ilike '%auth.uid()%=%user_id%'
              and pol.qual not ilike '%user_id%=%auth.uid()%'
           )
           -- (3) OR-with-true short-circuit revokes the equality escape.
           or pol.qual ilike '%true%or%'
           or pol.qual ilike '%or%true%'
        )
      )                                                        as has_qual_no_authuid,
      -- (C) INSERT policy missing / wide-open WITH CHECK.
      bool_or(
        pol.cmd = 'INSERT'
        and (
              pol.with_check is null
           or lower(btrim(pol.with_check)) in ('true','(true)')
        )
      )                                                        as has_insert_no_check,
      -- owner-scope signal: at least one policy references auth.uid().
      bool_or(
            coalesce(pol.qual,'')       ilike '%auth.uid()%'
         or coalesce(pol.with_check,'') ilike '%auth.uid()%'
      )                                                        as has_any_authuid
    from pg_catalog.pg_policies pol
    where pol.schemaname = 'public'
    group by pol.tablename
  ),

  -- Does the table expose a `user_id` column? (owner-table heuristic.)
  _has_user_id as (
    select t.reloid
    from _tables t
    where exists (
      select 1
      from pg_catalog.pg_attribute a
      where a.attrelid = t.reloid
        and a.attname  = 'user_id'
        and a.attnum   > 0
        and not a.attisdropped
    )
  ),

  -- One row per (table, reason). UNION ALL of every detector so a single
  -- table can surface multiple distinct problems.
  _offenders as (
    -- rls_disabled (Critical)
    select t.table_name,
           'rls_disabled'::text as reason,
           t.rls_enabled        as rls_enabled,
           coalesce(p.policy_count, 0)::bigint as policy_count
    from _tables t
    left join _pol p on p.table_name = t.table_name
    where t.rls_enabled is false

    union all
    -- rls_enabled_no_policy (deny-all; surfaced as offender)
    select t.table_name, 'rls_enabled_no_policy', t.rls_enabled,
           0::bigint
    from _tables t
    left join _pol p on p.table_name = t.table_name
    where t.rls_enabled is true
      and coalesce(p.policy_count, 0) = 0

    union all
    -- (A) policy_anon_or_public (Critical)
    select t.table_name, 'policy_anon_or_public', t.rls_enabled,
           p.policy_count
    from _tables t
    join _pol p on p.table_name = t.table_name
    where p.has_anon_public

    union all
    -- (B) policy_unscoped_true (Critical)
    select t.table_name, 'policy_unscoped_true', t.rls_enabled,
           p.policy_count
    from _tables t
    join _pol p on p.table_name = t.table_name
    where p.has_unscoped_true or p.has_check_true

    union all
    -- (B') policy_qual_no_authuid (Critical, heuristic)
    select t.table_name, 'policy_qual_no_authuid', t.rls_enabled,
           p.policy_count
    from _tables t
    join _pol p on p.table_name = t.table_name
    where p.has_qual_no_authuid

    union all
    -- (C) insert_no_with_check (Critical)
    select t.table_name, 'insert_no_with_check', t.rls_enabled,
           p.policy_count
    from _tables t
    join _pol p on p.table_name = t.table_name
    where p.has_insert_no_check

    union all
    -- owner_table_no_authuid (WARN/High): has user_id col + >=1 policy
    -- but NONE of them reference auth.uid().
    select t.table_name, 'owner_table_no_authuid', t.rls_enabled,
           p.policy_count
    from _tables t
    join _pol p on p.table_name = t.table_name
    join _has_user_id u on u.reloid = t.reloid
    where p.policy_count > 0
      and p.has_any_authuid is not true
  )

-- Postgres rejects an ORDER BY that references an expression (e.g. the
-- sentinel-last CASE) or a sort-only column on a compound query
-- (UNION/INTERSECT/EXCEPT): only output column names or ordinals are
-- allowed there (SQLSTATE 0A000 — "invalid UNION/INTERSECT/EXCEPT ORDER
-- BY clause"). SQLite is permissive and accepted the old form, which is
-- why the self-test did not catch it. Fix: wrap the whole UNION ALL
-- (offenders + sentinel) in a derived table and ORDER BY on the OUTSIDE.
-- The outer query is a simple (non-compound) SELECT, so its ORDER BY may
-- freely use a CASE expression over the derived table's output columns.
-- The 4-column contract (table_name / reason / rls_enabled /
-- policy_count), the sentinel-is-always-last property, the compound
-- allowlist join, and every detector are byte-for-byte unchanged; only
-- the ORDER BY placement moved out one level.
select
  _gate_rows.table_name    as table_name,
  _gate_rows.reason        as reason,
  _gate_rows.rls_enabled   as rls_enabled,
  _gate_rows.policy_count  as policy_count
from (
  select
    o.table_name                                          as table_name,
    case
      -- Downgrade ONLY the specific (table, reason) offence that was
      -- explicitly reviewed. A different offence on the same table keeps
      -- its real (blocking) reason — no table-wide exemption.
      when al.table_name is not null then 'allowlisted_review'
      else o.reason
    end                                                   as reason,
    o.rls_enabled                                         as rls_enabled,
    o.policy_count                                        as policy_count
  from _offenders o
  left join _rls_gate_allowlist al
    on al.table_name = o.table_name
   and al.why_reason = o.reason

  union all

  -- Sentinel: ALWAYS the last row. Its presence proves the query
  -- completed end-to-end. The wrapper keys "query ran" off this marker,
  -- never off the CLI exit code (the CLI can exit 0 on connection
  -- failure).
  select
    '___RLS_GATE_OK___'::name,
    null::text,
    null::boolean,
    null::bigint
) as _gate_rows

order by
  -- Outer (non-compound) ORDER BY: references ONLY _gate_rows output
  -- columns, so the sentinel-last CASE is legal under Postgres compound
  -- query rules. allowlisted_review rows are WARN-only; the wrapper
  -- filters them out of the blocking set but still prints them. Sentinel
  -- sorts last.
  case when _gate_rows.table_name = '___RLS_GATE_OK___' then 1 else 0 end,
  _gate_rows.table_name,
  _gate_rows.reason;
