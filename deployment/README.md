# Deployment

See [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) for the full guide.

## Contents
- `nginx.conf` — production reverse proxy (TLS + routing) placed in front of the
  `frontend` and `backend` services.

## Production checklist
1. Set a strong `SECRET_KEY` (32+ bytes) and rotate regularly.
2. Point `DATABASE_URL` at managed PostgreSQL; run `alembic upgrade head`.
3. Set `LLM_PROVIDER` to `openai`/`azure` with credentials (defaults to `mock`).
4. Enable ChromaDB (`CHROMA_HOST`) for persistent RAG storage.
5. Terminate TLS at the proxy (`nginx.conf`) or your load balancer.
6. Set restrictive `CORS_ORIGINS`.
7. Run the `worker` profile for background jobs: `docker compose --profile workers up`.
