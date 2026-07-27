# Contributing to Project Sentinel

Thanks for contributing. Sentinel's value rests on one discipline: **anything computable is computed by a deterministic engine, and every output explains itself.** Keep that invariant and the rest follows.

## Ground Rules

1. **Deterministic-first.** If a value can be computed, compute it in an engine — never ask the LLM for it. LLMs are for language only (understanding, summarising, clarifying, drafting).
2. **Everything explains itself.** Any new engine output or agent result must return a populated `Explanation` (summary, reasoning, evidence, rules_triggered, calculations, confidence).
3. **Pure engines.** Engines in `backend/app/engines/` must be pure Python with no framework/DB/network dependencies, so they stay unit-testable and reproducible.
4. **No raw SQL.** All persistence goes through SQLAlchemy models.
5. **Secrets via env only.** Never commit keys or hardcode secrets.

## Branch, Commit & PR Conventions

- **Branches:** `feature/<slug>`, `fix/<slug>`, `docs/<slug>`, `chore/<slug>`. Branch off `main`.
- **Commits:** Conventional Commits — `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`. Keep them small and focused.
- **Pull requests:**
  - Describe the change, the reasoning, and how you tested it.
  - Link the issue.
  - Include/adjust tests; the backend coverage gate is **80%+**.
  - Ensure lint, type-checks, and the full test suite pass in CI (which runs with `LLM_PROVIDER=mock`).
  - Update the relevant doc under `docs/` when behaviour changes.
  - At least one review approval before merge; squash-merge to keep history clean.

## Code Style

**Python (backend)**
- Target Python 3.11, `from __future__ import annotations`, full type hints.
- Format/lint with the project's ruff config; keep functions small and named clearly.
- Dataclasses for engine value objects; provide a `to_dict()` for anything crossing the API boundary.
- Docstrings on modules and public methods explaining *what and why*, matching the existing engine style.

**TypeScript (frontend)**
- TypeScript strict mode; validate external data with Zod.
- Server state via TanStack Query; client/UI state via Zustand.
- Tailwind for styling; Recharts for charts; React Flow for graphs.
- Component tests with React Testing Library; key flows with Playwright.

## How to Add an Engine

1. Create `backend/app/engines/<name>.py`. Make it **pure Python**; import `Explanation`, `Evidence`, `Calculation` from `.explain`.
2. Implement the computation. Build and return an `Explanation` alongside the result (populate reasoning, evidence, and named calculations with their formulas and inputs).
3. Provide a `@dataclass` result type with a `to_dict()`.
4. Export the engine in `backend/app/engines/__init__.py`.
5. Add unit tests in `backend/tests/engines/test_<name>.py` asserting exact outputs and boundary behaviour.
6. Wire an agent to it (below) and document it in a new `docs/<NAME>_ENGINE.md`.

## How to Add an Agent

1. Create the agent in `backend/app/agents/`. Define its `name`, `purpose`, and Pydantic input/output schemas.
2. **Delegate all computation to an engine.** Use the LLM only for language (and require citations/evidence when you do).
3. Emit an `Explanation`, set an appropriate `confidence`, and write an `agent_run` + `audit_log`.
4. Add the agent as a node in the relevant LangGraph workflow in `backend/app/workflows/`, respecting ordering constraints (e.g. Dependency before Timeline).
5. Add tests and update [AGENT_DESIGN.md](./AGENT_DESIGN.md).

## How to Add a Risk Rule

Risk rules are **data, not code** — no engine change needed.

1. Ensure the metric you gate on is computed by an engine and placed into the `RiskContext` (add it to the metric glossary in `risk_rules.yaml` if new).
2. Append a rule block to `backend/app/engines/risk_rules.yaml` with a unique `rule_id`, `condition {metric, op, value}`, `threshold`, `severity`, `rationale`, and `recommended_action`.
3. Add a boundary test in `tests/engines/test_risk.py` (fires just past the threshold; does **not** fire at it).
4. Note it in [RISK_ENGINE.md](./RISK_ENGINE.md).

## Local Checks Before Opening a PR

```bash
cd backend && pytest --cov=app        # tests + coverage
cd frontend && npm run test           # component tests
cd frontend && npx playwright test    # e2e
```

Run the linters/type-checkers the CI uses (ruff for Python, ESLint + `tsc` for the frontend) and make sure they are clean.

## Documentation

Docs live in `docs/`. When you change behaviour, update the matching document and keep any Mermaid diagrams valid (inside a fenced `mermaid` code block). Accuracy to the shipped code is the standard — docs describe the system as actually built.
