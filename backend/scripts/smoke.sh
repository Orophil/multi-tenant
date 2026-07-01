#!/usr/bin/env bash
# Smoke test for the feature-flags backend.
set -u

BASE="http://localhost:4000/api"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TS="$(date +%s%N)"
ORG_NAME="Acme-${TS}"
ADMIN_EMAIL="admin-${TS}@example.com"
USER_EMAIL="user-${TS}@example.com"
PASS="Password123!"

FAILED=0
SERVER_PID=""

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; FAILED=1; }

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null
    wait "$SERVER_PID" 2>/dev/null
  fi
  # ensure nothing left on :4000
  local pids
  pids="$(lsof -ti tcp:4000 2>/dev/null || true)"
  if [ -n "$pids" ]; then kill -9 $pids 2>/dev/null || true; fi
}
trap cleanup EXIT

# --- kill anything currently on :4000 ---
EXISTING="$(lsof -ti tcp:4000 2>/dev/null || true)"
if [ -n "$EXISTING" ]; then
  echo "Killing existing process(es) on :4000: $EXISTING"
  kill -9 $EXISTING 2>/dev/null || true
  sleep 1
fi

# --- start server ---
echo "Starting server..."
( cd "$DIR" && node src/index.js ) >/tmp/ff-smoke-server.log 2>&1 &
SERVER_PID=$!

# --- wait for health ---
HEALTHY=0
for i in $(seq 1 40); do
  if curl -fsS "$BASE/health" >/dev/null 2>&1; then HEALTHY=1; break; fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Server process died during startup. Log:"; cat /tmp/ff-smoke-server.log; exit 1
  fi
  sleep 0.25
done
if [ "$HEALTHY" = "1" ]; then pass "health endpoint reachable"; else fail "health endpoint not reachable"; cat /tmp/ff-smoke-server.log; exit 1; fi

# helper: extract a JSON string field (simple, token assumed alphanumeric/._-)
jget() { sed -n "s/.*\"$1\":[[:space:]]*\"\([^\"]*\)\".*/\1/p"; }
jget_num() { sed -n "s/.*\"$1\":[[:space:]]*\([0-9][0-9]*\).*/\1/p" | head -n1; }
jget_bool() { sed -n "s/.*\"$1\":[[:space:]]*\(true\|false\).*/\1/p" | head -n1; }

# status helper: prints body to stdout, status code to fd 3 capture
req() {
  # req METHOD URL [DATA] [AUTH]
  local method="$1" url="$2" data="${3:-}" auth="${4:-}"
  local args=(-sS -X "$method" -H "Content-Type: application/json" -w $'\n%{http_code}')
  if [ -n "$auth" ]; then args+=(-H "Authorization: Bearer $auth"); fi
  if [ -n "$data" ]; then args+=(-d "$data"); fi
  curl "${args[@]}" "$url"
}

split_status() { echo "$1" | tail -n1; }
split_body() { echo "$1" | sed '$d'; }

# --- 1. super-admin login ---
RESP="$(req POST "$BASE/auth/super-admin/login" '{"email":"superadmin@example.com","password":"SuperSecret123!"}')"
CODE="$(split_status "$RESP")"; BODY="$(split_body "$RESP")"
SA_TOKEN="$(echo "$BODY" | jget token)"
if [ "$CODE" = "200" ] && [ -n "$SA_TOKEN" ]; then pass "super-admin login (200, token)"; else fail "super-admin login (got $CODE)"; fi

# --- 2. create org ---
RESP="$(req POST "$BASE/organizations" "{\"name\":\"$ORG_NAME\"}" "$SA_TOKEN")"
CODE="$(split_status "$RESP")"; BODY="$(split_body "$RESP")"
ORG_ID="$(echo "$BODY" | jget_num id)"
if [ "$CODE" = "201" ] && [ -n "$ORG_ID" ]; then pass "create org $ORG_NAME (201)"; else fail "create org (got $CODE): $BODY"; fi

# --- 3. org_admin signup ---
RESP="$(req POST "$BASE/auth/signup" "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$PASS\",\"organizationName\":\"$ORG_NAME\",\"role\":\"org_admin\"}")"
CODE="$(split_status "$RESP")"; BODY="$(split_body "$RESP")"
if [ "$CODE" = "201" ]; then pass "org_admin signup (201)"; else fail "org_admin signup (got $CODE): $BODY"; fi

# --- 4. org_admin login ---
RESP="$(req POST "$BASE/auth/login" "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$PASS\"}")"
CODE="$(split_status "$RESP")"; BODY="$(split_body "$RESP")"
ADMIN_TOKEN="$(echo "$BODY" | jget token)"
if [ "$CODE" = "200" ] && [ -n "$ADMIN_TOKEN" ]; then pass "org_admin login (200, token)"; else fail "org_admin login (got $CODE): $BODY"; fi

# --- 5. create flag dark_mode ---
RESP="$(req POST "$BASE/flags" '{"feature_key":"dark_mode"}' "$ADMIN_TOKEN")"
CODE="$(split_status "$RESP")"; BODY="$(split_body "$RESP")"
FLAG_ID="$(echo "$BODY" | jget_num id)"
if [ "$CODE" = "201" ] && [ -n "$FLAG_ID" ]; then pass "create flag dark_mode (201)"; else fail "create flag (got $CODE): $BODY"; fi

