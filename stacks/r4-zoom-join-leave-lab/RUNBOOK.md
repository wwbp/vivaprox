# R4 Runbook (Zoom Join/Leave)

This is the tight step log for moving from local feasibility to real Zoom participant join.

## Target

- Keep `concierge-controller` and `agent-runner` unchanged.
- Make `zoom-connector` the only integration seam.
- Validate join/leave as repeatable experiments.

## Step 1: Baseline Control Loop (Mock)

### Setup

```bash
cd stacks/r4-zoom-join-leave-lab
cp zoom-connector/.env.connector.example zoom-connector/.env.connector
cp agent-runner/.env.runner.example agent-runner/.env.runner
cp concierge-controller/.env.controller.example concierge-controller/.env.controller
```

### Run

```bash
make start
make smoke
```

### QA Gate

- `make smoke` passes.
- `GET /api/bots` is empty after leave.

## Step 2: Worker Lifecycle Loop (Process Mode)

### Configure

`zoom-connector/.env.connector.local`:

```dotenv
ZOOM_CONNECTOR_MODE=process
ZOOM_WORKER_JOIN_COMMAND=python /app/scripts/fake_zoom_worker.py --bot-id {bot_id} --meeting-url {meeting_url} --meeting-id {meeting_number} --passcode {meeting_passcode} --session-id {session_id}
```

### Run

```bash
make stop
make start
make smoke
```

### QA Gate

- Connector logs show worker start on join and worker stop on leave.
- `make smoke` remains green.

## Step 3: Real Zoom Worker Command

Replace `ZOOM_WORKER_JOIN_COMMAND` with your real headless Zoom worker executable/script command.

Required command inputs:

- `{meeting_number}`
- `{meeting_passcode}`
- `{bot_id}`
- `{session_id}`

### QA Gate

- Worker process stays alive while meeting is active.
- Connector returns `200` on `/join` and `/leave`.
- Worker exits cleanly on leave request.

## Step 4: Live Zoom Meeting Validation

From concierge UI (`http://localhost:3000`):

1. Submit a real Zoom meeting URL.
2. Verify bot appears in Zoom participant list.
3. Click leave.
4. Verify participant is removed.

### QA Gate

- Join latency acceptable for prototype.
- Leave always removes participant.
- No orphan worker processes after leave.

## Experiment Log

| Date (UTC) | Step | Result | Notes |
|---|---|---|---|
| 2026-02-16 | Step 1 | Passed | Local control loop validated. |
| 2026-02-16 | Step 2 | Passed | Process mode worker lifecycle validated with fake worker. |
| 2026-02-16 | Step 3 | Pending | Wire real headless Zoom worker command. |
| 2026-02-16 | Step 4 | Pending | Run live meeting join/leave validation. |
