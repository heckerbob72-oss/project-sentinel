# docker/

The primary orchestration file is [`../docker-compose.yml`](../docker-compose.yml)
at the repository root, which builds and wires:

| Service | Image / build | Port |
| --- | --- | --- |
| `db` | postgres:16-alpine | 5432 |
| `redis` | redis:7-alpine | 6379 |
| `chroma` | chromadb/chroma | 8001→8000 |
| `backend` | `../backend/Dockerfile` | 8000 |
| `frontend` | `../frontend/Dockerfile` | 3000 |
| `worker` | `../backend/Dockerfile` (celery, `workers` profile) | — |

```bash
docker compose up --build          # full stack
docker compose --profile workers up # include the Celery worker
```

Per-service Dockerfiles live next to their code (`backend/Dockerfile`,
`frontend/Dockerfile`) so build contexts stay minimal.
