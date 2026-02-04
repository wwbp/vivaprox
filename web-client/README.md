# Web Client

Next.js UI that creates a LiveKit room, requests a bot session, and starts the call.

**Quickstart**
1. Create env file.
```bash
cp .env.web.example .env.web
```
2. Start with Docker from repo root.
```bash
make start
```

**Local Dev**
1. Install deps.
```bash
pnpm install
```
2. Run dev server.
```bash
pnpm dev
```

**Environment**
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `BOT_RUNNER_URL`.

For Docker Compose, set `BOT_RUNNER_URL=http://agent-runner:7860/`.
