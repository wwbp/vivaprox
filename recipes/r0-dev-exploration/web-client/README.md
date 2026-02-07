# Web Client

Next.js UI that creates a LiveKit room, requests a bot session, and starts the call.

**Quickstart**
1. Create env file.
```bash
cp .env.web.example .env.web
```
2. Start with Docker from `recipes/r0-dev-exploration`.
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
- Required keys are listed in `.env.web.example`.
- For Docker Compose, set `BOT_RUNNER_URL=http://agent-runner:7860/`.
