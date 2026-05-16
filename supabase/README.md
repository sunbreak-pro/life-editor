# Supabase — migrations & the RLS leak gate

This directory holds the Postgres migrations for the web-first migration
and the **RLS leak detection gate** that must pass before any schema
change reaches production.

## Why a gate exists

The Supabase **anon key is public** — it is bundled into the browser
JavaScript that anyone can read. Row Level Security (RLS) is therefore
the _only_ thing standing between an attacker and every row in the
database.

A new migration is a leak if it creates a `public` table and:

- forgets `alter table public.<t> enable row level security;`, **or**
- attaches no policy at all, **or**
- attaches a **wide-open** policy — granted to `anon`/`public`, with an
  unscoped predicate (`USING (true)` / no `USING`), an `INSERT` policy
  with no `WITH CHECK` (or `WITH CHECK (true)`), or a permissive policy
  whose predicate never references `auth.uid()` **or references it
  without an owner equality** (e.g. `USING (auth.uid() is not null)` or
  `USING (true or auth.uid() = user_id)` — both pass an `auth.uid()`
  substring check yet expose every row).

Phase 2 adds several new tables (Notes, Schedule, Daily, WikiTags, …),
so the risk of forgetting one grows. The gate walks `pg_catalog` and
fails the workflow if any `public` base/partitioned table is unprotected
by the criteria above.

**Design principle: false positive over false negative.** When the
detector is unsure it BLOCKS. A legitimate policy mis-flagged by the
`auth.uid()` heuristic is escaped operationally (the allowlist — see
below), never by weakening the detector.

## Mandatory workflow (do this every time)

```bash
cd supabase

# 1. Gate FIRST. Never skip this before pushing schema changes.
npm run db:check-rls          # exit 0 = safe, 1 = leak, 2 = inconclusive

# 2. Only if the gate is GREEN (exit 0):
npx supabase db push
```

`npm run db:push` does both in one step (gate, then push only if the
gate passed) and is the recommended entry point:

```bash
cd supabase
npm run db:push
```

> Rule: **a migration is not "done" until `db:check-rls` is green AND
> `db push` has been run.** Treat exit code 2 (inconclusive — e.g. the
> DB was unreachable) as a failure, never as "all clear". An unreachable
> database is not proof that RLS is correct.

## Required environment

There is no local Docker stack and no `psql` on this machine, so the gate
talks to the **remote** database through the Supabase CLI
(`supabase db query --db-url …`). That needs a real Postgres connection
string — the public anon key cannot read `pg_catalog`.

| Variable          | What it is                                                                |
| ----------------- | ------------------------------------------------------------------------- |
| `SUPABASE_DB_URL` | Postgres connection URI for the linked project (a secret — never commit). |

Get it from: **Supabase Dashboard → Project Settings → Database →
Connection string (URI)**. Use the direct connection or the pooler URI.
Percent-encode the password if it contains reserved characters
(`@ : / ? # [ ]`).

Provide it in **one** of these ways:

- Export it in your shell:

  ```bash
  export SUPABASE_DB_URL='postgresql://postgres:<pwd>@<host>:5432/postgres'
  ```

- Or create `supabase/.env` (already gitignored — see the root
  `.gitignore` entry `supabase/.env`) containing:

  ```
  SUPABASE_DB_URL=postgresql://postgres:<pwd>@<host>:5432/postgres
  ```

  > `scripts/check-rls.sh` does **not** `source` this file. Only the
  > single `SUPABASE_DB_URL=` line is extracted (last match wins), so an
  > accidental or malicious shell snippet in `supabase/.env` cannot run.

