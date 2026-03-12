#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BENCH_BASE_URL:-http://127.0.0.1:3000}"
CONNECTIONS="${BENCH_CONNECTIONS:-25}"
DURATION="${BENCH_DURATION_SEC:-20}"
PIPELINING="${BENCH_PIPELINING:-1}"

BENCH_USER_EMAIL="${BENCH_USER_EMAIL:-bench.user@example.com}"
BENCH_USER_PASSWORD="${BENCH_USER_PASSWORD:-supersecurepass123}"
BENCH_USER_FULL_NAME="${BENCH_USER_FULL_NAME:-Bench User}"

json_escape() {
  printf '%s' "$1" | sed 's/"/\\"/g'
}

register_or_ignore_conflict() {
  local payload
  payload="{\"email\":\"$(json_escape "$BENCH_USER_EMAIL")\",\"fullName\":\"$(json_escape "$BENCH_USER_FULL_NAME")\",\"password\":\"$(json_escape "$BENCH_USER_PASSWORD")\"}"

  local status
  status=$(curl -sS -o /tmp/bench-register-body.json -w '%{http_code}' \
    -X POST "${BASE_URL}/api/v1/auth/register" \
    -H 'content-type: application/json' \
    -d "$payload")

  if [[ "$status" == "500" ]] && rg -q "duplicate key value violates unique constraint" /tmp/bench-register-body.json; then
    return 0
  fi

  if [[ "$status" != "201" && "$status" != "409" ]]; then
    echo "register failed: expected 201/409, got ${status}"
    cat /tmp/bench-register-body.json || true
    exit 1
  fi
}

login_and_get_token() {
  local payload
  payload="{\"email\":\"$(json_escape "$BENCH_USER_EMAIL")\",\"password\":\"$(json_escape "$BENCH_USER_PASSWORD")\"}"

  BENCH_BASE_URL="$BASE_URL" BENCH_LOGIN_PAYLOAD="$payload" bun -e '
    const base = process.env.BENCH_BASE_URL;
    const payload = process.env.BENCH_LOGIN_PAYLOAD;

    if (!base || !payload) {
      console.error("missing BENCH_BASE_URL or BENCH_LOGIN_PAYLOAD");
      process.exit(1);
    }

    const res = await fetch(`${base}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
    });

    const body = await res.json();
    if (!res.ok || !body?.data?.accessToken) {
      console.error("login failed", res.status, JSON.stringify(body));
      process.exit(1);
    }

    process.stdout.write(body.data.accessToken);
  '
}

run_case() {
  local name="$1"
  local method="$2"
  local path="$3"
  local auth_header="${4:-}"
  local body="${5:-}"

  echo ""
  echo "=== ${name} (${method} ${path}) ==="

  local args=(
    -c "$CONNECTIONS"
    -d "$DURATION"
    -p "$PIPELINING"
    -m "$method"
  )

  if [[ -n "$auth_header" ]]; then
    args+=( -H "$auth_header" )
  fi

  if [[ -n "$body" ]]; then
    args+=( -H "content-type: application/json" -b "$body" )
  fi

  bunx autocannon "${args[@]}" "${BASE_URL}${path}"
}

echo "Running real API benchmark with:"
echo "  base_url=${BASE_URL} connections=${CONNECTIONS} duration=${DURATION}s pipelining=${PIPELINING}"

echo "Preparing benchmark user"
register_or_ignore_conflict
TOKEN="$(login_and_get_token)"
AUTH_HEADER="authorization: Bearer ${TOKEN}"

echo "Running benchmark cases"
run_case "real_healthz" "GET" "/healthz"
run_case "real_users_list" "GET" "/api/v1/users?limit=20&offset=0" "$AUTH_HEADER"

CREATE_EMAIL="bench.create.$(date +%s)@example.com"
CREATE_BODY="{\"email\":\"${CREATE_EMAIL}\",\"fullName\":\"Bench Created User\"}"
run_case "real_users_create" "POST" "/api/v1/users" "$AUTH_HEADER" "$CREATE_BODY"
