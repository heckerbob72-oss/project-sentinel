# Project Sentinel — Frontend

The control-tower interface for **Project Sentinel**, the agentic AI project
co-ordinator. A dark, dense, professional dashboard where **every recommendation
is explainable** — each surface can prove its reasoning, evidence, rules, and
calculations.

Built with **Next.js 14 (App Router)**, **React 18**, **TypeScript**,
**Tailwind CSS**, **TanStack Query**, **Zustand**, **Zod**, **Recharts**, and
**React Flow**.

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure the API base URL
cp .env.local.example .env.local
#   then edit NEXT_PUBLIC_API_URL if your backend isn't on the default

# 3. Run the dev server
npm run dev
# open http://localhost:3000  (redirects to /dashboard)
```

Other scripts:

```bash
npm run build   # production build (standalone output)
npm run start   # serve the production build
npm run lint    # eslint
```

## Environment

| Variable              | Default                          | Purpose                        |
| --------------------- | -------------------------------- | ------------------------------ |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api/v1`   | Base URL for the Sentinel API. |

The API client (`src/lib/api.ts`) attaches the Bearer token from the auth store
and returns the standard success envelope (`{ status, data, explanation,
audit_id, next_actions }`). Errors are normalised to `ApiRequestError`, and data
pages degrade to a friendly empty/error state when the backend is unreachable —
they never crash.

## Project structure

```
src/
  app/                     App Router routes (one folder per page)
    layout.tsx             Sidebar + top-nav shell, wraps <Providers>
    providers.tsx          TanStack Query + Toast context ("use client")
    page.tsx               → redirects to /dashboard
    globals.css            Tailwind + dark control-tower theme tokens
    login/ dashboard/ control-tower/ intake/ wbs/ risks/ health/
    simulation/ explainability/            ← the 9 core, fully-built pages
    timeline/ gantt/ dependencies/ audit/  ← additional live pages
    <others>/              ComingSoon placeholders (every sidebar link resolves)
  components/
    ExplanationPanel.tsx   The signature explainability component
    HealthGauge.tsx        Recharts radial gauge
    RiskMatrix.tsx         5×5 probability × impact grid
    DependencyGraph.tsx    React Flow DAG (critical nodes in red)
    GanttChart.tsx         Div-based Gantt (critical path in red)
    NextBestActions.tsx    Prioritised next_actions cards
    ComingSoon.tsx         Roadmap placeholder
    layout/                Sidebar, TopNav
    ui/                    Card, Button, Badge, StatusBadge, Table, Modal,
                           Toast, Skeleton, EmptyState, Spinner
  lib/
    types.ts               API envelope + domain contracts
    api.ts                 Typed fetch client (apiGet/apiPost + unwrap helpers)
    utils.ts               cn(), status colour mapping, formatters
  store/
    useAuthStore.ts        Token + user (persisted)
    useProjectStore.ts     Selected project id (persisted)
```

## Design system

The theme is a dark "control tower": HSL design tokens in `globals.css`, a
`sentinel` brand palette, and traffic-light `status` colours
(`green` / `amber` / `red` / `critical`) that map consistently from health
scores and risk severities via `src/lib/utils.ts`.

## The explainability contract

Every important API response carries a structured `Explanation`. The
`ExplanationPanel` renders it end-to-end — summary, reasoning chain, evidence,
triggered rules, calculations (formula + inputs + result), assumptions,
alternatives, and a confidence meter — so no recommendation is ever a black box.
The **Explainability Mode** page (`/explainability`) lets a reviewer trace any
`audit_id` and prove a decision from source facts to conclusion.

## Docker

```bash
docker build -t project-sentinel-frontend .
docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=http://host.docker.internal:8000/api/v1 project-sentinel-frontend
```

The image uses Next.js `standalone` output for a small runtime footprint.
