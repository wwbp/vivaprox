# Web Client

Next.js app for bot test calls and Desk admin.

## Quickstart

1. Create env.
```bash
cp .env.web.example .env.web
```
2. From `stacks/r3-livekit-meet-lab`, start stack.
```bash
make start
```
3. Open:
- `http://localhost:3000` bot test client
- `http://localhost:3000/desk` admin console

Core Desk flow:
- create room (optionally auto-start one bot)
- share join link for many participants
- update room metadata
- stop bot / delete room
- monitor `room` + `bot` health per room via `GET /api/concierge/rooms/:roomName/health`

## Key Env

- `LIVEKIT_URL`: browser-facing LiveKit URL
- `LIVEKIT_URL_INTERNAL`: server-side LiveKit URL for Desk admin calls (Docker: `ws://transport-server:7880`)
- `BOT_RUNNER_URL`: bot runner start endpoint (Docker: `http://agent-runner:7860/`)
- `MEET_BASE_URL` (optional): base URL used in generated human invite links (default `http://<host>:3001`)

Desk webhook receiver endpoint: `POST /api/concierge/webhooks/livekit`.
