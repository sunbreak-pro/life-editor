#!/usr/bin/env bash
#
# db-push.sh — gated production migration push.
#
# Runs the RLS leak gate first; only if it passes (exit 0) does it push
# pending migrations to the remote database via the Supabase CLI's
# `--db-url` flag (no `supabase link` required).
#
# We pass SUPABASE_DB_URL through `--db-url` rather than relying on a
# linked project. The connection string is read from supabase/.env using
# the same safe extraction as check-rls.sh (no `source` — that would
# execute arbitrary shell). This avoids the user having to retype the URL
# on the command line (which previously broke when an IME inserted a
# full-width space, and risks leaking the password into shell history).
#
# Usage:
#   cd supabase && npm run db:push
#
# Env:
#   SUPABASE_DB_URL   Postgres connection string. If unset, the single
#                     SUPABASE_DB_URL= line from supabase/.env is used.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPABASE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

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

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  cat >&2 <<'EOF'
ERROR: SUPABASE_DB_URL is not set.
       Set it in supabase/.env (gitignored) as a single line:
         SUPABASE_DB_URL=postgresql://postgres.<ref>:<urlencoded-pwd>@<host>:6543/postgres?pgbouncer=true
       The password MUST be percent-encoded (e.g. ! -> %21, @ -> %40).
EOF
  exit 2
fi

echo "Step 1/2: RLS leak gate ..."
bash "${SCRIPT_DIR}/check-rls.sh"

echo
echo "Step 2/2: pushing pending migrations to remote ..."
npx --yes supabase db push --db-url "${SUPABASE_DB_URL}" --include-all

echo
echo "db:push complete."
