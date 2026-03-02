#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  scripts/setup_livekit_cloud.sh --url <LIVEKIT_CLOUD_URL> --api-key <LIVEKIT_API_KEY> --api-secret <LIVEKIT_API_SECRET>

Examples:
  scripts/setup_livekit_cloud.sh \
    --url wss://my-project.livekit.cloud \
    --api-key lkapi_xxx \
    --api-secret lksecret_xxx
EOF
}

upsert_env_key() {
  local file="$1"
  local key="$2"
  local value="$3"
  local tmp_file
  tmp_file="$(mktemp)"

  awk -v key="$key" -v value="$value" '
    BEGIN { replaced = 0 }
    $0 ~ "^" key "=" {
      if (!replaced) {
        print key "=" value
        replaced = 1
      }
      next
    }
    { print }
    END {
      if (!replaced) {
        print key "=" value
      }
    }
  ' "$file" > "$tmp_file"

  mv "$tmp_file" "$file"
}

ensure_env_file() {
  local file="$1"
  local example="$2"
  if [[ ! -f "$file" ]]; then
    cp "$example" "$file"
  fi
}

normalize_livekit_url() {
  local raw="$1"
  local normalized="$raw"

  if [[ "$normalized" == https://* ]]; then
    normalized="wss://${normalized#https://}"
  elif [[ "$normalized" == http://* ]]; then
    normalized="ws://${normalized#http://}"
  elif [[ "$normalized" != ws://* && "$normalized" != wss://* ]]; then
    echo "Error: --url must start with ws://, wss://, http://, or https://" >&2
    exit 1
  fi

  normalized="${normalized%/}"
  echo "$normalized"
}

LIVEKIT_CLOUD_URL="${LIVEKIT_CLOUD_URL:-}"
LIVEKIT_API_KEY_VALUE="${LIVEKIT_API_KEY:-}"
LIVEKIT_API_SECRET_VALUE="${LIVEKIT_API_SECRET:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)
      LIVEKIT_CLOUD_URL="${2:-}"
      shift 2
      ;;
    --api-key)
      LIVEKIT_API_KEY_VALUE="${2:-}"
      shift 2
      ;;
    --api-secret)
      LIVEKIT_API_SECRET_VALUE="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$LIVEKIT_CLOUD_URL" || -z "$LIVEKIT_API_KEY_VALUE" || -z "$LIVEKIT_API_SECRET_VALUE" ]]; then
  usage
  exit 1
fi

LIVEKIT_CLOUD_URL="$(normalize_livekit_url "$LIVEKIT_CLOUD_URL")"

RUNNER_ENV="$ROOT_DIR/agent-runner/.env.runner"
WEB_ENV="$ROOT_DIR/web-client/.env.web"
MEET_ENV="$ROOT_DIR/meet/.env.local"

ensure_env_file "$RUNNER_ENV" "$ROOT_DIR/agent-runner/.env.runner.example"
ensure_env_file "$WEB_ENV" "$ROOT_DIR/web-client/.env.web.example"
ensure_env_file "$MEET_ENV" "$ROOT_DIR/meet/.env.local.example"

upsert_env_key "$RUNNER_ENV" "LIVEKIT_URL" "$LIVEKIT_CLOUD_URL"
upsert_env_key "$RUNNER_ENV" "LIVEKIT_API_KEY" "$LIVEKIT_API_KEY_VALUE"
upsert_env_key "$RUNNER_ENV" "LIVEKIT_API_SECRET" "$LIVEKIT_API_SECRET_VALUE"

upsert_env_key "$WEB_ENV" "LIVEKIT_URL" "$LIVEKIT_CLOUD_URL"
upsert_env_key "$WEB_ENV" "LIVEKIT_URL_INTERNAL" "$LIVEKIT_CLOUD_URL"
upsert_env_key "$WEB_ENV" "LIVEKIT_API_KEY" "$LIVEKIT_API_KEY_VALUE"
upsert_env_key "$WEB_ENV" "LIVEKIT_API_SECRET" "$LIVEKIT_API_SECRET_VALUE"

upsert_env_key "$MEET_ENV" "LIVEKIT_URL_PUBLIC" "$LIVEKIT_CLOUD_URL"
upsert_env_key "$MEET_ENV" "LIVEKIT_URL_INTERNAL" "$LIVEKIT_CLOUD_URL"
upsert_env_key "$MEET_ENV" "LIVEKIT_URL" "$LIVEKIT_CLOUD_URL"
upsert_env_key "$MEET_ENV" "LIVEKIT_API_KEY" "$LIVEKIT_API_KEY_VALUE"
upsert_env_key "$MEET_ENV" "LIVEKIT_API_SECRET" "$LIVEKIT_API_SECRET_VALUE"

echo "Updated LiveKit env values for:"
echo "  - agent-runner/.env.runner"
echo "  - web-client/.env.web"
echo "  - meet/.env.local"
echo
echo "Using LIVEKIT URL: $LIVEKIT_CLOUD_URL"
echo
echo "Next:"
echo "  make start"
echo "  curl -fsS \"http://localhost:3001/api/connection-details?roomName=smoke&participantName=smoke\""
