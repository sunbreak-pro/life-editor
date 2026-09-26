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
npm run db:push
```

That is the **only** entry point you should use. It runs the gate first and
pushes only if the gate passed, and it invokes the CLI from the repo root
(see below).

To run the gate alone without pushing:

```bash
cd supabase
npm run db:check-rls          # exit 0 = safe, 1 = leak, 2 = inconclusive
```

> ⚠️ **Do not call `npx supabase db push` by hand from `supabase/`.** The CLI
> resolves migrations as `<cwd>/supabase/migrations`, so from inside
> `supabase/` it looks in `supabase/supabase/migrations`, finds nothing, and
> aborts with `Remote migration versions not found in local migrations
directory` listing every already-applied version. **That message is a
> false alarm — it does not mean the history is broken, and the
> `supabase migration repair` / `supabase db pull` commands the CLI suggests
> would rewrite a perfectly good history.** If you must call the CLI
> directly, run it from the repo root. (2026-07-25, CLI 2.109.1.)

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

Get it from the **Connect** button at the top of the dashboard (it is no
longer under Project Settings). Pick the **Session pooler** tab and copy the
URI verbatim, then substitute the password.

> ⚠️ **Session pooler (5432), not transaction pooler (6543).** Transaction
> pooling multiplexes many clients onto shared backends, so the CLI's
> prepared statements collide and the push dies with
> `ERROR: prepared statement "lrupsc_1_0" already exists (SQLSTATE 42P05)`.
> For the same reason, do not append `?pgbouncer=true`. The direct
> connection (`db.<ref>.supabase.co:5432`) also works but is IPv6-only on
> newer projects, so it may be unreachable depending on your network — the
> session pooler is IPv4-friendly and is the safe default. (2026-07-25)

The database password cannot be read back after project creation — if you do
not have it, reset it at **Settings → Database → Database password**.
Resetting does not affect the app, which authenticates with the anon key
(`web/.env.local`), not this password.

Percent-encode the password if it contains reserved characters
(`@ : / ? # [ ]`) — e.g. `!` → `%21`, `@` → `%40`.

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

## Auth email — custom SMTP (#1986)

Confirm email is ON (D-20260829-web-1), so a new user cannot sign in until
the confirmation mail arrives. Supabase's built-in sender is for testing
only: it sends a handful of mails per hour and delivers only to the
project's team-member addresses. With more than one person signing up at
once, mails stop arriving and those people are locked out. The fix is to
point Supabase Auth at a free-tier transactional mail provider over SMTP.

Everything in this section is **done in the Supabase Dashboard, the
provider's console and DNS — by the owner, not by Claude**. The repo only
keeps the procedure and a copy of the templates. **Never commit the SMTP
password / API key** — it lives only in the Dashboard.

Which provider to use is an open decision (D-20260926-web-1 in
`.claude/comm/decisions/chat-web-public.md`). The steps below are written
so they do not depend on that choice.

### Prerequisite: a sending domain you control

Every candidate provider needs the "From" address to be on a domain whose
DNS you can edit, so it can publish SPF and DKIM records for it. Two
things do **not** work:

- `life-editor.sunbreak-pro.workers.dev` — the domain belongs to
  Cloudflare; you cannot add TXT records to it.
- A free-mail sender such as `…@gmail.com` — providers may let you verify
  it as a single sender, but Gmail / Yahoo reject or spam-folder it because
  it fails DMARC alignment (Brevo's own help says free-mail domains cannot
  be authenticated).

A subdomain of a domain you already own is enough (e.g.
`mail.example.com`, From = `no-reply@mail.example.com`).

### Setup steps

1. **Create the provider account** on the free tier. No credit card
   should be needed; if the signup asks for one, stop — the project runs
   at $0.
2. **Verify the sending domain.** Add the SPF / DKIM (and, if offered,
   return-path / DMARC) records the provider shows to your DNS, then wait
   for the provider's console to mark the domain as verified. DNS can take
   from minutes to a day to propagate.
