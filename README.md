<div align="center">

# 🛰️ Project Sentinel
### The Agentic AI Project Co-ordinator

**Explainable. Deterministic-first. Human-in-the-loop.**

</div>

Project Sentinel helps teams plan, execute, monitor, recover, and deliver
projects. Unlike black-box AI tools, **every recommendation carries its
reasoning, evidence, triggered rules, calculations, and confidence** — so a
human (or a hackathon judge) can see exactly *why* Sentinel said what it said.

---

## Core philosophy

> **AI assists human decisions. AI does not make unexplained decisions. AI does not invent project facts.**

| Use **deterministic algorithms** for… | Use **LLMs** only for… |
| --- | --- |
| scheduling (CPM/PERT), critical path, float | document understanding |
| resource allocation & workload balancing | summarisation |
| dependency mapping, cycle detection | clarification questions |
| rule-based risk scoring | report/stakeholder drafting |
| project health, success probability | meeting minutes |
| what-if simulation | natural-language explanation |

Every engine emits an `Explanation` object: `summary`, `reasoning`, `evidence`,
`rules_triggered`, `calculations`, `assumptions`, `alternatives`, `confidence`.

---

## What's inside

```
project-sentinel/
├── backend/            FastAPI + SQLAlchemy + engines + agents + LangGraph
│   └── app/
│       ├── engines/        ← deterministic engines (CPM, PERT, DAG, risk, health…)
│       ├── agents/         ← 19 explainable agents
│       ├── workflows/      ← LangGraph planning pipeline
│       ├── api/routers/    ← REST API (/api/v1)
│       ├── models/         ← 40-table schema
│       ├── rag/            ← chunk → embed → Chroma → cite
│       └── seed/           ← realistic sample data
├── frontend/           Next.js 14 + TS + Tailwind + Recharts + React Flow
├── docs/               20 docs with Mermaid diagrams
├── docker-compose.yml  Postgres + Redis + Chroma + backend + frontend
└── .github/workflows/  CI: lint, test, build, security scan
```

### The engines (the reason it's not a black box)

| Engine | Does | Key maths |
| --- | --- | --- |
| **Scheduling** | timeline, critical path | PERT `(O+4M+P)/6`, CPM forward/backward pass, float `LS-ES` |
| **Dependency** | DAG, cycles, SPOF | DFS cycle detection, Kahn topological sort |
| **Resource** | skill-matched allocation | match = `coverage·0.7 + expertise/5·0.3`, capacity-aware |
| **Risk** | rule-based risks | YAML rulebook, score `= P·I/25·100` |
| **Health** | 0–100 health | weighted sum of 11 dimensions, rescue < 50 |
| **Success** | delivery probability | transparent weighted model (25/20/20/15/10/10) |
| **Simulation** | digital twin what-ifs | re-runs the real engines on a mutated state |
| **Methodology** | Waterfall/Scrum/Kanban/Hybrid | rule-based + PMBOK mapping |

### The agents

Document Analysis · Gap Detection · Intake · Project DNA · Methodology ·
Work Breakdown · Resource Allocation · Dependency · Timeline · Risk · Health ·
Success · Recovery · Rescue · Next-Best-Action · Reporting · Executive Copilot ·
Meeting Minutes · **Judge Explainability**.

---

> 🚀 **New to the project or setting up a fresh machine?** Read
> **[QUICKSTART.md](QUICKSTART.md)** — no-Docker setup, demo logins, sample data,
> and a one-command end-to-end test (`python samples/smoke_test.py`).

## Quick start (Docker — recommended)

```bash
cp .env.example .env
docker compose up --build
```

- Frontend → http://localhost:3000
- API docs → http://localhost:8000/docs
- Health   → http://localhost:8000/health

The backend auto-runs migrations and seeds demo data on start.

### Demo logins

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@sentinel.dev` | `admin123` |
| Project Manager | `pm@sentinel.dev` | `pm123456` |
| Viewer | `view@sentinel.dev` | `view1234` |

## Quick start (local, zero infra — no Docker)

The backend defaults to **SQLite** and a **mock LLM**, so it runs with no
Postgres, Redis, or API keys. One command sets up the venv, installs the minimal
deps, seeds the DB, and starts the API:

```bash
bash run.sh                          # → http://localhost:8000/docs

# second terminal — the UI:
cd frontend && npm install && npm run dev   # http://localhost:3000
```

Or do it by hand (use **`requirements-local.txt`** — it omits the PostgreSQL
driver and uses version ranges, so it installs cleanly on Python 3.11–3.14):

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-local.txt   # SQLite-only, no compiling
python -m app.seed.run_seed
uvicorn app.main:app --reload
```

> `requirements.txt` is the **full production stack** (PostgreSQL, LangGraph,
> ChromaDB, Celery) — best installed on Python 3.11/3.12 or via Docker.
> `requirements-local.txt` is the lean SQLite path for a laptop.

## Tests

```bash
cd backend && pytest --cov=app        # engines + API (80%+ target on engines)
```

The deterministic engine tests are pure Python and run anywhere.

---

## Documentation

Start with [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), then
[`docs/JUDGE_EXPLAINABILITY.md`](docs/JUDGE_EXPLAINABILITY.md) for the demo
walkthrough. Engine internals, the database ERD, security controls, and the
decision log are all under [`docs/`](docs/).

## License

MIT — see [LICENSE](LICENSE).
