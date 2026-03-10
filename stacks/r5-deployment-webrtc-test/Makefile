COMPOSE = docker compose -f .devcontainer/docker-compose.yml
LOG_TAIL ?= 200
SERVICE ?=

.PHONY: up down start stop logs

up:
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down

start: up

stop: down

logs:
	$(COMPOSE) logs -f --tail=$(LOG_TAIL) $(SERVICE)
