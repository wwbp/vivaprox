# r1-eval-s2s-openai

A Pipecat AI voice agent built with a realtime speech-to-speech pipeline.

**Server**
1. `cd server`
2. `uv sync`
3. `cp .env.example .env` and add API keys
4. `uv run bot.py` (SmallWebRTC)

**Client**
1. `cd client`
2. `npm install`
3. `cp env.example .env.local` (defaults to localhost:7860)
4. `npm run dev`
5. Open `http://localhost:3000`
