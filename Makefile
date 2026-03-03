# AgentOps Observer - Makefile
# Enterprise-Grade Observability Platform for AI Agents

.PHONY: help dev migrate migrate-down seed test lint format clean install docker-up docker-down api collector web sdk-python sdk-typescript

# Default target
help:
	@echo "AgentOps Observer - Development Commands"
	@echo ""
	@echo "Setup & Development:"
	@echo "  make install      - Install all dependencies"
	@echo "  make dev          - Start all services for local development"
	@echo "  make docker-up    - Start Docker services (DB, Redis, Kafka)"
	@echo "  make docker-down  - Stop Docker services"
	@echo ""
	@echo "Database:"
	@echo "  make migrate      - Run database migrations"
	@echo "  make migrate-down - Rollback last migration"
	@echo "  make seed         - Seed database with demo data"
	@echo ""
	@echo "Testing & Quality:"
	@echo "  make test         - Run all tests"
	@echo "  make lint         - Run linters"
	@echo "  make format       - Format code"
	@echo ""
	@echo "Individual Services:"
	@echo "  make api          - Start API server"
	@echo "  make collector    - Start event collector"
	@echo "  make web          - Start frontend dev server"

# ============================================================================
# INSTALLATION
# ============================================================================

install: install-api install-collector install-sdk-python install-web
	@echo "All dependencies installed successfully"

install-api:
	@echo "Installing API dependencies..."
	cd apps/api && pip install -e ".[dev]"

install-collector:
	@echo "Installing Collector dependencies..."
	cd apps/collector && pip install -e ".[dev]"

install-sdk-python:
	@echo "Installing Python SDK..."
	cd packages/sdk-python && pip install -e ".[dev]"

install-web:
	@echo "Installing Web dependencies..."
	cd apps/web && npm install

# ============================================================================
# DOCKER SERVICES
# ============================================================================

docker-up:
	@echo "Starting Docker services..."
	docker-compose -f infrastructure/docker/docker-compose.yml up -d
	@echo "Waiting for services to be healthy..."
	@sleep 5
	@echo "Docker services started successfully"

docker-down:
	@echo "Stopping Docker services..."
	docker-compose -f infrastructure/docker/docker-compose.yml down

docker-logs:
	docker-compose -f infrastructure/docker/docker-compose.yml logs -f

docker-clean:
	docker-compose -f infrastructure/docker/docker-compose.yml down -v --remove-orphans

# ============================================================================
# DATABASE
# ============================================================================

migrate:
	@echo "Running database migrations..."
	cd apps/api && alembic upgrade head
	@echo "Migrations completed successfully"

migrate-down:
	@echo "Rolling back last migration..."
	cd apps/api && alembic downgrade -1

migrate-create:
	@echo "Creating new migration..."
	cd apps/api && alembic revision --autogenerate -m "$(name)"

seed:
	@echo "Seeding database with demo data..."
	cd scripts && python seed_demo.py
	@echo "Database seeded successfully"

db-reset: docker-down docker-clean docker-up
	@echo "Waiting for database to be ready..."
	@sleep 10
	$(MAKE) migrate
	$(MAKE) seed

# ============================================================================
# DEVELOPMENT SERVERS
# ============================================================================

api:
	@echo "Starting API server..."
	cd apps/api && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

collector:
	@echo "Starting Event Collector..."
	cd apps/collector && uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

web:
	@echo "Starting Web frontend..."
	cd apps/web && npm run dev

# Start all services for development
dev:
	@echo "Starting AgentOps Observer development environment..."
	$(MAKE) docker-up
	@echo "Waiting for services to initialize..."
	@sleep 5
	$(MAKE) migrate
	@echo ""
	@echo "============================================"
	@echo "AgentOps Observer is ready!"
	@echo "============================================"
	@echo ""
	@echo "Start the services in separate terminals:"
	@echo "  Terminal 1: make api       (http://localhost:8000)"
	@echo "  Terminal 2: make collector (http://localhost:8001)"
	@echo "  Terminal 3: make web       (http://localhost:3000)"
	@echo ""
	@echo "API Docs: http://localhost:8000/docs"
	@echo "Dashboard: http://localhost:3000"
	@echo ""

# Run all services concurrently (requires concurrently npm package)
dev-all: docker-up
	@sleep 5
	$(MAKE) migrate
	npx concurrently -n "api,collector,web" -c "blue,green,yellow" \
		"cd apps/api && uvicorn app.main:app --reload --port 8000" \
		"cd apps/collector && uvicorn app.main:app --reload --port 8001" \
		"cd apps/web && npm run dev"

# ============================================================================
# TESTING
# ============================================================================

test: test-api test-collector test-sdk-python test-web
	@echo "All tests passed"

test-api:
	@echo "Running API tests..."
	cd apps/api && pytest -v --cov=app --cov-report=term-missing

test-collector:
	@echo "Running Collector tests..."
	cd apps/collector && pytest -v --cov=app --cov-report=term-missing

test-sdk-python:
	@echo "Running Python SDK tests..."
	cd packages/sdk-python && pytest -v --cov=agentops --cov-report=term-missing

test-web:
	@echo "Running Web tests..."
	cd apps/web && npm test

# ============================================================================
# CODE QUALITY
# ============================================================================

lint: lint-python lint-web
	@echo "Linting completed"

lint-python:
	@echo "Linting Python code..."
	ruff check apps/api apps/collector packages/sdk-python
	mypy apps/api apps/collector packages/sdk-python --ignore-missing-imports

lint-web:
	@echo "Linting Web code..."
	cd apps/web && npm run lint

format: format-python format-web
	@echo "Formatting completed"

format-python:
	@echo "Formatting Python code..."
	ruff format apps/api apps/collector packages/sdk-python
	ruff check --fix apps/api apps/collector packages/sdk-python

format-web:
	@echo "Formatting Web code..."
	cd apps/web && npm run format

# ============================================================================
# BUILD & PRODUCTION
# ============================================================================

build: build-api build-collector build-web build-sdk-python
	@echo "All builds completed"

build-api:
	@echo "Building API Docker image..."
	docker build -t agentops-api:latest -f apps/api/Dockerfile apps/api

build-collector:
	@echo "Building Collector Docker image..."
	docker build -t agentops-collector:latest -f apps/collector/Dockerfile apps/collector

build-web:
	@echo "Building Web app..."
	cd apps/web && npm run build

build-sdk-python:
	@echo "Building Python SDK..."
	cd packages/sdk-python && python -m build

# ============================================================================
# CLEANUP
# ============================================================================

clean:
	@echo "Cleaning up..."
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".next" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "dist" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	@echo "Cleanup completed"