# --- 6. list flags contains dark_mode ---
RESP="$(req GET "$BASE/flags" '' "$ADMIN_TOKEN")"
CODE="$(split_status "$RESP")"; BODY="$(split_body "$RESP")"
if [ "$CODE" = "200" ] && echo "$BODY" | grep -q '"feature_key":"dark_mode"'; then pass "list flags contains dark_mode (200)"; else fail "list flags (got $CODE): $BODY"; fi

# --- 7. PATCH enable flag ---
RESP="$(req PATCH "$BASE/flags/$FLAG_ID" '{"enabled":true}' "$ADMIN_TOKEN")"
CODE="$(split_status "$RESP")"; BODY="$(split_body "$RESP")"
ENABLED="$(echo "$BODY" | jget_bool enabled)"
if [ "$CODE" = "200" ] && [ "$ENABLED" = "true" ]; then pass "PATCH enable flag (200, enabled=true)"; else fail "PATCH enable flag (got $CODE): $BODY"; fi

# --- 8. end_user signup ---
RESP="$(req POST "$BASE/auth/signup" "{\"email\":\"$USER_EMAIL\",\"password\":\"$PASS\",\"organizationName\":\"$ORG_NAME\",\"role\":\"end_user\"}")"
CODE="$(split_status "$RESP")"; BODY="$(split_body "$RESP")"
if [ "$CODE" = "201" ]; then pass "end_user signup (201)"; else fail "end_user signup (got $CODE): $BODY"; fi

# --- 9. end_user login ---
RESP="$(req POST "$BASE/auth/login" "{\"email\":\"$USER_EMAIL\",\"password\":\"$PASS\"}")"
CODE="$(split_status "$RESP")"; BODY="$(split_body "$RESP")"
USER_TOKEN="$(echo "$BODY" | jget token)"
if [ "$CODE" = "200" ] && [ -n "$USER_TOKEN" ]; then pass "end_user login (200, token)"; else fail "end_user login (got $CODE): $BODY"; fi

# --- 10. end_user check dark_mode -> true ---
RESP="$(req POST "$BASE/flags/check" '{"feature_key":"dark_mode"}' "$USER_TOKEN")"
CODE="$(split_status "$RESP")"; BODY="$(split_body "$RESP")"
ENABLED="$(echo "$BODY" | jget_bool enabled)"
if [ "$CODE" = "200" ] && [ "$ENABLED" = "true" ]; then pass "end_user check dark_mode -> enabled:true"; else fail "check dark_mode (got $CODE): $BODY"; fi

# --- 11. end_user check missing_key -> false ---
RESP="$(req POST "$BASE/flags/check" '{"feature_key":"missing_key"}' "$USER_TOKEN")"
CODE="$(split_status "$RESP")"; BODY="$(split_body "$RESP")"
ENABLED="$(echo "$BODY" | jget_bool enabled)"
if [ "$CODE" = "200" ] && [ "$ENABLED" = "false" ]; then pass "end_user check missing_key -> enabled:false"; else fail "check missing_key (got $CODE): $BODY"; fi

# --- 12. negative: end_user POST /flags -> 403 ---
RESP="$(req POST "$BASE/flags" '{"feature_key":"hack"}' "$USER_TOKEN")"
CODE="$(split_status "$RESP")"
if [ "$CODE" = "403" ]; then pass "end_user POST /flags -> 403"; else fail "end_user POST /flags expected 403 got $CODE"; fi

# --- 13. negative: super-admin GET /flags -> 403 ---
RESP="$(req GET "$BASE/flags" '' "$SA_TOKEN")"
CODE="$(split_status "$RESP")"
if [ "$CODE" = "403" ]; then pass "super-admin GET /flags -> 403"; else fail "super-admin GET /flags expected 403 got $CODE"; fi

# --- 14. DELETE flag -> 204 ---
RESP="$(req DELETE "$BASE/flags/$FLAG_ID" '' "$ADMIN_TOKEN")"
CODE="$(split_status "$RESP")"
if [ "$CODE" = "204" ]; then pass "DELETE flag (204)"; else fail "DELETE flag expected 204 got $CODE"; fi

# --- 15. end_user check dark_mode again -> false ---
RESP="$(req POST "$BASE/flags/check" '{"feature_key":"dark_mode"}' "$USER_TOKEN")"
CODE="$(split_status "$RESP")"; BODY="$(split_body "$RESP")"
ENABLED="$(echo "$BODY" | jget_bool enabled)"
if [ "$CODE" = "200" ] && [ "$ENABLED" = "false" ]; then pass "end_user check dark_mode after delete -> enabled:false"; else fail "check after delete (got $CODE): $BODY"; fi

echo "-----------------------------------------"
if [ "$FAILED" = "0" ]; then
  echo "ALL STEPS PASSED"
  exit 0
else
  echo "SOME STEPS FAILED"
  exit 1
fi
