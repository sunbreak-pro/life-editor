#!/usr/bin/env bash
# Self-test for the RLS leak gate (check-rls.sh + check-rls.sql).
#
# WHY a self-test: the gate is the ONLY thing standing between a
# forgotten policy and a public database. It is also untestable against
# the real DB in CI/dev here (no psql, no Docker, the connection string
# is a secret). So we verify the two failure-prone layers WITHOUT a
# database:
#
#   PART A — wrapper contract (check-rls.sh): stub `npx` on PATH and feed
#            canned CSV fixtures, asserting the exit-code mapping:
#              * sentinel only            -> exit 0 (all clear)
#              * sentinel + offender row  -> exit 1 (leak, BLOCKING)
#              * sentinel + WARN-only row -> exit 0 (allowlisted, printed)
#              * NO sentinel              -> exit 2 (inconclusive)
#            plus the SEC-Medium-2 regression: a table literally named
#            with the substring `table_name` must NOT be swallowed by
#            header stripping (it must still BLOCK).
#
#   PART B — qual heuristic (check-rls.sql `has_qual_no_authuid`):
#            re-express the exact ilike predicate in SQLite `LIKE`
#            (case-insensitive, same `%...%` semantics for our
#            punctuation-free inputs) and assert PASS/BLOCK per synthetic
#            `qual`, including the SEC-High-1 case
#            `auth.uid() is not null` -> BLOCK.
#
# Exit 0 = every self-test case passed. Exit 1 = at least one regression.
#
# This does NOT contact the network and needs only bash + sqlite3.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATE_SH="${SCRIPT_DIR}/check-rls.sh"
GATE_SQL="${SCRIPT_DIR}/check-rls.sql"

PASS=0
FAIL=0

ok()   { printf '  PASS  %s\n' "$1"; PASS=$((PASS + 1)); }
bad()  { printf '  FAIL  %s\n' "$1"; FAIL=$((FAIL + 1)); }

# ---------------------------------------------------------------------------
# PART A — wrapper exit-code contract via a stub `npx`.
# ---------------------------------------------------------------------------
# The stub mimics `npx supabase db query ... --output csv` by writing the
# fixture pointed to by $SELFTEST_CSV to stdout (the wrapper parses stdout
# only). It ignores all args, exactly like the real CLI exiting 0 even on
# connection failure (which is precisely why the wrapper trusts the
# sentinel, not the exit code).
STUB_DIR="$(mktemp -d -t rls_selftest_stub.XXXXXX)"
FIX_DIR="$(mktemp -d -t rls_selftest_fix.XXXXXX)"
cleanup() { rm -rf "${STUB_DIR}" "${FIX_DIR}"; }
trap cleanup EXIT

cat >"${STUB_DIR}/npx" <<'STUB'
#!/usr/bin/env bash
# Fake `npx supabase ...`: echo the fixture, ignore every argument.
if [[ -n "${SELFTEST_CSV:-}" && -f "${SELFTEST_CSV}" ]]; then
  cat "${SELFTEST_CSV}"
fi
exit 0
STUB
chmod +x "${STUB_DIR}/npx"

run_gate_with_csv() {
  # $1 = fixture file. Returns the wrapper's exit code; stderr suppressed
  # (we only assert exit code here).
  SELFTEST_CSV="$1" \
  SUPABASE_DB_URL='postgresql://stub:stub@localhost:5432/postgres' \
  PATH="${STUB_DIR}:${PATH}" \
    bash "${GATE_SH}" >/dev/null 2>&1
  echo $?
}

expect_exit() {
  # $1 description, $2 expected exit, $3 fixture
  local desc="$1" want="$2" fixture="$3" got
  got="$(run_gate_with_csv "${fixture}")"
  if [[ "${got}" == "${want}" ]]; then
    ok "${desc} (exit ${got})"
  else
    bad "${desc} (expected exit ${want}, got ${got})"
  fi
}

HDR='table_name,reason,rls_enabled,policy_count'
SENT='___RLS_GATE_OK___,,,'

# A1: sentinel only -> all clear (exit 0).
printf '%s\n%s\n' "${HDR}" "${SENT}" >"${FIX_DIR}/clear.csv"
expect_exit "A1 sentinel only => all clear" 0 "${FIX_DIR}/clear.csv"

# A2: a real offender row -> leak (exit 1, BLOCKING).
printf '%s\nleaky,rls_disabled,f,0\n%s\n' "${HDR}" "${SENT}" \
  >"${FIX_DIR}/leak.csv"
expect_exit "A2 offender row => leak BLOCKS" 1 "${FIX_DIR}/leak.csv"

