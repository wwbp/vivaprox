# r1-eval-s2s-openai

A Pipecat AI voice agent built with a realtime speech-to-speech pipeline.

**Prerequisites**

1. Docker Desktop or Docker Engine with the Docker Compose plugin installed

**First-Time Setup**

1. Working directory `cd recipes/r1-eval-s2s-openai`
2. Server environment variables `cp server/.env.example server/.env` and add OpenAI API key
3. Client environment variables `cp client/.env.example client/.env`

**Run**

1. Start Docker daemon engine
2. `make start`
3. Open `http://localhost:3000` to chat (click connect)
4. `make down` to stop

**Testing Instructions Prompt**

1. Edit `server/.env` and set `OPENAI_INSTRUCTIONS=...`
2. `make down`
3. `make start` to rebuild and apply the new instructions

**Notes**

- Use Incognito/Private mode to avoid clearing cache when development changes are in progress.
- Recordings are saved under `server/recordings/`.
