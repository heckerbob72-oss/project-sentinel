# Project Sentinel — Testing

Sentinel's deterministic-first design makes it exceptionally testable: every engine is a pure function of its inputs, so tests assert exact numeric outputs rather than fuzzy behaviour. The LLM is stubbed by a deterministic **MockLLM** in dev/test, so the entire pipeline runs offline and repeatably.

## Test Stack

| Layer | Tooling |
| --- | --- |
| Backend unit & integration | **Pytest** |
| Backend API | Pytest + FastAPI `TestClient` |
| Frontend components | **React Testing Library** |
| End-to-end | **Playwright** |

## Backend Structure

```
backend/tests/
  engines/     # pure-function tests for each deterministic engine
  api/         # API-level tests against the FastAPI app
```

Tests run with `LLM_PROVIDER=mock` and the default SQLite database (or an in-memory DB via `init_db()`), so no PostgreSQL, Redis, Chroma, or network is required.

```bash
cd backend
pytest                       # run all
pytest tests/engines -q      # engines only
pytest --cov=app --cov-report=term-missing   # with coverage
```

## Coverage Target

**80%+ line coverage** on the backend, enforced in CI. The deterministic engines are expected to sit near 100% because their inputs and outputs are fully enumerable.

## Engine Test Cases (representative)

These mirror the worked examples in the engine docs and pin the exact formulas.

### Scheduling (`tests/engines/test_scheduling.py`)

- **PERT** — `pert_expected(2, 4, 6) == 4.0`; `pert_variance(2, 6) == (4/6)**2`.
- **Critical path** — the diamond `A→B, A→C, B→D, C→D` yields `project_duration == 14`, `critical_path == ["A", "B", "D"]`, and `C.total_float == 4`.
- **Project std dev** — `≈ 1.915` for that example (sqrt of critical-path variance).
- **Deadline** — deadline 12 → `deadline_feasible is False`, `schedule_pressure ≈ 1.167`, `SCHEDULE_INFEASIBLE` triggered.
- **Cycle guard** — scheduling a cyclic graph raises `ValueError`.

### Dependency (`tests/engines/test_dependency.py`)

- **Cycle detection** — `T1→T2→T3→T1` gives `has_cycle is True` with the correct `cycle_path`; topo order is empty.
- **Topological sort** — an acyclic graph returns a valid Kahn ordering.
- **Bottleneck** — a node with fan_in 2 + fan_out 2 (score 4) is flagged at the default threshold.
- **SPOF** — a task that is the sole predecessor of ≥2 tasks appears in `single_points_of_failure`.

### Resource (`tests/engines/test_resource.py`)

- **Skill match** — required `[python, fastapi]` vs `{python:5, fastapi:3}` → `0.94`.
- **Capacity** — a task that would exceed capacity is not assigned to that member.
- **Overload / gaps** — utilisation > 1.0 flags overload; a missing skill is reported in `skill_gaps`; a backup owner is set when a second eligible member exists.

### Risk (`tests/engines/test_risk.py`)

- **Boundary** — `testing_window_days = 2` fires `RISK_TESTING_WINDOW_MINIMUM`; `= 3` does **not** (`op: "<"`, `threshold: 3`).
- **Scoring** — a `high` rule yields `score == 64.0`; `critical == 100.0`.
- **Missing metric** — a metric absent from `RiskContext` produces no risk (no false positives).

### Health (`tests/engines/test_health.py`)

- **Weights** — `DEFAULT_WEIGHTS` sums to 1.0.
- **Bands** — `status_for(85) == "green"`, `70 == "amber"`, `50 == "red"`, `30 == "critical"`.
- **Rescue** — overall < 50 sets `rescue_recommended is True` and triggers `HEALTH_RESCUE_THRESHOLD`.

### Simulation, Methodology, Success

- **Simulation** — `member_unavailable` lowers health; `capacity_increased` raises it; deltas match `after − before`; the baseline state is not mutated.
- **Methodology** — regulatory + high stability → `waterfall`; continuous + high change → `kanban`; low stability → `scrum`; else `hybrid`; explicit `preference` overrides.
- **Success** — factor weights sum to 100; probability equals the sum of factor points; weakest factors drive `improvement_actions`.

## API Tests (`tests/api/`)

- **Auth** — login returns a token; protected routes reject missing/invalid tokens (`401/403`); RBAC forbids under-privileged roles.
- **Envelope** — successful responses match `{status, data, explanation, audit_id, next_actions}`; errors match `{status, error_code, message, details, suggested_action}`.
- **Uploads** — disallowed extensions and oversized files are rejected; path-traversal filenames are sanitised.
- **RAG** — a query with no matching source returns the exact "No supporting source…" message and no fabricated citations.

## Frontend Testing

```bash
cd frontend
npm run test                 # React Testing Library (components, hooks, stores)
npx playwright test          # end-to-end user flows
```

- **RTL** covers components, TanStack Query hooks, and Zustand stores in isolation.
- **Playwright** covers key journeys: login → open project → view WBS → run schedule → inspect health → open the Explainability panel and confirm the reasoning/evidence render.

## Determinism Guarantee

Because engines are pure and the LLM is mocked, test outputs are stable across machines and runs. This is what allows CI to assert exact numbers (durations, scores, floats) rather than tolerances — and it is the same property that makes Sentinel's recommendations auditable in production.
