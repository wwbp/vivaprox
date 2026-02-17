COMPOSE = docker compose -f .devcontainer/docker-compose.yml
LOG_TAIL ?= 200
SERVICE ?=

.PHONY: up down start stop logs
.PHONY: smoke

up:
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down -v

start: up

stop: down

logs:
	$(COMPOSE) logs -f --tail=$(LOG_TAIL) $(SERVICE)

smoke:
	bash scripts/smoke.sh
