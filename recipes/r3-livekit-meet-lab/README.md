# LiveKit Meet Lab

Full local stack: LiveKit server, bot runner, bot test client, Meet UI, Concierge admin.

## Quickstart

Prereqs:
- Docker Desktop
- API keys: Deepgram, OpenAI, Cartesia

1. Setup files.
```bash
cd recipes/livekit-meet-lab
cp agent-runner/.env.runner.example agent-runner/.env.runner
cp web-client/.env.web.example web-client/.env.web
cp meet/.env.local.example meet/.env.local
```
2. Add keys in `agent-runner/.env.runner`:
- `DEEPGRAM_API_KEY`
- `OPENAI_API_KEY`
- `CARTESIA_API_KEY`
3. Start.
```bash
make start
```
4. Open:
- `http://localhost:3000` bot test client
- `http://localhost:3000/concierge` room and bot admin
- `http://localhost:3001` Meet UI
5. Health: `http://localhost:7860/health`

## Commands

- `make start`
- `make stop`
- `make logs SERVICE=<service>` where service is `agent-runner`, `web-client`, `meet`, or `transport-server`
- `make test`

## Env Notes

- Keep `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` the same across `agent-runner`, `web-client`, and `meet` env files.
- Docker defaults:
  - `agent-runner/.env.runner`: `LIVEKIT_URL=ws://transport-server:7880`
  - `web-client/.env.web`: `BOT_RUNNER_URL=http://agent-runner:7860/`
  - `web-client/.env.web`: `LIVEKIT_URL_INTERNAL=ws://transport-server:7880` (optional, recommended)
  - `meet/.env.local`: `LIVEKIT_URL_PUBLIC=ws://localhost:7880`
- Optional invite-link override in Concierge: `MEET_BASE_URL=http://localhost:3001`.
- Optional webhook ingest endpoint for monitoring: `POST /api/concierge/webhooks/livekit`.
