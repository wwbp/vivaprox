# VivaProx

Local lab for realtime voice bots, meeting integrations stacks.

## Status

Require evaluation pipeline for use case stacks.

## Core Tech Links

- Pipecat: [docs.pipecat.ai](https://docs.pipecat.ai) | [pipecat.ai](https://www.pipecat.ai)
- LiveKit: [docs.livekit.io](https://docs.livekit.io) | [livekit.io](https://livekit.io)

## Known Pitfall (LiveKit + Pipecat)

- In `pipecat-ai==0.0.90`, some LiveKit flows may still process inbound video tracks even when video input is disabled. In camera-on sessions this can cause `agent-runner` memory growth and container OOM (`ExitCode 137` / `OOMKilled=true`).
- Typical symptom chain: bot drops after a few minutes, then bot-start/API calls fail (`fetch failed` / 502) because `agent-runner` exited.
- Latest validation on March 2, 2026 (`stacks/r3-livekit-meet-lab`): single-user manual call remained stable for 18 minutes, and manual bot restart worked; multi-user longevity still pending.
- Mitigation pattern for new stacks:
  - Keep bot transport video ingest disabled (`video_in_enabled=False`).
  - Add a guard so video subscriptions are ignored unless video processing is explicitly enabled.
  - Set `agent-runner` restart policy in Compose (`restart: unless-stopped`) to reduce downtime after crashes while debugging.

## Top View

UI entry point:

- User in browser (`web-client` or `meet`) talks to the bot.
- UI captures mic audio and plays bot audio.

Core loop events:

1. Audio capture in browser.
2. Relay to backend (`agent-runner`) via LiveKit/WebRTC or other transport.
3. Transcribe or speech-to-speech ingest.
4. LLM reasoning (plus optional tool calls).
5. Audio synthesis (TTS or direct speech-to-speech output).
6. Relay synthesized audio back to browser.
7. Browser playback to user.

## Tools & Tech

- Containers and local orchestration: Docker Compose, Make
- Backend services: Python, FastAPI, Pipecat
- Frontend apps: Next.js, React
- Realtime media/control: LiveKit + WebRTC, Zoom join/leave adapter flow
- AI/speech APIs: OpenAI Realtime, Gemini Live, Deepgram, Cartesia
- Exploration workflow: Jupyter notebooks with `uv`

## Repo Map

- `stacks/r0-dev-exploration` baseline LiveKit + agent-runner + web-client
- `stacks/r1-eval-s2s-openai` speech-to-speech eval stack (OpenAI)
- `stacks/r2-eval-s2s-gemini` speech-to-speech eval stack (Gemini)
- `stacks/r3-livekit-meet-lab` Meet + Desk admin stack
- `notebooks` exploratory notebooks for TTS/S2S experiments

## Try it out

1. Pick a stack in `stacks/` and open its README.
2. Copy that stack's `.env` example files.
3. Add required API keys.
4. Run `make start` in the stack directory.
5. Open the local URLs listed in that stack README.

Stop with `make stop`.
