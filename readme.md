# VivaProx

I run this realtime voice-agent lab (Pipecat + web clients).

## Quick Start

1. Install Docker Desktop (with Compose) and `make`.
2. I start in `stacks/r0-dev-exploration`.
3. I open that stack `README.md`.
4. Copy env templates and add required API keys.
5. I run `make start`.
6. I open the local app URL from that stack README (usually `http://localhost:3000`).
7. I stop with `make stop`.

## Stacks

- `stacks/r0-dev-exploration`: baseline LiveKit + agent-runner + web-client.
- `stacks/r1-eval-s2s-openai`: OpenAI realtime speech-to-speech eval.
- `stacks/r2-eval-s2s-gemini`: Gemini Live speech-to-speech eval.
- `stacks/r3-livekit-meet-lab`: LiveKit Meet + desk tooling.
- `stacks/r4-zoom-join-leave-lab`: Zoom join/leave automation lab.
- `stacks/r5-deployment-webrtc-test`: SmallWebRTC deployment test stack.
- `notebooks`: experiments and analysis.

## Daily Workflow

1. I enter the stack: `cd stacks/<stack-name>`.
2. I start it: `make start`.
3. I inspect logs: `make logs` or `make logs SERVICE=<service>`.
4. Edit code (`server/` or `agent-runner/` for backend, `client/`, `web-client/`, or `meet/` for frontend).
5. I stop it: `make stop`.

## Notes

- I keep env files stack-local.
- If env or Dockerfiles change, I restart: `make stop && make start`.
- I treat each stack `README.md` as source of truth for ports and required keys.

## Known Issue (r3)

- In `stacks/r3-livekit-meet-lab`, LiveKit + Pipecat sessions can still hit memory growth/OOM in some camera-on flows.
- Symptom: bot drops after a few minutes, then bot start/proxy calls fail (`fetch failed` / 502) because `agent-runner` exited.
- I keep video ingest disabled by default and ignore video subscriptions unless explicitly enabled.
