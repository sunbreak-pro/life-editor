#!/usr/bin/env bash
# RLS leak detection gate — run BEFORE `npx supabase db push`.
#
# WHY: the anon key is public (shipped in the browser bundle). RLS is the
# only data guard. A new table that forgets `enable row level security`,
# forgets to attach any policy, OR attaches a wide-open policy (granted to
# anon/public, an unscoped `true` predicate, an INSERT with no WITH CHECK)
# is a Critical full-row leak. This gate fails the workflow before such a
# migration reaches production. The SQL biases to FALSE POSITIVE: if it is
# unsure it blocks. See check-rls.sql for the allowlist escape hatch.
#
# HOW IT CONNECTS: there is no local Docker stack and no `psql` on this
# machine. We use the Supabase CLI's native `db query --db-url` against
# the remote Postgres connection string. The connection string is a
# secret and is NEVER committed — it is read from the environment:
#
#   SUPABASE_DB_URL   Postgres connection string for the linked project.
#                     Get it from: Supabase Dashboard
#                     -> Project Settings -> Database -> Connection string
#                     (URI, "Direct connection" or the pooler URI).
#                     The password must be percent-encoded if it contains
#                     reserved characters. The anon key in web/.env.local
#                     is NOT enough (pg_catalog walk needs a real DB role).
#
# Provide it either via a real environment variable, or by adding a line
#   SUPABASE_DB_URL=postgresql://...:...@...:5432/postgres
# to supabase/.env (gitignored). NOTE: we deliberately do NOT `source`
# that file — only the single SUPABASE_DB_URL line is extracted, so a
# malicious or accidental shell snippet in supabase/.env cannot execute.
#
# EXIT CODES:
#   0  every public table is RLS-safe                 -> safe to db push
#   1  >= 1 table is an RLS leak/offender (printed)    -> DO NOT db push
#   2  could not run the check (missing env / no       -> resolve & retry
#      connectivity / unexpected CLI output);             (NOT "all clear")
#
# Exit 2 is deliberately distinct from exit 0: an unreachable database is
# NOT proof of safety. Treat exit 2 as "gate inconclusive — fix me".

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPABASE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SQL_FILE="${SCRIPT_DIR}/check-rls.sql"

# Sentinel emitted as the LAST row by check-rls.sql. Its presence is the
# ONLY proof the query ran end-to-end (the CLI can exit 0 even when the
# connection failed, so its exit code is untrustworthy).
SENTINEL='___RLS_GATE_OK___'

# WARN-only reason: surfaced for visibility but does NOT block the push.
WARN_REASON='allowlisted_review'

# Mask passwords in any Postgres DSN before echoing to stderr, so a
# connection string never leaks into logs/CI output.
mask_dsn() {
  sed -E 's#(postgres(ql)?://[^:]+:)[^@]+@#\1***@#g'
}

