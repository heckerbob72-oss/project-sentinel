# Project Sentinel — Quickstart (fresh environment)

This gets you from an unzipped folder to a running app + a passing end-to-end
test, with **no Docker and no PostgreSQL** (the backend defaults to SQLite and a
built-in mock LLM). Everything here is self-contained.

## 0. Prerequisites

| Need | Version | Check |
| --- | --- | --- |
| Python | 3.11 – 3.14 | `python3 --version` |
| Node.js | 18+ (20 recommended) | `node --version` |

No API keys, no database server, no Redis. Nothing to sign up for.

---

## 1. Start the backend

### Option A — one command
```bash
cd project-sentinel
bash run.sh
```
This creates a virtualenv, installs the lean SQLite dependencies
(`backend/requirements-local.txt`), seeds the demo data, and starts the API at
**http://localhost:8000/docs**.

### Option B — by hand
```bash
cd project-sentinel/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-local.txt      # SQLite-only, no compiling
python -m app.seed.run_seed                # seeds 3 demo projects
uvicorn app.main:app --reload
```

You should see `Seed complete...` then Uvicorn starting. Leave it running.

> `requirements-local.txt` is the laptop path (SQLite, mock LLM).
> `requirements.txt` is the full production stack (PostgreSQL, LangGraph,
> ChromaDB, Celery) — use it with Docker or Python 3.11/3.12.

---

## 2. Start the frontend (second terminal)

```bash
cd project-sentinel/frontend
npm install          # first run only (~1–2 min)
npm run dev
```

Open **http://localhost:3000** and sign in.

### Demo logins
| Role | Email | Password |
| --- | --- | --- |
| Project Manager | `pm@sentinel.dev` | `pm123456` |
| Admin | `admin@sentinel.dev` | `admin123` |
| Team Lead | `lead@sentinel.dev` | `lead1234` |
| Contributor | `dev@sentinel.dev` | `dev12345` |
| Viewer | `view@sentinel.dev` | `view1234` |

Or create your own account on the **Register** page.

---

## 3. Test the agents & engines end-to-end

### a) Automated smoke test (recommended)
With the backend running, in a third terminal:
```bash
cd project-sentinel
python samples/smoke_test.py
```
Pure standard-library (no install). It logs in and exercises **every engine and
agent** through the API — auth, projects, CPM timeline, dependency DAG, risk
rules, health, success probability, resources, methodology, DNA, gaps, rescue,
recovery, document upload + RAG citations, digital-twin simulation, the full
multi-agent workflow, meeting minutes, executive draft, and the audit /
explainability trail — printing a ✓/✗ for each. Expect `RESULT: N passed, 0 failed`.

Point it elsewhere with `SENTINEL_API=http://localhost:8010/api/v1 python samples/smoke_test.py`.

### b) Backend unit tests
```bash
cd backend && source .venv/bin/activate
pip install pytest httpx
pytest -q
```
The deterministic engine tests (CPM, PERT, DAG, risk, health, resource,
simulation, methodology, success) are pure Python and always run.

### c) Sample data you can feed in
- **`samples/hackathon_brief.txt`** — a project brief. Upload it to test the
  Document Analysis + RAG agents (the smoke test does this automatically, or use
  `POST /api/v1/projects/1/documents` in the Swagger UI at `/docs`).
- **`samples/sample_project.json`** — a portable project (team, tasks,
  dependencies) you can POST to the planning endpoints.

### d) Explore in Swagger — http://localhost:8000/docs
1. `POST /api/v1/auth/login` → `{"email":"pm@sentinel.dev","password":"pm123456"}`
2. Copy `access_token`, click **Authorize**, paste it.
3. Try: `GET /projects/1/timeline`, `/risks`, `/health`, `/rescue`,
   `POST /projects/1/simulations` with `{"scenario":"deadline_shortened","params":{"days":3}}`.

---

## 4. What to click in the UI

Three seeded projects show different states:
- **Project Sentinel Demo** (hackathon) — amber, tight testing window
- **Customer Portal Revamp** — green, comfortable
- **Q3 Data Migration** — red / rescue-mode active

Suggested tour: **Dashboard → Work Breakdown → Timeline → Dependencies →
Risk Register → Health → Digital Twin Lab (run a scenario) → Explainability →
Control Tower → Portfolio → Rescue Mode** (switch the project selector to
*Q3 Data Migration* to see rescue mode fire).

Every page has an **Explanation** panel — that's the point of the product: no
recommendation is a black box.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `psycopg2` fails to build (`pg_config not found`) | You used `requirements.txt`; use `requirements-local.txt` — SQLite needs no driver. |
| Rust/wheel build errors on **Python 3.14** | Use `requirements-local.txt` (version ranges pick 3.14 wheels), or use Python 3.12. |
| `password cannot be longer than 72 bytes` | Old passlib issue — this build uses `bcrypt` directly; ensure you have the latest `backend/app/core/security.py`. |
| `invalid keyword argument ... for WBSItem` / schema errors after an update | Delete the old DB and re-seed: `rm backend/sentinel.db && python -m app.seed.run_seed`. |
| `uvicorn: command not found` | Activate the venv: `source .venv/bin/activate`. |
| Port 8000 in use | `uvicorn app.main:app --reload --port 8010` and set `NEXT_PUBLIC_API_URL=http://localhost:8010/api/v1` for the frontend. |
| Frontend can't reach API | Copy `frontend/.env.local.example` to `frontend/.env.local` and set `NEXT_PUBLIC_API_URL`. |

Reset everything: `rm -f backend/sentinel.db && python -m app.seed.run_seed`.
