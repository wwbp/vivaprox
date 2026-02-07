# r0-dev-exploration

Primary stack: LiveKit media server + Pipecat agent runner + Next.js client.

**Quickstart (Docker)**
1. Move into this recipe.
```bash
cd recipes/r0-dev-exploration
```
2. Create env files.
```bash
cp agent-runner/.env.runner.example agent-runner/.env.runner
cp web-client/.env.web.example web-client/.env.web
```
3. Fill in API keys.
4. Start the stack.
```bash
make start
```
5. Open `http://localhost:3000` and start a call.

Health check: `http://localhost:7860/health` should return JSON.

**Commands**
- `make start`: build and start services.
- `make stop`: stop services.
- `make test`: run available checks.

**Environment**
- See `agent-runner/.env.runner.example` and `web-client/.env.web.example` for required keys.
- Keep `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` consistent across services.
- For Docker Compose, set `BOT_RUNNER_URL=http://agent-runner:7860/`.
