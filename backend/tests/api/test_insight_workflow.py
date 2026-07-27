"""API tests for insight endpoints and the planning workflow."""
import pytest

pytest.importorskip("fastapi")
pytest.importorskip("sqlalchemy")


def _first_project_id(client, headers):
    return client.get("/api/v1/projects", headers=headers).json()["data"][0]["id"]


def test_timeline_has_critical_path(client, auth_headers):
    pid = _first_project_id(client, auth_headers)
    resp = client.get(f"/api/v1/projects/{pid}/timeline", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["critical_path"]
    assert "explanation" in resp.json()


def test_risks_endpoint_returns_explained_risks(client, auth_headers):
    pid = _first_project_id(client, auth_headers)
    resp = client.get(f"/api/v1/projects/{pid}/risks", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["audit_id"]
    assert "risks" in body["data"]


def test_health_endpoint_and_bands(client, auth_headers):
    pid = _first_project_id(client, auth_headers)
    resp = client.get(f"/api/v1/projects/{pid}/health", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert 0 <= data["overall"] <= 100
    assert data["status"] in {"green", "amber", "red", "critical"}


def test_simulation_returns_before_after(client, auth_headers):
    pid = _first_project_id(client, auth_headers)
    resp = client.post(f"/api/v1/projects/{pid}/simulations", headers=auth_headers,
                       json={"scenario": "deadline_shortened", "params": {"days": 3}})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "before" in data and "after" in data and "deltas" in data


def test_workflow_plan_runs_pipeline(client, auth_headers):
    resp = client.post("/api/v1/agents/workflow/plan", headers=auth_headers,
                       json={"project_type": "hackathon",
                             "deliverables": ["api", "ui", "demo"]})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["wbs_items"]
    assert len(data["trace"]) >= 5


def test_explainability_trace_from_audit(client, auth_headers):
    pid = _first_project_id(client, auth_headers)
    risks = client.get(f"/api/v1/projects/{pid}/risks", headers=auth_headers).json()
    audit_id = risks["audit_id"]
    resp = client.get(f"/api/v1/explainability/{audit_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert "rules_triggered" in resp.json()["data"]
