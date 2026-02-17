COMPOSE = docker compose -f .devcontainer/docker-compose.yml
LOG_TAIL ?= 200
SERVICE ?=

.PHONY: up down start stop logs test

up:
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down

start: up

stop: down

logs:
	$(COMPOSE) logs -f --tail=$(LOG_TAIL) $(SERVICE)

test:
	@set -e; \
	if [ -d agent-runner/tests ]; then \
	  $(COMPOSE) run --rm agent-runner uv run python -m pytest; \
	else \
	  echo "agent-runner: no tests configured"; \
	fi; \
	if [ -f web-client/package.json ]; then \
	  $(COMPOSE) run --rm web-client sh -lc "pnpm install && pnpm lint"; \
	else \
	  echo "web-client: not found"; \
	fi
