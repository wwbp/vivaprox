# LiveKit Meet Lab

A local development stack combining conferencing, voice agent, and admin UI in a single Next.js app.

## Services

| Service | Port | Role |
|---------|------|------|
| `transport-server` | 7880 | LiveKit media server |
| `agent-runner` | 7860 | FastAPI — spawns Pipecat voice bots |
| `meet` | 3000 | Next.js 16 — conferencing, voice agent UI, Concierge admin |

## Quick Start

**Prerequisites:** Docker Desktop, OpenAI API key.

```bash
cd stacks/r3-livekit-meet-lab
cp agent-runner/.env.runner.example agent-runner/.env.runner   # set OPENAI_API_KEY
cp meet/.env.local.example meet/.env.local
make start
```

Open:
- `http://localhost:3000` — voice agent
- `http://localhost:3000/desk` — Concierge admin
- `http://localhost:3000/rooms/<name>` — Meet conferencing
- `http://localhost:7860/health` — agent-runner health check

## Commands

```bash
make start                          # build + start all services
make stop                           # stop and remove volumes
make logs SERVICE=meet              # tail service logs (agent-runner | meet | transport-server)
make test                           # unit + integration tests
make test-bot-longevity             # long-running bot drop timing test
make setup-livekit-cloud \
  LIVEKIT_CLOUD_URL=wss://... \
  LIVEKIT_API_KEY=... \
  LIVEKIT_API_SECRET=...            # switch to LiveKit Cloud
make revert-livekit-local           # revert to local LiveKit
make test-livekit-tooling           # test the cloud-switch script
```

Bot longevity test knobs (all optional):

| Variable | Default | Meaning |
|----------|---------|---------|
| `BOT_LONGEVITY_MAX_SECONDS` | `1050` | Test fails if bot drops before this many seconds |
| `BOT_LONGEVITY_POLL_SECONDS` | `5` | Polling interval |
| `BOT_LONGEVITY_MESSAGE_SECONDS` | `10` | Interval between chat messages sent to bot |

## Environment

`LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` must match across both env files. Local defaults are `devkey` / `secret`.

| File | Key variables |
|------|--------------|
| `agent-runner/.env.runner` | `OPENAI_API_KEY`, `LIVEKIT_URL=ws://transport-server:7880` |
| `meet/.env.local` | `LIVEKIT_URL_PUBLIC=ws://localhost:7880`, `LIVEKIT_URL_INTERNAL=ws://transport-server:7880`, `BOT_RUNNER_URL=http://localhost:7860/` |

## Remote demos with ngrok (optional)

For external access, first point the stack at a public LiveKit endpoint (LiveKit Cloud recommended):

```bash
make setup-livekit-cloud \
  LIVEKIT_CLOUD_URL=wss://<project>.livekit.cloud \
  LIVEKIT_API_KEY=<key> \
  LIVEKIT_API_SECRET=<secret>
make start
```

Verify the public URL is returned:

```bash
docker compose -f .devcontainer/docker-compose.yml exec -T meet \
  curl -sS "http://localhost:3000/api/connection-details?roomName=smoke&participantName=smoke"
```

Then tunnel port 3000:

```bash
ngrok http 3000
```

Share links of the form `https://<ngrok-domain>/rooms/<roomName>`.

Revert when done:

```bash
make revert-livekit-local && make start
```

## Known constraints

- All concierge state is in-memory — a `meet` restart clears all room claims and bot assignments.
- `livekit-server:latest` is unpinned; pin before any production deployment.
- LiveKit runs in `--dev` mode (`devkey`/`secret`, no security checks).
- Token TTL is 15 minutes with no refresh path.
