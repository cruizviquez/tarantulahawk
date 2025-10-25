#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"

blue() { echo -e "\033[34m$*\033[0m"; }
green() { echo -e "\033[32m$*\033[0m"; }
red() { echo -e "\033[31m$*\033[0m"; }

blue "TarantulaHawk Smoke Test"
blue "Base URL: ${BASE_URL}"

# 1) Health endpoint
blue "[1/4] Checking /api/health..."
HEALTH=$(curl -sS "${BASE_URL}/api/health")
if echo "$HEALTH" | grep -q '"ok":true'; then
  green "Health OK"
else
  red "Health failed:" && echo "$HEALTH" && exit 1
fi

# 2) Rate limit headers
blue "[2/4] Checking rate limit headers..."
HEADERS=$(curl -sSI "${BASE_URL}/api/health")
if echo "$HEADERS" | grep -qi "x-ratelimit-limit"; then
  green "Rate limit headers present"
else
  red "No rate limit headers detected (middleware may be inactive)"
fi

# 3) Turnstile verify endpoint (expect failure without token)
blue "[3/4] Checking /api/turnstile/verify (expected failure)..."
RESP=$(curl -sS -X POST "${BASE_URL}/api/turnstile/verify" -H 'Content-Type: application/json' -d '{"token":"invalid"}') || true
if echo "$RESP" | grep -q 'success'; then
  red "Unexpected success; expected failure for invalid token" && echo "$RESP" && exit 1
else
  green "Turnstile verify endpoint responding"
fi

# 4) Usage endpoint (unauthenticated check)
blue "[4/4] Checking /api/usage (expected 401 when not logged in)..."
CODE=$(curl -sS -o /dev/null -w "%{http_code}" "${BASE_URL}/api/usage")
if [[ "$CODE" == "401" || "$CODE" == "404" ]]; then
  green "Usage endpoint protected (status: $CODE)"
else
  red "Unexpected status for /api/usage: $CODE" && exit 1
fi

green "\nAll checks completed."
