# VivaProx

Study conversations where they happen. Analyze with tools you trust.

**Start Here (Docker)**
Requires Docker + Docker Compose.

1. Move into the main recipe.
```bash
cd recipes/r0-dev-exploration
```
2. Create env files.
```bash
cp agent-runner/.env.runner.example agent-runner/.env.runner
cp web-client/.env.web.example web-client/.env.web
```
3. Fill in API keys.
4. Start the stack.
```bash
make start
```
5. Open `http://localhost:3000` and start a call.

Health check: `http://localhost:7860/health` should return JSON.

**More**

- `recipes/r1-eval-s2s-openai/README.md`: eval pipeline using OpenAI Realtime.
- `notebooks/README.md`: notebook setup and usage.
