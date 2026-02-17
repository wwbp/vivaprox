# r2-eval-s2s-gemini

A Pipecat AI voice agent built with a realtime speech-to-speech pipeline (Gemini Live).

**Prerequisites**

1. Docker Desktop or Docker Engine with the Docker Compose plugin installed

**First-Time Setup**

1. Working directory `cd stacks/r2-eval-s2s-gemini`
2. Server environment variables `cp server/.env.example server/.env` and set `GOOGLE_API_KEY`
3. Client environment variables `cp client/.env.example client/.env`

**Run**

1. Start Docker daemon engine
2. `make start`
3. Open `http://localhost:3000` to chat (click connect)
4. `make down` to stop

***Notes***

- Recordings are saved under `server/recordings/`.
- Use Incognito/Private mode to avoid clearing cache when development changes are in progress.

**Update Config**

1. Edit `server/.env` and set `GOOGLE_SYSTEM_INSTRUCTION=...`
2. Optional: set `GOOGLE_VOICE_ID=...` to change the voice (see supported voices below)
3. `make down`
4. `make start` to rebuild and apply the new instructions

Voice options (name and style):

| Voice | Style |
| --- | --- |
| Zephyr | Bright |
| Kore | Firm |
| Orus | Firm |
| Autonoe | Bright |
| Umbriel | Easy-going |
| Erinome | Clear |
| Laomedeia | Upbeat |
| Schedar | Even |
| Achird | Friendly |
| Sadachbia | Lively |
| Puck | Upbeat |
| Fenrir | Excitable |
| Aoede | Breezy |
| Enceladus | Breathy |
| Algieba | Smooth |
| Algenib | Gravelly |
| Achernar | Soft |
| Gacrux | Mature |
| Zubenelgenubi | Casual |
| Sadaltager | Knowledgeable |
| Charon | Informative |
| Leda | Youthful |
| Callirrhoe | Easy-going |
| Iapetus | Clear |
| Despina | Smooth |
| Rasalgethi | Informative |
| Alnilam | Firm |
| Pulcherrima | Forward |
| Vindemiatrix | Gentle |
| Sulafat | Warm |

ref: see supported voices: <https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api/configure-language-voice#voices_supported>