> `web/.env.local` only has `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
> Those are **not** sufficient for the gate. Do not put `SUPABASE_DB_URL`
> in any file that is committed.

## What the gate considers safe vs. a leak

| Table state                                                    | Verdict          |
| -------------------------------------------------------------- | ---------------- |
| RLS enabled + ≥ 1 policy, all owner-scoped via `auth.uid()`    | safe             |
| RLS enabled + 0 policies (deny-all, e.g. `0001`)               | offender\*       |
| RLS disabled                                                   | LEAK             |
| Policy granted to `anon` / `public`                            | LEAK             |
| `USING (true)` / no `USING` on SELECT/UPDATE/DELETE/ALL        | LEAK             |
| `INSERT` policy with no `WITH CHECK` (or `WITH CHECK (true)`)  | LEAK             |
| Permissive `USING` never names `auth.uid()`                    | LEAK (heuristic) |
| Permissive `USING` names `auth.uid()` w/o `= user_id` equality | LEAK (heuristic) |
| `public` table has `user_id` col but no `auth.uid()` policy    | BLOCK (High)\*\* |
| `(table, reason)` pair in the `_rls_gate_allowlist`            | WARN (non-block) |

\* A deny-all table (RLS on, no policy) is locked down — not leaking —
but is still surfaced so the gate blocks an unusable table from
shipping. `0001_initial.sql` ships in this state only until
`0002_rls_tasks.sql` adds the owner-only policies (Phase 1 split, see
below — **not a pattern to copy**).

\*\* `owner_table_no_authuid` is **BLOCKING (exit 1)**, not a soft
warning. The reason string (`owner_table_no_authuid`) is distinct from
the WARN-only string (`allowlisted_review`), so the wrapper keeps it in
the blocking set. "High" describes its severity tier, not its gate
behaviour. It is downgraded to a non-blocking WARN **only** when an
explicit `(table_name, 'owner_table_no_authuid')` pair is added to the
`_rls_gate_allowlist` after manual review.

Internal schemas (`auth`, `storage`, `realtime`, `supabase_migrations`,
…) are out of scope — the query is filtered to `nspname = 'public'`
base/partitioned tables only, so `schema_migrations` etc. are never
flagged.

## Gate scope (what this does NOT catch)

The gate is a `pg_catalog` walk over `public` base + partitioned tables
(`relkind in ('r','p')`). The following are **out of scope** and any
migration that introduces them requires **manual security review**:

- **Views** — RLS does not apply to views; a view over a protected table
  can re-expose rows. Not walked here.
- **`SECURITY DEFINER` functions** — they execute with the definer's
  privileges and bypass the caller's RLS. Audit each one by hand.
- **Table-owner RLS bypass** — a table owner (and superuser) bypasses
  RLS unless `alter table … force row level security` is set
  (`relforcerowsecurity`). The gate does not assert `force`. If you rely
  on owner-level access being denied, set `force` explicitly and review.
- **Foreign tables** (`relkind = 'f'`) — not walked.

These gaps are intentional (keeping the gate fast and deterministic);
they are documented so reviewers know where the automation stops.

## False positives — the allowlist (do NOT weaken the detector)

The `policy_qual_no_authuid` / `owner_table_no_authuid` checks are
heuristics: a legitimate policy that scopes ownership through a
`SECURITY DEFINER` helper or a join table will not literally contain the
string `auth.uid()` and will be flagged.

**Resolution:** never relax the SQL. Instead add a **compound
`(table_name, why_reason)` pair** to the `_rls_gate_allowlist` CTE in
`scripts/check-rls.sql` **with a one-line justification** in the trailing
comment. `why_reason` must be the exact offending reason string (e.g.
`'policy_qual_no_authuid'`), not free text — it is matched against
`_offenders.reason`.

Only the **specific reviewed `(table, reason)` offence** is downgraded to
the WARN-only reason `allowlisted_review` (still printed for visibility,
not blocking). A **different** offence on the same table (e.g.
`policy_anon_or_public`) is **not** exempted and still BLOCKS — a
table-wide bypass is deliberately impossible. To exempt two distinct
offences on one table you must add two allowlist rows.

## Files

| File                            | Purpose                                                                                                                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `migrations/*.sql`              | Schema. Every new table MUST enable RLS + owner-only policies.                                                                                                                         |
| `scripts/check-rls.sql`         | The `pg_catalog` walk; emits offenders + a trailing sentinel row.                                                                                                                      |
| `scripts/check-rls.sh`          | Wrapper: runs the SQL via the CLI, maps the result to exit 0/1/2.                                                                                                                      |
| `scripts/check-rls-selftest.sh` | DB-less self-test: stubs the CLI to assert the exit-code contract + qual-heuristic parity (incl. `auth.uid() is not null` / `true or …` → BLOCK). Run `npm run db:check-rls:selftest`. |
| `package.json`                  | `db:check-rls` / `db:check-rls:selftest` / `db:push`; pins `supabase` as a devDependency.                                                                                              |

## RLS pattern for new tables (Phase 2+)

> **One table = one migration file.** From Phase 2 onward, each new
> table's _table creation_ + _RLS enablement_ + _owner-only 4 policies_ +
> _`user_id` default `auth.uid()`_ all go in **the same migration file.
> Do not split them.** The `0001` (create + RLS-on, no policy) / `0002`
> (policies) split is a Phase 1 historical artefact and is **NOT** to be
> followed — a split window is exactly when a table ships RLS-on but
> wide-open or deny-all by accident.

Every new domain table must, in **one** migration:

1. `create table public.<t> ( …, user_id uuid not null, … );`
2. `alter table public.<t> enable row level security;`
3. `alter table public.<t> alter column user_id set default auth.uid();`
   (server-derived owner — the client never sends `user_id`),
4. add the four owner-only policies `to authenticated` with
   `auth.uid() = user_id` (select / insert-with-check /
   update-using+check / delete).

The gate also WARN-detects the partial-failure case: a `public` table
that has a `user_id` column and ≥ 1 policy but **zero** policies that
reference `auth.uid()` (reason `owner_table_no_authuid`) — i.e. you
added the table and a policy but the policy is not actually
owner-scoped.

See `migrations/0002_rls_tasks.sql` for the policy bodies, but **inline
them into the create-table migration** for every Phase 2+ table.
