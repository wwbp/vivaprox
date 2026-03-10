# r5-deployment-webrtc-test

A Pipecat AI voice agent built with a realtime speech-to-speech pipeline.

## Configuration

- **Bot Type**: Web
- **Transport(s)**: SmallWebRTC
- **Pipeline**: Realtime
  - **Service**: OpenAI Realtime
- **Features**:
  - Audio Recording
  - Transcription
  - Observability (Whisker + Tail)

## Setup

### Prerequisites

1. Docker Desktop (or Docker Engine + Docker Compose plugin)

### First-time setup

1. Work from this stack directory:

   ```bash
   cd stacks/r5-deployment-webrtc-test
   ```

2. Create env files:

   ```bash
   cp server/.env.example server/.env
   cp client/env.example client/.env.local
   ```

3. Edit `server/.env` and set your `OPENAI_API_KEY` (and optional model/instructions).

### Run with Docker + Make (recommended)

1. Start services:

   ```bash
   make start
   ```

2. Open:

   - App: `http://localhost:3000`
   - Bot server: `http://localhost:7860/health`

3. Useful commands:

   - `make logs` (all services)
   - `make logs SERVICE=server`
   - `make logs SERVICE=client`
   - `make stop`

### Run without Docker (manual dev mode)

Server:

```bash
cd server
uv sync
uv run bot.py --host 0.0.0.0 --port 7860
```

Client:

```bash
cd client
npm install
npm run dev -- --hostname 0.0.0.0
```

Open `http://localhost:3000`.

## Project Structure

```
r5-deployment-webrtc-test/
├── .devcontainer/        # Local compose + devcontainer config
│   ├── devcontainer.json
│   └── docker-compose.yml
├── Makefile              # make start/stop/logs entry points
├── server/              # Python bot server
│   ├── bot.py           # Main bot implementation
│   ├── Dockerfile.local # Local server container image
│   ├── pyproject.toml   # Python dependencies
│   ├── .env.example     # Environment variables template
│   ├── .env             # Your API keys (git-ignored)
│   └── ...
├── client/              # React application
│   ├── Dockerfile.local # Local client container image
│   ├── src/             # Client source code
│   ├── env.example      # Client environment variables template
│   ├── package.json     # Node dependencies
│   └── ...
├── .gitignore           # Git ignore patterns
└── README.md            # This file
```
## Observability

This project includes observability tools to help you debug and monitor your bot:

### Whisker - Live Pipeline Debugger

**Whisker** is a live graphical debugger that lets you visualize pipelines and debug frames in real time.

With Whisker you can:

- 🗺️ View a live graph of your pipeline
- ⚡ Watch frame processors flash in real time as frames pass through them
- 📌 Select a processor to inspect the frames it has handled
- 🔍 Filter frames by name to quickly find the ones you care about
- 🧵 Select a frame to trace its full path through the pipeline
- 💾 Save and load previous sessions for review and troubleshooting

**To use Whisker:**

1. Run an ngrok tunnel to expose your bot:

   ```bash
   ngrok http 9090
   ```

   > Tip: Use `--subdomain` for a repeatable ngrok URL

2. Navigate to [https://whisker.pipecat.ai/](https://whisker.pipecat.ai/) and enter your ngrok URL (e.g., `your-subdomain.ngrok.io`)

3. Once your bot is running, press connect

### Tail - Terminal Dashboard

**Tail** is a terminal dashboard that lets you monitor your Pipecat sessions in real time.

With Tail you can:

- 📜 Follow system logs in real time
- 💬 Track conversations as they happen
- 🔊 Monitor user and agent audio levels
- 📈 Keep an eye on service metrics and usage

**To use Tail:**

1. Run your bot (in one terminal)

2. Launch Tail in another terminal:
   ```bash
   pipecat tail
   ```
## Learn More

- [Pipecat Documentation](https://docs.pipecat.ai/)
- [Voice UI Kit Documentation](https://voiceuikit.pipecat.ai/)
- [Pipecat GitHub](https://github.com/pipecat-ai/pipecat)
- [Pipecat Examples](https://github.com/pipecat-ai/pipecat-examples)
- [Discord Community](https://discord.gg/pipecat)
