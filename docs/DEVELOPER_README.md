# Developer Playbook

- Python package and project manager <https://docs.astral.sh/uv/>
- Pipecat Quickstart in /examples/

# Architecure

1. Media Server- Livekit
2. Agent Server- FastAPI
    1. Pipeline Orchestrator- Pipecat
    2. Agent Processor- Kani
3. Client-
    1. Web Client- React
    2. Telephony Client- Twilio

# Development Setup

1. local development
    1. docker-compose up --build
