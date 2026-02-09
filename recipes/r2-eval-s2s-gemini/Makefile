COMPOSE = docker compose -f .devcontainer/docker-compose.yml

.PHONY: up down start stop logs test

up:
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down -v

start: up

stop: down