# A3: only a WARN-only allowlisted_review row -> non-blocking (exit 0).
printf '%s\nreviewed,allowlisted_review,t,4\n%s\n' "${HDR}" "${SENT}" \
  >"${FIX_DIR}/warn.csv"
expect_exit "A3 allowlisted_review only => WARN, not blocking" 0 \
  "${FIX_DIR}/warn.csv"

# A4: NO sentinel at all -> inconclusive (exit 2), never "all clear".
printf '%s\n' "${HDR}" >"${FIX_DIR}/nosent.csv"
expect_exit "A4 missing sentinel => inconclusive" 2 \
  "${FIX_DIR}/nosent.csv"

# A5 (SEC-Medium-2 regression): a table whose NAME contains the substring
# `table_name` must still BLOCK. The old `grep -v 'table_name'` header
# filter would have silently dropped this offender (false negative).
printf '%s\nuser_table_name_log,rls_disabled,f,0\n%s\n' "${HDR}" "${SENT}" \
  >"${FIX_DIR}/substr.csv"
expect_exit "A5 table named *table_name* still BLOCKS (SEC-Medium-2)" 1 \
  "${FIX_DIR}/substr.csv"

# A6: offender + WARN row together -> the offender still BLOCKS (exit 1).
printf '%s\nreviewed,allowlisted_review,t,4\nleaky,policy_anon_or_public,t,1\n%s\n' \
  "${HDR}" "${SENT}" >"${FIX_DIR}/mixed.csv"
expect_exit "A6 WARN + real offender => still BLOCKS" 1 \
  "${FIX_DIR}/mixed.csv"

# ---------------------------------------------------------------------------
# PART B — qual heuristic parity (SEC-High-1).
# ---------------------------------------------------------------------------
# The Postgres predicate (check-rls.sql `has_qual_no_authuid`) flags a
# PERMISSIVE policy as a leak when its qual:
#   (1) does not mention auth.uid() at all, OR
#   (2) mentions auth.uid() but NOT in an owner equality
#       (`auth.uid()=user_id` / `user_id=auth.uid()` either order), OR
#   (3) contains an OR-with-`true` short-circuit (`true or ...` /
#       `... or true`) that defeats the equality escape.
# We mirror it in SQLite LIKE. Postgres ilike and SQLite LIKE are both
# case-insensitive for ASCII and share `%` wildcard semantics; our test
# quals contain no LIKE metacharacters, so the parity is exact for these
# inputs. Whitespace around `=` is normalised the same way the SQL's
# `%auth.uid()%=%user_id%` (with `%` spanning spaces) does.
SQLITE_BIN="$(command -v sqlite3 || true)"
if [[ -z "${SQLITE_BIN}" ]]; then
  bad "B* sqlite3 not found — cannot run qual-heuristic parity tests"
