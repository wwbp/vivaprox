# Agent Runner

FastAPI service that spawns a Pipecat pipeline and joins a LiveKit room.

**Quickstart (Docker)**
1. Ensure `agent-runner/.env.runner` is populated.
2. From `stacks/r0-dev-exploration`:
```bash
make start
```
3. Health check: `http://localhost:7860/health`.

**Local Dev**
1. Create env file.
```bash
cp .env.runner.example .env.runner
```
2. Install deps and run.
```bash
uv sync
uv run python runner.py
```

**Environment**
- Required keys are listed in `.env.runner.example`.
- `LIVEKIT_URL` must be reachable from where this service runs.
- Optional local overrides: `.env.runner.local`.
