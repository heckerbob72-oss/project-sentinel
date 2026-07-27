# Project Sentinel — Database

The persistence layer uses **SQLAlchemy** ORM models with **Alembic** migrations, targeting **PostgreSQL** in production (SQLite for zero-infra local dev and tests). The declarative `Base`, engine, and session factory live in `backend/app/database.py`; models live in `backend/app/models/`.

## Conventions

Every table follows the same conventions:

- **Primary keys** — surrogate `id` on every table.
- **Foreign keys** — explicit FKs with **indexes** on every FK column.
- **Timestamps** — `created_at` and `updated_at` on every table.
- **Soft delete** — `is_deleted` flag rather than physical deletion, preserving audit history.
- **Flexible payloads** — `JSON` columns for semi-structured data (e.g. an agent's `Explanation`, agent I/O, settings).
- **Parameterised queries** — all access goes through the ORM; no raw SQL, so queries are parameterised by construction.

## Tables

Grouped by domain:

**Identity & access**
`users`, `roles`, `permissions`, `user_roles`

**Projects & profiling**
`projects`, `project_dna`, `project_methods`, `project_templates`

**Documents & RAG**
`documents`, `document_chunks`, `document_sources`

**Team & capacity**
`teams`, `members`, `skills`, `member_skills`, `availability`

**Planning**
`wbs_items`, `tasks`, `task_dependencies`, `allocations`, `milestones`

**Risk & recovery**
`risks`, `risk_rules`, `mitigations`, `recovery_plans`

**Reporting & meetings**
`reports`, `meeting_minutes`, `action_items`

**Simulation & health**
`simulations`, `simulation_results`, `health_scores`

**Portfolio & knowledge**
`portfolio_projects`, `knowledge_nodes`, `knowledge_edges`, `lessons_learned`

**Conversation & audit**
`conversations`, `agent_runs`, `activity_logs`, `audit_logs`, `settings`

## Key Relationships

- A **user** has many **roles** (via `user_roles`); a **role** has many **permissions** (RBAC — see [SECURITY.md](./SECURITY.md)).
- A **project** has exactly one **project_dna** profile and one selected method (`project_methods`), many **documents**, one **team**, and many **wbs_items** / **tasks**.
- A **document** has many **document_chunks** (embedded into ChromaDB) and **document_sources** used for citations.
- A **team** has many **members**; a **member** has many **skills** (via `member_skills`) and **availability** records.
- A **task** rolls up to a **wbs_item**, is linked to other tasks through **task_dependencies** (the DAG edges), is assigned via **allocations**, and rolls up to **milestones**.
- A **risk** references the **risk_rule** that triggered it and can have many **mitigations**; severe conditions produce **recovery_plans**.
- A **simulation** produces **simulation_results** (before/after snapshots); the Health engine writes **health_scores** over time.
- **knowledge_nodes** / **knowledge_edges** form the Project DNA knowledge graph; **lessons_learned** capture retrospectives.
- Every agent execution writes an **agent_run**; every material change writes an **audit_log**; **activity_logs** capture lighter-weight events.

## Entity-Relationship Diagram (core tables)

```mermaid
erDiagram
    USERS ||--o{ USER_ROLES : has
    ROLES ||--o{ USER_ROLES : grants
    ROLES ||--o{ ROLE_PERMISSIONS : includes
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : in

    USERS ||--o{ PROJECTS : owns
    PROJECTS ||--|| PROJECT_DNA : profiled_by
    PROJECTS ||--o{ DOCUMENTS : contains
    DOCUMENTS ||--o{ DOCUMENT_CHUNKS : split_into
    PROJECTS ||--|| TEAMS : staffed_by
    TEAMS ||--o{ MEMBERS : includes
    MEMBERS ||--o{ MEMBER_SKILLS : has
    SKILLS ||--o{ MEMBER_SKILLS : mapped

    PROJECTS ||--o{ WBS_ITEMS : decomposed_into
    WBS_ITEMS ||--o{ TASKS : contains
    TASKS ||--o{ TASK_DEPENDENCIES : source
    TASKS ||--o{ ALLOCATIONS : assigned_via
    MEMBERS ||--o{ ALLOCATIONS : receives
    TASKS ||--o{ MILESTONES : rolls_up

    PROJECTS ||--o{ RISKS : exposed_to
    RISK_RULES ||--o{ RISKS : triggers
    RISKS ||--o{ MITIGATIONS : mitigated_by
    PROJECTS ||--o{ RECOVERY_PLANS : rescued_by

    PROJECTS ||--o{ SIMULATIONS : runs
    SIMULATIONS ||--o{ SIMULATION_RESULTS : yields
    PROJECTS ||--o{ HEALTH_SCORES : scored_over_time

    PROJECTS ||--o{ AGENT_RUNS : executes
    AGENT_RUNS ||--o{ AUDIT_LOGS : records

    USERS {
        int id PK
        string email
        string password_hash
        bool is_deleted
        datetime created_at
        datetime updated_at
    }
    PROJECTS {
        int id PK
        int owner_id FK
        string name
        string status
        json settings
        bool is_deleted
    }
    TASKS {
        int id PK
        int wbs_item_id FK
        float optimistic
        float most_likely
        float pessimistic
        bool is_deleted
    }
    TASK_DEPENDENCIES {
        int id PK
        int source_task_id FK
        int target_task_id FK
        string dependency_type
    }
    RISKS {
        int id PK
        int project_id FK
        string rule_id FK
        string severity
        float score
        json evidence
    }
    HEALTH_SCORES {
        int id PK
        int project_id FK
        float overall
        string status
        json dimensions
    }
    AUDIT_LOGS {
        int id PK
        int agent_run_id FK
        string action
        json explanation
        datetime created_at
    }
```

> The ERD shows the core planning, risk, and audit tables. `role_permissions` is the association table linking `roles` and `permissions`; the remaining tables (portfolio, knowledge graph, lessons learned, meeting minutes, conversations) follow the same conventions and attach to `projects`.

## Migrations & Seeding

- **Alembic** manages schema evolution: `alembic upgrade head` applies migrations; `alembic revision --autogenerate` creates a new one after model changes.
- The **seed** module (`app.seed.seed`) loads deterministic demo data — users, roles/permissions, a sample project with team, skills, documents, WBS, dependencies, and the risk rulebook — so the app is immediately demonstrable.
- For tests and quick local bootstrap, `init_db()` creates all tables directly from ORM metadata.
