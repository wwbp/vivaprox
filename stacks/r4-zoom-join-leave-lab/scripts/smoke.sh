#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
RUNNER_URL="${RUNNER_URL:-http://localhost:7860}"
CONNECTOR_URL="${CONNECTOR_URL:-http://localhost:8787}"
MEETING_URL="${MEETING_URL:-https://example.zoom.us/j/123456789}"

wait_for_http() {
  local url="$1"
  local name="$2"
  local attempts="${3:-40}"

  for ((i = 1; i <= attempts; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "timed out waiting for $name at $url" >&2
  return 1
}

echo "[1/5] health checks"
wait_for_http "$RUNNER_URL/health" "agent-runner"
wait_for_http "$CONNECTOR_URL/health" "zoom-connector"
wait_for_http "$BASE_URL/api/bots" "concierge-controller api"

echo "[2/5] join via concierge API"
join_payload=$(printf '{"meetingUrl":"%s"}' "$MEETING_URL")
join_response=$(curl -fsS -X POST "$BASE_URL/api/bots" -H 'Content-Type: application/json' -d "$join_payload")
flat_response=$(echo "$join_response" | tr -d '\n ')
bot_id=$(echo "$flat_response" | sed -n 's/.*"bot_id":"\([^"]*\)".*/\1/p')

if [[ -z "$bot_id" ]]; then
  echo "failed to parse bot_id from join response: $join_response" >&2
  exit 1
fi

echo "[3/5] verify bot listed as active"
list_response=$(curl -fsS "$BASE_URL/api/bots")
if ! echo "$list_response" | rg -q "$bot_id"; then
  echo "bot_id not found in active list: $list_response" >&2
  exit 1
fi

echo "[4/5] leave bot"
curl -fsS -X POST "$BASE_URL/api/bots/$bot_id/leave" >/dev/null

echo "[5/5] verify bot removed from active list"
post_leave_list=$(curl -fsS "$BASE_URL/api/bots")
if echo "$post_leave_list" | rg -q "$bot_id"; then
  echo "bot_id still present after leave: $post_leave_list" >&2
  exit 1
fi

echo "smoke test passed"