# Safely extract ONLY the SUPABASE_DB_URL line from supabase/.env. We do
# not `source` the file: that would execute arbitrary shell. We take the
# last matching assignment, strip optional surrounding quotes, and export.
ENV_FILE="${SUPABASE_DIR}/.env"
if [[ -z "${SUPABASE_DB_URL:-}" && -f "${ENV_FILE}" ]]; then
  _line="$(grep -E '^[[:space:]]*SUPABASE_DB_URL=' "${ENV_FILE}" | tail -n1 || true)"
  if [[ -n "${_line}" ]]; then
    _val="${_line#*=}"
    # Strip one layer of matching single/double quotes if present.
    if [[ "${_val}" == \"*\" || "${_val}" == \'*\' ]]; then
      _val="${_val:1:${#_val}-2}"
    fi
    export SUPABASE_DB_URL="${_val}"
  fi
  unset _line _val
fi

if [[ ! -f "${SQL_FILE}" ]]; then
  echo "ERROR: SQL file not found: ${SQL_FILE}" >&2
  exit 2
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  cat >&2 <<'EOF'
ERROR: SUPABASE_DB_URL is not set.

The RLS gate needs a real Postgres connection (the public anon key cannot
walk pg_catalog). Set it before running:

  export SUPABASE_DB_URL='postgresql://postgres:<pwd>@<host>:5432/postgres'

or add that single line to supabase/.env (gitignored — only that line is
read, the file is never sourced). Get the connection string from:
Supabase Dashboard -> Project Settings -> Database -> Connection string
(URI). Percent-encode the password if it has reserved characters.

Gate result: INCONCLUSIVE (exit 2) — this is NOT "all clear".
EOF
  exit 2
fi

echo "Running RLS leak gate against the remote database..." >&2

# stdout and stderr are captured to SEPARATE temp files. The CLI prints
# query results to stdout and diagnostics to stderr; mixing them (2>&1)
# made header/row parsing fragile. We parse stdout only and surface
# stderr (DSN-masked) on failure.
OUT_FILE="$(mktemp -t rls_gate_out.XXXXXX)"
ERR_FILE="$(mktemp -t rls_gate_err.XXXXXX)"
cleanup() { rm -f "${OUT_FILE}" "${ERR_FILE}"; }
trap cleanup EXIT

# `--yes` is NOT optional. Without it, an `npx` that has to fetch the CLI
# (i.e. `npm install` was never run in supabase/) prints its confirmation
# prompt -- "Need to install the following packages: / supabase@<ver> /
# Ok to proceed? (y)" -- to STDOUT, the very stream we parse as CSV. The
# prompt is written without a trailing newline, so the real CSV header
# gets appended to it and every subsequent line shifts, which used to
# promote npx's own chatter to "offender rows": a FAIL with zero real
# leaks, blocking db push. db-push.sh already passes --yes; this call was
# the one that did not.
set +e
npx --yes supabase db query \
  --db-url "${SUPABASE_DB_URL}" \
  --file "${SQL_FILE}" \
  --output csv \
  --agent no \
  >"${OUT_FILE}" 2>"${ERR_FILE}"
set -e

# Determinism comes from the SENTINEL row, NOT the CSV header (header
# quoting/CR varies) and NOT the CLI exit code (exits 0 on conn failure).
# If the sentinel is absent the query did not complete -> inconclusive.
if ! grep -qF "${SENTINEL}" "${OUT_FILE}"; then
  echo "ERROR: RLS check did not complete (sentinel row missing)." >&2
  echo "       This is NOT a pass — the database was likely unreachable" >&2
  echo "       or the query failed before returning." >&2
  echo "----- CLI stdout -----" >&2
  mask_dsn <"${OUT_FILE}" >&2
  echo "----- CLI stderr -----" >&2
  mask_dsn <"${ERR_FILE}" >&2
  echo "----------------------" >&2
  echo "Gate result: INCONCLUSIVE (exit 2)." >&2
  exit 2
fi

# Locate the CSV header and keep ONLY what follows it. We do NOT drop
# line 1 positionally (`tail -n +2`): stdout is not guaranteed to start
# with the header. Any tool in front of the query — `npx` fetching the
# CLI being the case that actually bit us — can prepend its own lines,
# and then a positional drop mis-aligns and every leftover noise line is
# read as an offender row (false FAIL). Anchoring on the header instead
# is self-correcting: however many lines of chatter precede it, they are
# all discarded.
#
# We also do NOT filter with `grep -v table_name`: that is a substring
# match that would silently swallow a real data row for any future table
# whose name contains "table_name" (false NEGATIVE => that table escapes
# the BLOCKING set). We match the FULL header line instead — a data row
# cannot contain it, because a table name cannot contain a comma and no
# reason in check-rls.sql's vocabulary is the literal "reason".
#
# Quotes and CR are stripped before comparing (CSV header quoting varies
# by CLI version, and a CRLF file would otherwise never match). The
# prompt that bit us had no trailing newline, so the header can land at
# the END of a noise line — hence a substring test, not a `^` anchor.
#
# If the header never appears the output is not the CSV we think it is,
# so the run is INCONCLUSIVE (exit 2) — never "all clear". Without this
# branch, an unrecognisable stdout would yield an empty body and the gate
# would report PASS on a query it never actually parsed.
HEADER='table_name,reason,rls_enabled,policy_count'

set +e
BODY="$(awk -v hdr="${HEADER}" '
  seen { print; next }
  { line = $0; gsub(/["\r]/, "", line); if (index(line, hdr) > 0) seen = 1 }
  END { if (!seen) exit 3 }
' "${OUT_FILE}")"
HEADER_STATUS=$?
set -e

if [[ "${HEADER_STATUS}" -ne 0 ]]; then
  echo "ERROR: RLS check output has no CSV header row." >&2
  echo "       Expected a line containing: ${HEADER}" >&2
  echo "       The sentinel was present but the output could not be" >&2
  echo "       parsed as this query's CSV — treat as UNVERIFIED." >&2
  echo "----- CLI stdout -----" >&2
  mask_dsn <"${OUT_FILE}" >&2
  echo "----------------------" >&2
  echo "Gate result: INCONCLUSIVE (exit 2)." >&2
  exit 2
fi

# Offenders = every non-empty body line that is NOT:
#   * the sentinel row,
#   * a WARN-only allowlisted_review row (reported below, non-blocking).
# CSV note: our reason values are simple identifiers (no embedded commas
# or quotes), so a plain field scan is sufficient — we are not parsing
# arbitrary CSV, only this query's fixed, comma-free vocabulary.
BLOCKING="$(printf '%s\n' "${BODY}" \
  | grep -vF "${SENTINEL}" \
  | grep -v '^[[:space:]]*$' \
  | grep -vF "${WARN_REASON}" \
  || true)"

WARNINGS="$(printf '%s\n' "${BODY}" \
  | grep -F "${WARN_REASON}" \
  | grep -v '^[[:space:]]*$' \
  || true)"

if [[ -n "${WARNINGS}" ]]; then
  echo "RLS gate WARN — allowlisted tables (reviewed, not blocking):" >&2
  while IFS= read -r line; do
    [[ -n "${line}" ]] && printf '  %s\n' "${line}" >&2
  done <<<"${WARNINGS}"
  echo >&2
fi

if [[ -n "${BLOCKING}" ]]; then
  echo "RLS LEAK DETECTED — the following public tables are unprotected:" >&2
  echo >&2
  echo "  table_name,reason,rls_enabled,policy_count" >&2
  while IFS= read -r line; do
    [[ -n "${line}" ]] && printf '  %s\n' "${line}" >&2
  done <<<"${BLOCKING}"
  echo >&2
  echo "Add 'enable row level security' + owner-only auth.uid() policies" >&2
  echo "(see supabase/migrations/0002_rls_tasks.sql) BEFORE db push. If a" >&2
  echo "flagged policy is a verified false positive, add it to the" >&2
  echo "_rls_gate_allowlist in check-rls.sql (with a reason) — never relax" >&2
  echo "the detector." >&2
  echo "Gate result: FAIL (exit 1)." >&2
  exit 1
fi

echo "RLS gate: PASS — every public table has RLS + owner-scoped policies." >&2
echo "Safe to push. Use: cd supabase && npm run db:push" >&2
exit 0
