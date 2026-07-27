# Project Sentinel — Local Development Setup

This guide covers running Sentinel two ways: **locally without Docker** (fastest inner loop) and **with Docker Compose** (closest to production). Sentinel is designed to boot with **zero external infrastructure** — the backend defaults to SQLite and a deterministic `MockLLM`, so you can run the whole planning pipeline offline.

## Prerequisites

| Tool | Version |
| --- | --- |
| Python | 3.11 |
| Node.js | 18+ (for Next.js 14) |
| Docker + Docker Compose | latest (only for the Docker path) |
| PostgreSQL / Redis / ChromaDB | optional — provided by Docker Compose, or install locally |

## Option A — Local dev without Docker

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Configure environment (see the env var table below). The defaults already
# work with zero infra: SQLite + MockLLM.
cp .env.example .env

# Create tables and load deterministic seed data.
python -m app.seed.seed

# Run the API (http://localhost:8000, docs at /docs).
uvicorn app.main:app --reload --port 8000
```

With the default configuration the backend uses `sqlite:///./sentinel.db` and `LLM_PROVIDER=mock`, so no PostgreSQL, Redis, ChromaDB, or LLM key is required to start.

### 2. Frontend

```bash
cd frontend
npm install
# Point the frontend at the backend.
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1" > .env.local
npm run dev                        # http://localhost:3000
```

### 3. Optional local services

If you want the full stack without Compose, run PostgreSQL, Redis, and ChromaDB locally and point the env vars at them (see below). The app degrades gracefully when optional infra is absent.

## Option B — Docker Compose

```bash
# From the repository root.
docker compose up --build
```

Compose brings up the backend (FastAPI + Uvicorn), the frontend (Next.js), PostgreSQL, Redis, a Celery worker, and ChromaDB, wired together on an internal network. Compose overrides `DATABASE_URL` with the PostgreSQL service URL. See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full service list and production notes.

Seed the database inside the running backend container:

```bash
docker compose exec backend python -m app.seed.seed
```

Services after `up`:

- Frontend: <http://localhost:3000>
- Backend API: <http://localhost:8000> (interactive docs at `/docs`)
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- ChromaDB: `localhost:8001`

## Environment Variables

Configuration is centralised in `backend/app/config.py` (Pydantic settings, 12-factor, env-driven). All values have safe defaults; override via `.env` or real environment variables.

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_NAME` | `Project Sentinel` | Application name |
| `API_V1_PREFIX` | `/api/v1` | API route prefix |
| `ENVIRONMENT` | `development` | Deployment environment |
| `DEBUG` | `true` | Debug mode |
| `DATABASE_URL` | `sqlite:///./sentinel.db` | DB connection (Compose sets PostgreSQL) |
| `SECRET_KEY` | `change-me-…` | JWT signing key — **must** be overridden in prod |
| `JWT_ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `720` | Access token lifetime (12h) |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost |
| `CORS_ORIGINS` | `http://localhost:3000, http://127.0.0.1:3000` | Allowed frontend origins |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis / Celery broker |
| `CHROMA_HOST` | `null` | ChromaDB host (unset → local persistence) |
| `CHROMA_PORT` | `8001` | ChromaDB port |
| `CHROMA_PERSIST_DIR` | `./.chroma` | Local Chroma persistence dir |
| `LLM_PROVIDER` | `mock` | `mock` \| `openai` \| `azure` \| `ollama` |
| `LLM_MODEL` | `gpt-4o-mini` | Model name for the chosen provider |
| `OPENAI_API_KEY` | `null` | OpenAI / compatible key |
| `OPENAI_BASE_URL` | `null` | Override for OpenAI-compatible endpoints |
| `AZURE_OPENAI_ENDPOINT` | `null` | Azure OpenAI endpoint |
| `AZURE_OPENAI_API_KEY` | `null` | Azure OpenAI key |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama endpoint |
| `STORAGE_BACKEND` | `local` | `local` \| `s3` |
| `STORAGE_DIR` | `./storage` | Local storage directory |
| `S3_BUCKET` | `null` | S3-compatible bucket |
| `S3_ENDPOINT_URL` | `null` | S3-compatible endpoint |
| `MAX_UPLOAD_MB` | `25` | Max upload size |
| `ALLOWED_UPLOAD_EXTENSIONS` | `pdf, docx, txt, csv, json, md` | Upload type allowlist |
| `RATE_LIMIT_PER_MINUTE` | `120` | Per-client rate limit |

## Seeding

The seed script (`python -m app.seed.seed`) is deterministic — it loads a fixed set of users, roles/permissions, a sample project, team, skills, documents, WBS, dependencies, and risk rules so the whole pipeline and UI are demonstrable immediately. Re-running it is idempotent.

## Database Migrations

Schema is managed with Alembic:

```bash
cd backend
alembic upgrade head                       # apply latest migration
alembic revision --autogenerate -m "msg"   # create a new migration after model changes
```

For local SQLite bootstrap and tests, `app.database.init_db()` can create tables directly from the ORM metadata without Alembic.

## Running Tests

```bash
cd backend && pytest                        # backend unit + API tests
cd frontend && npm run test                 # React Testing Library
cd frontend && npx playwright test          # end-to-end
```

See [TESTING.md](./TESTING.md) for structure, engine test cases, and coverage targets.
