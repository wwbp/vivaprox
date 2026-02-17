# Agent Runner (Zoom Join/Leave)

Minimal FastAPI runner that tracks bot sessions and triggers Zoom join/leave through an adapter.

## Endpoints

- `POST /bots/join`
- `POST /bots/{bot_id}/leave`
- `GET /bots`
- `GET /health`

## Modes

- `ZOOM_CLIENT_MODE=stub`:
  - No external API call.
  - Useful for wiring concierge flow and validating control-plane logic.
- `ZOOM_CLIENT_MODE=webhook`:
  - Forwards join/leave JSON payloads to your external Zoom bot service.
  - In this stack, default endpoints target local `zoom-connector` for feasibility tests.

## Local Dev

```bash
cp .env.runner.example .env.runner
uv sync
uv run python runner.py
```

Health check: `http://localhost:7860/health`
