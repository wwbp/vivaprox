# LiveKit Meet Lab

A local stack with:
- LiveKit transport server
- Bot runner
- Bot test client
- Meet UI
- Desk admin UI

## Status

- Prototype only (not production-ready).
- Room lifecycle and bot assignment still need more hardening.

## Quick Start

Before you start:
- Docker Desktop
- OpenAI API key

1. Create local env files.
```bash
cd stacks/r3-livekit-meet-lab
cp agent-runner/.env.runner.example agent-runner/.env.runner
cp web-client/.env.web.example web-client/.env.web
cp meet/.env.local.example meet/.env.local
```
2. Open `agent-runner/.env.runner` and set:
- `OPENAI_API_KEY`
3. Start the stack.
```bash
make start
```
4. Open these pages:
- `http://localhost:3000` bot test client
- `http://localhost:3000/desk` Desk admin
- `http://localhost:3001` Meet UI
5. Optional health check:
- `http://localhost:7860/health`

## Share Meet with ngrok (optional)

Use this when you want someone outside your network to open your local Meet UI.

1. Install ngrok and add your auth token (one-time):
```bash
brew install ngrok/ngrok/ngrok
ngrok config add-authtoken <YOUR_AUTHTOKEN>
```
2. For remote demos, first switch LiveKit URLs to a public endpoint (recommended: LiveKit Cloud):
```bash
make setup-livekit-cloud \
  LIVEKIT_CLOUD_URL=wss://<your-project>.livekit.cloud \
  LIVEKIT_API_KEY=<your_api_key> \
  LIVEKIT_API_SECRET=<your_api_secret>
make start
```
3. Verify Meet now returns a public LiveKit URL (not localhost):
```bash
docker compose -f .devcontainer/docker-compose.yml exec -T meet \
  curl -sS "http://localhost:3000/api/connection-details?roomName=smoke&participantName=smoke"
```
Expected: `serverUrl` is `wss://...livekit.cloud`.
4. Start tunnel to Meet:
```bash
ngrok http 3001
```
5. Share room link:
```text
https://<your-ngrok-domain>/rooms/<roomName>
```

Keep the ngrok process running while others test.

### Revert to local LiveKit (disconnect from cloud account)

When done with remote demos, set URLs back to local defaults and restart:

1. Update env files:
- `agent-runner/.env.runner`: `LIVEKIT_URL=ws://transport-server:7880`
- `web-client/.env.web`: `LIVEKIT_URL=ws://localhost:7880`
- `web-client/.env.web`: `LIVEKIT_URL_INTERNAL=ws://transport-server:7880` (optional, recommended)
- `meet/.env.local`: `LIVEKIT_URL_PUBLIC=ws://localhost:7880`
- `meet/.env.local`: `LIVEKIT_URL_INTERNAL=ws://transport-server:7880`
- `meet/.env.local`: `LIVEKIT_URL=ws://localhost:7880`
2. Restart:
```bash
make start
```

## Commands

- `make start`
- `make stop`
- `make logs SERVICE=<service>` where service is `agent-runner`, `web-client`, `meet`, or `transport-server`
- `make test`
- `make test-bot-longevity` (minimal long-running bot drop timing test)
- `make setup-livekit-cloud LIVEKIT_CLOUD_URL=... LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=...`

Bot longevity test knobs:
- `BOT_LONGEVITY_MAX_SECONDS=<n>` (default `1050`; test fails if bot drops before this)
- `BOT_LONGEVITY_POLL_SECONDS=<n>` (default `5`)
- `BOT_LONGEVITY_MESSAGE_SECONDS=<n>` (default `10`)

## Env Notes

- Keep `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` the same in:
  - `agent-runner/.env.runner`
  - `web-client/.env.web`
  - `meet/.env.local`
- Default local values:
  - `agent-runner/.env.runner`: `LIVEKIT_URL=ws://transport-server:7880`
  - `web-client/.env.web`: `BOT_RUNNER_URL=http://agent-runner:7860/`
  - `web-client/.env.web`: `LIVEKIT_URL_INTERNAL=ws://transport-server:7880` (optional, recommended)
  - `meet/.env.local`: `LIVEKIT_URL_PUBLIC=ws://localhost:7880`
- Optional invite-link override in Desk: `MEET_BASE_URL=http://localhost:3001`.
- Optional webhook ingest endpoint for monitoring: `POST /api/concierge/webhooks/livekit`.
- Room-level and bot-level health endpoint: `GET /api/concierge/rooms/:roomName/health`.
