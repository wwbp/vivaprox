# Zoom Connector

Minimal join/leave endpoint service for r4 control flow.

## Endpoints

- `GET /health`
- `GET /sessions`
- `POST /join`
- `POST /leave`

## Modes

- `mock` (default):
  - deterministic in-memory join/leave responses
  - safest mode for stack smoke tests

- `process`:
  - runs `ZOOM_WORKER_JOIN_COMMAND` on join
  - runs optional `ZOOM_WORKER_LEAVE_COMMAND` on leave
  - tracks the worker PID and terminates it on leave/shutdown
  - intended as the fast prototype bridge to real Zoom worker scripts

## Process Mode Template Variables

Command templates support:

- `{bot_id}`
- `{meeting_url}`
- `{meeting_id}`
- `{meeting_number}` (parsed from URL path or `meeting_id` fallback)
- `{meeting_passcode}` (parsed from URL query `pwd` / `passcode`)
- `{session_id}`

Values are shell-escaped before substitution.

## Quick Local Process-Mode Test

In `zoom-connector/.env.connector`:

```dotenv
ZOOM_CONNECTOR_MODE=process
ZOOM_WORKER_JOIN_COMMAND=python /app/scripts/fake_zoom_worker.py --bot-id {bot_id} --meeting-url {meeting_url} --meeting-id {meeting_number} --passcode {meeting_passcode} --session-id {session_id}
```

Then run stack and smoke loop from `stacks/r4-zoom-join-leave-lab`.
