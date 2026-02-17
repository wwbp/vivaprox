# VivaProx

Local stack for live study conversations with bots in LiveKit.

## Quickstart (Recommended)

Prereqs:
- Docker Desktop
- API keys: Deepgram, OpenAI, Cartesia

1. Setup files.
```bash
cd stacks/r3-livekit-meet-lab
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
- `http://localhost:3000/concierge` admin console
- `http://localhost:3001` Meet UI
5. Health: `http://localhost:7860/health`
6. Stop:
```bash
make stop
```

## Common Commands

```bash
make start
make stop
make logs SERVICE=web-client
make logs SERVICE=agent-runner
make logs SERVICE=meet
make logs SERVICE=transport-server
```

## Stacks

- `stacks/r0-dev-exploration/README.md` baseline dev stack
- `stacks/r1-eval-s2s-openai/README.md` OpenAI eval pipeline
- `stacks/r2-eval-s2s-gemini/README.md` Gemini eval pipeline
- `stacks/r3-livekit-meet-lab/README.md` Meet + Concierge admin stack
- `stacks/r4-zoom-join-leave-lab/README.md` Zoom join/leave control-plane stack
- `notebooks/README.md` notebook workflow
