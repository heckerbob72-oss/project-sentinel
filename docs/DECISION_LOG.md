# Project Sentinel — Architecture Decision Records

This log records the significant architecture decisions behind Sentinel and *why* they were made. Each record is intentionally short: context, decision, consequences.

---

## ADR-001 — Deterministic-first, LLM-for-language-only

**Status:** Accepted

**Context.** A "project co-ordinator" that lets an LLM guess schedules, risks, or resource plans would be neither trustworthy nor reproducible, and could not survive a hard *"why?"* from a stakeholder or judge. Scheduling, risk, allocation, health, simulation, and success probability are all *computable*.

**Decision.** Compute everything computable in pure-Python engines. Use LLMs strictly for language tasks — document understanding, summarisation, clarification questions, and report drafting. An LLM never decides a number an algorithm can.

**Consequences.**
- Outputs are reproducible: same inputs → same result, so tests assert exact numbers.
- Every computed result can be explained by the formula/rule that produced it.
- Slightly more up-front engineering (real algorithms) versus prompting — paid back in trust, testability, and auditability.

---

## ADR-002 — Engines live inside `backend/app/engines/`, not separate top-level packages

**Status:** Accepted

**Context.** The engines could have been extracted into standalone, separately-published packages. That adds versioning, packaging, and dependency-management overhead.

**Decision.** Keep the engines as a first-class module **inside the backend** (`backend/app/engines/`), while enforcing purity by convention: engines import only from `.explain` and the standard library — no FastAPI, no SQLAlchemy, no network.

**Consequences.**
- Zero packaging/version-skew overhead; one repo, one test suite, one CI pipeline.
- Engines remain trivially importable by agents, workflows, and the API without cross-package plumbing.
- Purity is preserved (they *are* unit-testable in isolation and reused unchanged by the digital twin), so we keep the benefits of separation without the cost of separate packages.
- If a future need arises to share engines with another service, the clean, dependency-free boundary makes extraction straightforward later.

---

## ADR-003 — A deterministic `MockLLM` for dev and test

**Status:** Accepted

**Context.** Depending on a live LLM for local development, CI, and demos is slow, costly, flaky, and network-bound — and it makes tests non-deterministic.

**Decision.** Ship a provider abstraction (`backend/app/llm/`) with a
deterministic **MockLLM** as the default (`LLM_PROVIDER=mock`) and a Groq
provider selected through environment variables (`LLM_PROVIDER=groq`).

**Consequences.**
- The whole pipeline runs offline with zero keys — ideal for onboarding, CI, and hackathon demos.
- Tests are deterministic and fast; CI needs no secrets.
- Swapping providers is a config change, not a code change.
- Reinforces ADR-001: since language is the only LLM job, a mock can stand in for it without breaking any computed result.

---

## ADR-004 — LangGraph for agent orchestration

**Status:** Accepted

**Context.** The planning pipeline is a long, ordered sequence of interdependent steps with branches (rescue mode, simulation, explainability) and human-in-the-loop gates. Ad-hoc function chaining would make ordering, state, and branching hard to reason about.

**Decision.** Orchestrate agents with **LangGraph** as an explicit state-machine graph in `backend/app/workflows/`, where each node is an agent operating on shared, typed state.

**Consequences.**
- Ordering constraints are explicit (e.g. Dependency must validate the DAG before Timeline schedules).
- Branches and human-approval gates are modelled as first-class graph edges.
- The shared state accumulates the plan and its `Explanation`s, making the whole run inspectable and auditable.
- Agents stay thin (language + delegation); the graph owns the flow.

---

## ADR-005 — The explainability envelope on every output

**Status:** Accepted

**Context.** Trust is the product. A recommendation without a traceable justification is a liability, and different parts of the system (engines, agents, API) must speak the same "why".

**Decision.** Define one shared `Explanation` primitive (`backend/app/engines/explain.py`) — summary, reasoning, evidence, rules_triggered, calculations, assumptions, alternatives, confidence, agent, timestamp — and attach it to every engine result, agent result, and API response. Wrap API responses in a standard envelope: `{status, data, explanation, audit_id, next_actions}` for success and `{status, error_code, message, details, suggested_action}` for errors.

**Consequences.**
- Any output can answer *"why?"* with rules, evidence, and reproducible calculations (see [JUDGE_EXPLAINABILITY.md](./JUDGE_EXPLAINABILITY.md)).
- Confidence is explicit — high (0.9–1.0) for computed results, lower for LLM-assisted language, which must cite evidence.
- The uniform envelope simplifies the frontend and guarantees `next_actions` and `audit_id` are always available.
- A small amount of boilerplate per output, standardised via helper builders.

---

## ADR-006 — PostgreSQL + Redis/Celery + ChromaDB, with graceful local fallbacks

**Status:** Accepted

**Context.** Production needs a real relational store, async processing, and a vector store for RAG — but forcing all of that on a new contributor's laptop kills the inner loop.

**Decision.** Use **PostgreSQL** (SQLAlchemy + Alembic), **Redis + Celery** for cache/queue, and **ChromaDB** (per-project namespaces) for vectors in production; default local config to **SQLite** and local Chroma persistence so the app boots with zero infra.

**Consequences.**
- Same code path locally and in production; only env vars differ (Compose overrides `DATABASE_URL`).
- Fast onboarding and deterministic tests without standing up services.
- Per-project ChromaDB namespaces enforce document isolation at the retrieval layer.

---

## ADR-007 — Risk rules as data (YAML), not code

**Status:** Accepted

**Context.** Organisational risk tolerance changes, and non-engineers (PMO) should be able to review and tune it.

**Decision.** Express the risk rulebook in `risk_rules.yaml`; the engine loads and evaluates it. Adding or tuning a rule requires no code change — only a metric available in the `RiskContext`.

**Consequences.**
- Rules are auditable and editable in one file; thresholds encode risk appetite transparently.
- A missing metric simply skips its rule (no false positives).
- Keeps risk detection deterministic and evidence-backed, consistent with ADR-001 and ADR-005.
