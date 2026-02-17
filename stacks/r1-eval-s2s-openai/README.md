# r1-eval-s2s-openai

A Pipecat AI voice agent built with a realtime speech-to-speech pipeline.

**Prerequisites**

1. Docker Desktop or Docker Engine with the Docker Compose plugin installed

**First-Time Setup**

1. Working directory `cd stacks/r1-eval-s2s-openai`
2. Server environment variables `cp server/.env.example server/.env` and add OpenAI API key
3. Client environment variables `cp client/.env.example client/.env`

**Run**

1. Start Docker daemon engine
2. `make start`
3. Open `http://localhost:3000` to chat (click connect)
4. `make down` to stop

***Notes***

- Use Incognito/Private mode to avoid clearing cache when development changes are in progress.
- Recordings are saved under `server/recordings/`.

**Update Config**

1. Edit `server/.env` and set `OPENAI_INSTRUCTIONS=...`
2. Optional: set `OPENAI_VOICE=...` to change the voice (see supported voices below)
3. `make down`
4. `make start` to rebuild and apply the new instructions

Voice options (name):

| Voice |
| --- |
| alloy |
| ash |
| ballad |
| coral |
| echo |
| sage |
| shimmer |
| verse |
| marin |
| cedar |

Ref: <https://platform.openai.com/docs/guides/realtime-conversations#voice-options>
