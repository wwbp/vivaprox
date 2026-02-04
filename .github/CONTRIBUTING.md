# Contributing

**Architecture**
1. Media server: LiveKit (`transport-server`).
2. Agent service: FastAPI + Pipecat (`agent-runner`).
3. Client: Next.js (`web-client`).

**Local Development**
1. Create env files.
```bash
cp agent-runner/.env.runner.example agent-runner/.env.runner
cp web-client/.env.web.example web-client/.env.web
```
2. Start services.
```bash
make start
```
