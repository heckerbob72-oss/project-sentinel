#!/usr/bin/env python3
"""
End-to-end smoke test for the Project Sentinel API.

Exercises the deterministic engines and every agent through the running backend,
using ONLY the Python standard library (no pip install needed).

Prerequisite: the backend is running and seeded, e.g.
    bash run.sh          # or: cd backend && uvicorn app.main:app --reload

Usage:
    python samples/smoke_test.py
    SENTINEL_API=http://localhost:8010/api/v1 python samples/smoke_test.py
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("SENTINEL_API", "http://localhost:8000/api/v1")
BRIEF = os.path.join(os.path.dirname(__file__), "hackathon_brief.txt")

TOKEN: str | None = None
_passed = 0
_failed = 0


def _req(method: str, path: str, body=None, token=None, multipart=None):
    url = BASE + path
    headers = {}
    data = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if multipart is not None:
        boundary = "----sentinelboundary1234567890"
        filename, content = multipart
        parts = []
        parts.append(f"--{boundary}".encode())
        parts.append(
            f'Content-Disposition: form-data; name="file"; filename="{filename}"'.encode()
        )
        parts.append(b"Content-Type: text/plain")
        parts.append(b"")
        parts.append(content.encode())
        parts.append(f"--{boundary}--".encode())
        data = b"\r\n".join(parts)
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    elif body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}
    except urllib.error.URLError as e:
        print(f"\n  ✗ Cannot reach {url} — is the backend running? ({e})")
        sys.exit(2)


def check(label: str, ok: bool, detail: str = ""):
    global _passed, _failed
    mark = "✓" if ok else "✗"
    print(f"  {mark} {label}" + (f" — {detail}" if detail else ""))
    if ok:
        _passed += 1
    else:
        _failed += 1


def main():
    global TOKEN
    print(f"\nProject Sentinel smoke test → {BASE}\n" + "-" * 60)

    # 1. auth
    print("Auth")
    status, data = _req("POST", "/auth/login",
                        {"email": "pm@sentinel.dev", "password": "pm123456"})
    login_data = data.get("data", {})
    check("login as Project Manager", status == 200 and "access_token" in login_data)
    TOKEN = login_data.get("access_token")

    status, reg = _req("POST", "/auth/register",
                       {"email": "tester@sentinel.dev", "full_name": "Test User",
                        "password": "test1234", "role": "Contributor"})
    check("register a new user", status in (201, 409),
          "already exists" if status == 409 else "created")

    # 2. projects
    print("\nProjects & Portfolio")
    status, data = _req("GET", "/projects", token=TOKEN)
    projects = data.get("data", [])
    check("list projects", status == 200 and len(projects) >= 1, f"{len(projects)} projects")
    pid = projects[0]["id"] if projects else 1

    status, data = _req("GET", "/portfolio", token=TOKEN)
    check("portfolio overview", status == 200, f"{len(data.get('data', []))} tracked")

    # 3. deterministic engines
    print("\nDeterministic engines (project #%d)" % pid)
    status, data = _req("GET", f"/projects/{pid}/timeline", token=TOKEN)
    cp = data.get("data", {}).get("critical_path", [])
    check("timeline / CPM", status == 200 and bool(cp), f"critical path {cp}")

    status, data = _req("GET", f"/projects/{pid}/dependencies", token=TOKEN)
    check("dependency DAG", status == 200,
          f"cycle={data.get('data', {}).get('cycle', {}).get('has_cycle')}")

    status, data = _req("GET", f"/projects/{pid}/risks", token=TOKEN)
    risks = data.get("data", {}).get("risks", [])
    check("risk evaluation", status == 200, f"{len(risks)} risk(s), audit={bool(data.get('audit_id'))}")

    status, data = _req("GET", f"/projects/{pid}/health", token=TOKEN)
    h = data.get("data", {})
    check("health score", status == 200 and "overall" in h, f"{h.get('overall')} ({h.get('status')})")

    status, data = _req("GET", f"/projects/{pid}/success", token=TOKEN)
    check("success probability", status == 200,
          f"{data.get('data', {}).get('probability')}%")

    status, data = _req("GET", f"/projects/{pid}/resources", token=TOKEN)
    check("resource allocation", status == 200,
          f"{len(data.get('data', {}).get('assignments', []))} assignments")

    # 4. agents behind the newer pages
    print("\nAgents")
    for label, path in [
        ("methodology", f"/projects/{pid}/methodology"),
        ("project DNA", f"/projects/{pid}/dna"),
        ("gap analysis", f"/projects/{pid}/gaps"),
        ("rescue mode", f"/projects/{pid}/rescue"),
        ("recovery plan", f"/projects/{pid}/recovery"),
        ("team members", f"/projects/{pid}/members"),
        ("project summary", f"/projects/{pid}/summary"),
    ]:
        status, data = _req("GET", path, token=TOKEN)
        check(label, status == 200)

    # 5. document analysis + RAG
    print("\nDocument analysis & RAG")
    try:
        brief = open(BRIEF, encoding="utf-8").read()
    except OSError:
        brief = "Objective: test. Deadline: 2026-08-10. Team of 4."
    status, data = _req("POST", f"/projects/{pid}/documents", token=TOKEN,
                        multipart=("hackathon_brief.txt", brief))
    facts = data.get("data", {}).get("facts", {})
    check("upload + extract facts", status == 200, f"extracted keys: {list(facts.keys())[:4]}")

    status, data = _req("GET", f"/projects/{pid}/rag/search?q=testing%20window", token=TOKEN)
    cites = data.get("data", {}).get("citations", [])
    check("RAG retrieval with citations", status == 200, f"{len(cites)} citation(s)")

    # 6. simulation (digital twin)
    print("\nDigital Twin simulation")
    status, data = _req("POST", f"/projects/{pid}/simulations", token=TOKEN,
                        body={"scenario": "deadline_shortened", "params": {"days": 3}})
    deltas = data.get("data", {}).get("deltas", {})
    check("run scenario", status == 200,
          f"duration Δ {deltas.get('project_duration')}, health Δ {deltas.get('health')}")

    # 7. full LangGraph workflow
    print("\nMulti-agent workflow")
    status, data = _req("POST", "/agents/workflow/plan", token=TOKEN,
                        body={"project_type": "hackathon",
                              "deliverables": ["api", "dashboard", "workflow", "demo"]})
    trace = data.get("data", {}).get("trace", [])
    check("plan pipeline", status == 200 and len(trace) >= 5, f"{len(trace)} agents ran")

    # 8. comms agents
    print("\nCommunication agents")
    status, data = _req("POST", "/meeting-minutes/generate", token=TOKEN,
                        body={"notes": "We decided to freeze scope. Action: Asha to finish the API by Friday. Blocked on the staging server.",
                              "attendees": ["Asha", "Ben"]})
    check("meeting minutes", status == 200,
          f"{len(data.get('data', {}).get('decisions', []))} decision(s)")

    status, data = _req("POST", "/executive/draft", token=TOKEN,
                        body={"tone": "executive", "facts": {"health": 72, "status": "amber"}})
    check("executive draft", status == 200, "draft generated")

    # 9. audit + explainability
    print("\nAudit & explainability")
    status, data = _req("GET", "/audit?limit=5", token=TOKEN)
    entries = data.get("data", [])
    check("audit trail", status == 200, f"{len(entries)} recent entries")
    if entries:
        aid = entries[0]["audit_id"]
        status, data = _req("GET", f"/explainability/{aid}", token=TOKEN)
        check("explainability trace", status == 200,
              f"rules: {data.get('data', {}).get('rules_triggered')}")

    print("-" * 60)
    print(f"RESULT: {_passed} passed, {_failed} failed\n")
    sys.exit(1 if _failed else 0)


if __name__ == "__main__":
    main()
