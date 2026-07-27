#!/usr/bin/env bash
# Run the backend locally with SQLite + mock LLM (no external infra needed).
set -euo pipefail
cd "$(dirname "$0")/../backend"
python -m app.seed.run_seed
exec uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
