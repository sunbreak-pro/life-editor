#!/usr/bin/env bash
# Smoke test for the /api/v2/* server-authoritative API.
#
# Usage:
#   BASE_URL=http://127.0.0.1:8787 SYNC_TOKEN=dev-token \
#     bash cloud/scripts/smoke-test-v2.sh
#
# Or against production:
#   BASE_URL=https://life-editor-sync.<account>.workers.dev SYNC_TOKEN=$REAL_TOKEN \
#     bash cloud/scripts/smoke-test-v2.sh
#
# Each test prints PASS/FAIL and the script exits non-zero on the first failure.

set -u
set -o pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8787}"
SYNC_TOKEN="${SYNC_TOKEN:-}"
if [[ -z "${SYNC_TOKEN}" ]]; then
  echo "ERROR: SYNC_TOKEN must be set (matches Worker secret)." >&2
  exit 2
fi

AUTH=(-H "Authorization: Bearer ${SYNC_TOKEN}")
JSON=(-H "Content-Type: application/json")

PASS_COUNT=0
FAIL_COUNT=0

assert_status() {
  local label="$1" expected="$2" actual="$3" body="$4"
  if [[ "${actual}" == "${expected}" ]]; then
    echo "  PASS  ${label}  (${actual})"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "  FAIL  ${label}  expected=${expected} got=${actual}"
    echo "        body: ${body}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

curl_status() {
  # echoes "<status>|<body>"
  local status body
  body=$(curl -sS -o /tmp/v2_smoke_body -w "%{http_code}" "$@")
  status="${body}"
  body=$(cat /tmp/v2_smoke_body)
  echo "${status}|${body}"
}

extract_field() {
  # naive JSON field extractor (string values), good enough for smoke tests
  python3 -c "import json,sys; d=json.loads(sys.stdin.read()); print(d.get('$1',''))"
}

echo "==> 1. Health check"
res=$(curl_status -X GET "${BASE_URL}/api/v2/health" "${AUTH[@]}")
status="${res%%|*}"
body="${res#*|}"
assert_status "GET /api/v2/health" 200 "${status}" "${body}"

echo "==> 2. Upsert insert (new note)"
TEST_ID="smoke-note-$(date +%s)"
res=$(curl_status -X POST "${BASE_URL}/api/v2/mutate/notes" "${AUTH[@]}" "${JSON[@]}" \
  -d "{\"op\":\"upsert\",\"id\":\"${TEST_ID}\",\"payload\":{\"title\":\"smoke\",\"content\":\"hello\",\"is_pinned\":0,\"is_locked\":0,\"is_edit_locked\":0}}")
status="${res%%|*}"
body="${res#*|}"
assert_status "POST /api/v2/mutate/notes (insert)" 200 "${status}" "${body}"
INITIAL_VERSION=$(echo "${body}" | extract_field version)
INITIAL_TS=$(echo "${body}" | extract_field server_updated_at)
echo "        initial version=${INITIAL_VERSION} ts=${INITIAL_TS}"

echo "==> 3. Upsert update with correct expected_version"
res=$(curl_status -X POST "${BASE_URL}/api/v2/mutate/notes" "${AUTH[@]}" "${JSON[@]}" \
  -d "{\"op\":\"upsert\",\"id\":\"${TEST_ID}\",\"expected_version\":${INITIAL_VERSION},\"payload\":{\"title\":\"smoke v2\",\"content\":\"hello v2\",\"is_pinned\":0,\"is_locked\":0,\"is_edit_locked\":0}}")
status="${res%%|*}"
body="${res#*|}"
assert_status "POST /api/v2/mutate/notes (update with correct version)" 200 "${status}" "${body}"
NEW_VERSION=$(echo "${body}" | extract_field version)
echo "        new version=${NEW_VERSION}"

echo "==> 4. Upsert update with stale expected_version → 409"
res=$(curl_status -X POST "${BASE_URL}/api/v2/mutate/notes" "${AUTH[@]}" "${JSON[@]}" \
  -d "{\"op\":\"upsert\",\"id\":\"${TEST_ID}\",\"expected_version\":${INITIAL_VERSION},\"payload\":{\"title\":\"stale\",\"content\":\"x\",\"is_pinned\":0,\"is_locked\":0,\"is_edit_locked\":0}}")
status="${res%%|*}"
body="${res#*|}"
assert_status "POST /api/v2/mutate/notes (stale version)" 409 "${status}" "${body}"

echo "==> 5. Mutate unknown table → 400"
res=$(curl_status -X POST "${BASE_URL}/api/v2/mutate/_evil_table_" "${AUTH[@]}" "${JSON[@]}" \
  -d "{\"op\":\"upsert\",\"id\":\"x\",\"payload\":{}}")
status="${res%%|*}"
body="${res#*|}"
assert_status "POST /api/v2/mutate/_evil_table_" 400 "${status}" "${body}"

echo "==> 6. Mutate invalid op → 400"
res=$(curl_status -X POST "${BASE_URL}/api/v2/mutate/notes" "${AUTH[@]}" "${JSON[@]}" \
  -d "{\"op\":\"steal\",\"id\":\"${TEST_ID}\"}")
status="${res%%|*}"
body="${res#*|}"
assert_status "POST /api/v2/mutate/notes (invalid op)" 400 "${status}" "${body}"

echo "==> 7. Snapshot returns the row we just inserted"
res=$(curl_status -X GET "${BASE_URL}/api/v2/snapshot" "${AUTH[@]}")
status="${res%%|*}"
body="${res#*|}"
assert_status "GET /api/v2/snapshot" 200 "${status}" "${body:0:200}"
if echo "${body}" | grep -q "${TEST_ID}"; then
  echo "  PASS  snapshot contains ${TEST_ID}"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "  FAIL  snapshot did not contain ${TEST_ID}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo "==> 8. Since with cursor before insert returns the row"
PAST_CURSOR="2000-01-01T00:00:00.000Z"
res=$(curl_status -X GET "${BASE_URL}/api/v2/since?cursor=${PAST_CURSOR}" "${AUTH[@]}")
status="${res%%|*}"
body="${res#*|}"
assert_status "GET /api/v2/since (past cursor)" 200 "${status}" "${body:0:200}"
NEXT_CURSOR=$(echo "${body}" | python3 -c "import json,sys;d=json.loads(sys.stdin.read());print(d.get('next_cursor',''))")
echo "        next_cursor=${NEXT_CURSOR}"
if [[ -n "${NEXT_CURSOR}" && "${NEXT_CURSOR}" != "${PAST_CURSOR}" ]]; then
  echo "  PASS  next_cursor advanced past input cursor"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "  FAIL  next_cursor did not advance (got=${NEXT_CURSOR})"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo "==> 9. Since missing cursor → 400"
res=$(curl_status -X GET "${BASE_URL}/api/v2/since" "${AUTH[@]}")
status="${res%%|*}"
body="${res#*|}"
assert_status "GET /api/v2/since (no cursor)" 400 "${status}" "${body}"

echo "==> 10. Delete the smoke row"
res=$(curl_status -X POST "${BASE_URL}/api/v2/mutate/notes" "${AUTH[@]}" "${JSON[@]}" \
  -d "{\"op\":\"delete\",\"id\":\"${TEST_ID}\"}")
status="${res%%|*}"
body="${res#*|}"
assert_status "POST /api/v2/mutate/notes (delete)" 200 "${status}" "${body}"

echo "==> 11. Delete non-existent → 404"
res=$(curl_status -X POST "${BASE_URL}/api/v2/mutate/notes" "${AUTH[@]}" "${JSON[@]}" \
  -d "{\"op\":\"delete\",\"id\":\"does-not-exist-$(date +%s)\"}")
status="${res%%|*}"
body="${res#*|}"
assert_status "POST /api/v2/mutate/notes (delete missing)" 404 "${status}" "${body}"

echo
echo "===================================="
echo "Smoke test summary: ${PASS_COUNT} pass, ${FAIL_COUNT} fail"
echo "===================================="
if [[ "${FAIL_COUNT}" -gt 0 ]]; then
  exit 1
fi
