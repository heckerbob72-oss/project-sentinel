#!/usr/bin/env bash
#
# Project Sentinel — one-command local run (no Docker, no PostgreSQL).
# Sets up a virtualenv, installs the minimal SQLite deps, seeds the demo
# database, and starts the backend API on http://localhost:8000/docs
#
# Usage:  bash run.sh
#
# Then, in a second terminal, start the UI:
#     cd frontend && npm install && npm run dev   # http://localhost:3000
#
set -euo pipefail

cd "$(dirname "$0")/backend"

echo "==> Creating virtual environment (.venv)"
python3 -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate

echo "==> Upgrading pip"
python -m pip install --upgrade pip >/dev/null

echo "==> Installing minimal local dependencies (SQLite + mock LLM)"
pip install -r requirements-local.txt

echo "==> Seeding demo database (SQLite)"
python -m app.seed.run_seed

echo ""
echo "==> Starting Project Sentinel API"
echo "    API docs:  http://localhost:8000/docs"
echo "    Login:     pm@sentinel.dev / pm123456"
echo ""
exec uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
