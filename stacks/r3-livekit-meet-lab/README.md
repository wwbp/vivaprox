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
2. Start tunnel to local Meet:
```bash
ngrok http 3001
```
3. Share room link:
```text
https://<your-ngrok-domain>/rooms/<roomName>
```

Keep the ngrok process running while others test.

## Commands

- `make start`
- `make stop`
- `make logs SERVICE=<service>` where service is `agent-runner`, `web-client`, `meet`, or `transport-server`
- `make test`

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
