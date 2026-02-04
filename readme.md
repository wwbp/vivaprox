# VivaProx

Study conversations where they happen. Analyze with tools you trust.

**Services**
- `transport-server`: LiveKit media server.
- `agent-runner`: FastAPI + Pipecat agent pipeline.
- `web-client`: Next.js UI.

**Quickstart (Docker)**
1. Create env files.
```bash
cp agent-runner/.env.runner.example agent-runner/.env.runner
cp web-client/.env.web.example web-client/.env.web
```
2. Fill in API keys.
3. Start the stack.
```bash
make start
```
4. Open `http://localhost:3000` and start a call.

**Validate**
- Health check: `http://localhost:7860/health` should return JSON.

**Common Commands**
- `make start`: build and start services.
- `make stop`: stop services.
- `make test`: run available checks.

**Environment**
- `agent-runner/.env.runner`: `DEEPGRAM_API_KEY`, `OPENAI_API_KEY`, `CARTESIA_API_KEY`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
- `web-client/.env.web`: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `BOT_RUNNER_URL`.

Keep `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` consistent across both services.
For Docker Compose, set `BOT_RUNNER_URL=http://agent-runner:7860/`.
