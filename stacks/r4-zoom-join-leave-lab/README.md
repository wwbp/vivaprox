# R4 Zoom Join/Leave Lab

Minimal stack for controlling bot join/leave against Zoom meetings.

This stack intentionally focuses on control-plane actions only:
- start bot join
- request bot leave
- inspect active sessions

Meeting creation, scheduling, and Zoom account lifecycle are expected to be handled by an external service.

Detailed implementation and QA steps are tracked in `RUNBOOK.md`.

## Stack

- `zoom-connector` (FastAPI): mock mode for deterministic tests, process mode for worker-based join/leave
- `agent-runner` (FastAPI): join/leave orchestration and session tracking
- `concierge-controller` (Next.js): simple operator UI for join/leave

## Quickstart

Prereqs:
- Docker Desktop

1. Setup env files.

```bash
cd stacks/r4-zoom-join-leave-lab
cp zoom-connector/.env.connector.example zoom-connector/.env.connector
cp agent-runner/.env.runner.example agent-runner/.env.runner
cp concierge-controller/.env.controller.example concierge-controller/.env.controller
```

2. Start stack.

```bash
make start
```

3. Open:
- `http://localhost:3000` Concierge controller
- `http://localhost:7860/health` Runner health

4. Stop:

```bash
make stop
```

## First Minimal Complete Step

Run a full local control loop (join -> list -> leave) through concierge API:

```bash
make smoke
```

This validates:
- `concierge-controller -> agent-runner -> zoom-connector` join path
- active session listing
- leave path and session removal

## Hacker Mode (Fast Feasibility)

If you want a fast bridge before full Zoom SDK integration, run connector in `process` mode and plug in any worker command.

In `zoom-connector/.env.connector`:

```dotenv
ZOOM_CONNECTOR_MODE=process
ZOOM_WORKER_JOIN_COMMAND=python /app/scripts/fake_zoom_worker.py --bot-id {bot_id} --meeting-url {meeting_url} --meeting-id {meeting_number} --passcode {meeting_passcode} --session-id {session_id}
```

Then run:

```bash
make start
make smoke
```

This validates the real control loop plus worker lifecycle control (spawn on join, terminate on leave).

## Runner Modes

In `agent-runner/.env.runner`:

- `ZOOM_CLIENT_MODE=stub`
  - No external Zoom call.
  - Useful for local control-flow wiring.

- `ZOOM_CLIENT_MODE=webhook`
  - Requires:
    - `ZOOM_JOIN_ENDPOINT`
    - `ZOOM_LEAVE_ENDPOINT`
  - Optional:
    - `ZOOM_API_TOKEN` for bearer auth

## External Zoom Adapter Contract

When in `webhook` mode, runner sends:

Join (`POST $ZOOM_JOIN_ENDPOINT`):

```json
{
  "bot_id": "bot_ab12cd34",
  "meeting_url": "https://...",
  "meeting_id": "123456789"
}
```

Leave (`POST $ZOOM_LEAVE_ENDPOINT`):

```json
{
  "bot_id": "bot_ab12cd34",
  "external_session_id": "optional-from-join-response",
  "meeting_url": "https://...",
  "meeting_id": "123456789"
}
```

Join response may optionally return:

```json
{
  "session_id": "external-session-123"
}
```

## API Notes

Runner endpoints:
- `POST /bots/join`
- `POST /bots/{bot_id}/leave`
- `GET /bots`
- `GET /health`
