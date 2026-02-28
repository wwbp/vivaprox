COMPOSE = docker compose -f .devcontainer/docker-compose.yml
LOG_TAIL ?= 200
SERVICE ?=

.PHONY: up down start stop logs test test-unit test-integration

up:
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down -v

start: up

stop: down

logs:
	$(COMPOSE) logs -f --tail=$(LOG_TAIL) $(SERVICE)

test: test-unit test-integration

test-unit:
	$(COMPOSE) up -d transport-server agent-runner web-client
	$(COMPOSE) exec -T agent-runner uv run python -m unittest discover -s tests -p "test_*.py" -v
	$(COMPOSE) exec -T web-client pnpm lint

test-integration:
	$(COMPOSE) up -d transport-server agent-runner web-client
	$(COMPOSE) exec -T web-client pnpm test:api
	$(COMPOSE) exec -T web-client pnpm test:load