3. **Create an SMTP credential** in the provider console. Copy host,
   port, username and password into a password manager only.
4. **Enter it in Supabase**: Dashboard → Authentication → Emails →
   SMTP Settings → enable **Custom SMTP** and fill in:

   | Field        | Value                                               |
   | ------------ | --------------------------------------------------- |
   | Sender email | `no-reply@<your verified domain>`                   |
   | Sender name  | `Life Editor`                                       |
   | Host / Port  | from the provider (use 587 / STARTTLS or 465 / SSL) |
   | Username     | from the provider                                   |
   | Password     | the SMTP credential from step 3                     |

   Reference values for the two front-runners (confirm in the provider's
   docs at setup time): Resend = `smtp.resend.com`, username `resend`,
   password = an API key; Brevo = `smtp-relay.brevo.com`, username = the
   account login email, password = an **SMTP key** (not the API key).

5. **Check the send rate limit**: Dashboard → Authentication → Rate
   Limits. Turning on custom SMTP sets the email limit to a low default
   (30 per hour). That already covers the 10–20 distribution users; raise
   it only if the provider's daily cap allows.
6. **Paste the templates** from `templates/auth/` (next section).
7. **Test** (the DoD of #1986): sign up with a fresh address and confirm
   the mail arrives within a minute from your domain; request a password
   reset and confirm it arrives the same way; send 5 mails within 5
   minutes (sign-ups + "resend confirmation") and confirm none is refused.
   If a mail is missing, the provider's log shows whether Supabase handed
   it over at all.

The Dashboard menu names above are as of 2026-09. If they move, search
the Dashboard for "SMTP" / "Rate Limits".

### Email templates (`templates/auth/`)

The Dashboard is the source of truth; `templates/auth/{ja,en}/` is a copy
so the wording is reviewed in PRs and can be restored. The app sends only
two kinds of auth mail, so only these two are kept:

| Dashboard template | File                  | Sent by (`shared/src/services/SupabaseAuth.ts`) |
| ------------------ | --------------------- | ----------------------------------------------- |
| Confirm signup     | `confirm-signup.html` | `signUp`, `resendConfirmationEmail`             |
| Reset password     | `reset-password.html` | `sendPasswordResetEmail`                        |

Each file's first comment line is the **Subject**; the rest is the
**Body**. The link must stay `{{ .ConfirmationURL }}` — it carries the
redirect the app passes (`authRedirectUrl()`), so the flow behaves exactly
as it does with Supabase's default templates.

Supabase stores **one body per template type** and does not pick a
language per user (the app does not record the user's language in
`user_metadata` either). So only one of `ja/` / `en/` can be live at a
time. Which one is an open decision (D-20260926-web-2). If you edit a
template in the Dashboard, update the copy here in the same PR-sized
change so the two do not drift.

### Rollback to the built-in sender

Use this when the provider fails (account suspended, domain unverified,
free tier ended) and a fix is not quick.

1. Dashboard → Authentication → Emails → SMTP Settings → turn **Custom
   SMTP** off and save. Auth immediately falls back to Supabase's
   built-in sender. The templates stay as they are.
2. **The built-in sender delivers only to team-member addresses.** While
   it is active, anyone else who signs up never gets a confirmation mail
   and cannot sign in. If distribution users are still signing up, turn
   **Confirm email** off (Authentication → Sign In / Providers → Email)
   for the duration — the revival condition recorded in
   D-20260829-web-1. The app works with it on or off (#1197). Anyone who
   signed up before the switch and never got their mail can use
   "resend confirmation" once custom SMTP is back.
3. Rotate or delete the SMTP credential in the provider console if the
   reason was a leak or an abandoned provider.
4. When custom SMTP is back, turn Confirm email on again and re-run the
   tests in step 7.