else
  qual_blocks() {
    # Echoes 1 if the heuristic would FLAG (block) this qual, else 0.
    # Mirrors: qual NOT ILIKE '%auth.uid()%'
    #          OR (qual ILIKE '%auth.uid()%'
    #              AND qual NOT ILIKE '%auth.uid()%=%user_id%'
    #              AND qual NOT ILIKE '%user_id%=%auth.uid()%')
    local q="$1"
    "${SQLITE_BIN}" :memory: <<SQL
WITH p(qual) AS (VALUES ('$(printf '%s' "${q}" | sed "s/'/''/g")'))
SELECT CASE WHEN
  (lower(qual) NOT LIKE '%auth.uid()%')
  OR (
        lower(qual) LIKE '%auth.uid()%'
    AND lower(qual) NOT LIKE '%auth.uid()%=%user_id%'
    AND lower(qual) NOT LIKE '%user_id%=%auth.uid()%'
  )
  OR lower(qual) LIKE '%true%or%'
  OR lower(qual) LIKE '%or%true%'
THEN 1 ELSE 0 END
FROM p;
SQL
  }

  expect_qual() {
    # $1 description, $2 expected (1=block / 0=pass), $3 qual string
    local desc="$1" want="$2" q="$3" got
    got="$(qual_blocks "${q}")"
    if [[ "${got}" == "${want}" ]]; then
      ok "${desc} => $([[ ${got} == 1 ]] && echo BLOCK || echo pass)"
    else
      bad "${desc} (expected $([[ ${want} == 1 ]] && echo BLOCK || echo pass), got $([[ ${got} == 1 ]] && echo BLOCK || echo pass))"
    fi
  }

  # Legitimate owner-scoped quals — must PASS (0).
  expect_qual "B1 (auth.uid() = user_id)" 0 '(auth.uid() = user_id)'
  expect_qual "B2 (user_id = auth.uid())" 0 '(user_id = auth.uid())'
  expect_qual "B3 (auth.uid()=user_id) no spaces" 0 '(auth.uid()=user_id)'

  # SEC-High-1: auth.uid() present but NOT an owner equality -> BLOCK (1).
  expect_qual "B4 (auth.uid() is not null) [SEC-High-1]" 1 \
    '(auth.uid() is not null)'
  expect_qual "B5 (true or auth.uid() = user_id) [SEC-High-1]" 1 \
    '(true or auth.uid() = user_id)'
  expect_qual "B6 (auth.uid() <> user_id) non-equality" 1 \
    '(auth.uid() <> user_id)'

  # Pre-existing behaviour: qual with no auth.uid() at all -> BLOCK (1).
  expect_qual "B7 (true) no auth.uid()" 1 '(true)'
  expect_qual "B8 (org_id = current_org()) no auth.uid()" 1 \
    '(org_id = current_org())'

  # B9-B10 (Phase 2 S1-1): the EXACT qual Postgres stores for the
  # 0003_tasks_full_schema.sql owner policies. `using (auth.uid() =
  # user_id)` is normalised by PG to `(auth.uid() = user_id)`; the INSERT
  # policy's WITH CHECK is the same shape. Both must PASS (0) so 0003
  # clears the gate with NO allowlist entry.
  expect_qual "B9 0003 tasks_select/update/delete qual" 0 \
    '(auth.uid() = user_id)'
  expect_qual "B10 0003 tasks_insert with_check" 0 \
    '(auth.uid() = user_id)'
fi

# ---------------------------------------------------------------------------
# Static syntax sanity: the SQL must still be a single statement that ends
# with the sentinel select + ORDER BY (cheap structural check; no DB).
# ---------------------------------------------------------------------------
if grep -qF '___RLS_GATE_OK___' "${GATE_SQL}" \
   && grep -q 'al.why_reason = o.reason' "${GATE_SQL}" \
   && grep -q "auth.uid()%=%user_id" "${GATE_SQL}"; then
  ok "C1 SQL retains sentinel + compound allowlist join + SEC-High-1 clause"
else
  bad "C1 SQL missing sentinel / compound join / SEC-High-1 clause"
fi

# ---------------------------------------------------------------------------
# C2 (Phase 2 S1-1): 0003_tasks_full_schema.sql must, in ONE file, enable
# RLS and attach all four owner-only policies with a clean `auth.uid() =
# user_id` equality (no `or true` short-circuit). This is a static
# structural assertion against the migration text — it does not contact a
# DB, but proves the file would clear the gate's detectors.
# ---------------------------------------------------------------------------
MIG_0003="${SCRIPT_DIR}/../migrations/0003_tasks_full_schema.sql"
if [[ -f "${MIG_0003}" ]]; then
  c2_ok=1
  # Evaluate EXECUTABLE SQL only: strip `--` line comments (the gate's
  # detectors run on pg_catalog, never on comment text — so must we).
  MIG_0003_SQL="$(sed -e 's/--.*$//' "${MIG_0003}")"
  grep -qiE 'enable[[:space:]]+row[[:space:]]+level[[:space:]]+security' \
    <<<"${MIG_0003_SQL}" || c2_ok=0
  for p in tasks_select_own tasks_insert_own tasks_update_own \
           tasks_delete_own; do
    grep -qF "create policy ${p}" <<<"${MIG_0003_SQL}" || c2_ok=0
  done
  # Clean owner equality present, and NO `or true` / `true or` short-circuit
  # anywhere in the executable SQL (which would trip has_qual_no_authuid
  # case 3).
  grep -qiE 'auth\.uid\(\)[[:space:]]*=[[:space:]]*user_id' \
    <<<"${MIG_0003_SQL}" || c2_ok=0
  grep -qiE '\bto[[:space:]]+authenticated\b' <<<"${MIG_0003_SQL}" \
    || c2_ok=0
  if grep -qiE '(true[[:space:]]+or|or[[:space:]]+true)' \
       <<<"${MIG_0003_SQL}"; then
    c2_ok=0
  fi
  if [[ "${c2_ok}" -eq 1 ]]; then
    ok "C2 0003 has RLS enable + 4 owner policies + clean auth.uid()=user_id"
  else
    bad "C2 0003 missing RLS enable / a policy / clean owner equality"
  fi
else
  bad "C2 0003_tasks_full_schema.sql not found"
fi

echo
echo "Self-test summary: ${PASS} passed, ${FAIL} failed."
[[ "${FAIL}" -eq 0 ]] || exit 1
exit 0
