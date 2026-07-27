.PHONY: help up down seed test backend frontend lint clean

help:
	@echo "Project Sentinel — common tasks"
	@echo "  make up        Build & start the full stack (Docker Compose)"
	@echo "  make down      Stop the stack"
	@echo "  make seed      Seed the local backend database"
	@echo "  make backend   Run the backend locally (SQLite, mock LLM)"
	@echo "  make frontend  Run the frontend locally"
	@echo "  make test      Run backend tests"
	@echo "  make lint      Lint backend (ruff)"
	@echo "  make clean     Remove build artefacts and local DB"

up:
	docker compose up --build

down:
	docker compose down

seed:
	cd backend && python -m app.seed.run_seed

backend:
	cd backend && uvicorn app.main:app --reload

frontend:
	cd frontend && npm run dev

test:
	cd backend && pytest -q

lint:
	cd backend && ruff check app

clean:
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
	rm -f backend/sentinel.db backend/test.db
