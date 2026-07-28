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


@pytest.mark.parametrize(
    ("scenario", "params"),
    [
        ("deadline_shortened", {"days": 5}),
        ("task_delayed", {"task_id": "T-01", "days": 3}),
        ("testing_extended", {"days": 2, "window": 5}),
        ("scope_reduced", {"task_ids": ["T-02"]}),
        (
            "add_requirement",
            {
                "task": {
                    "id": "T-NEW",
                    "label": "Compliance review",
                    "optimistic": 2,
                    "most_likely": 4,
                    "pessimistic": 7,
                }
            },
        ),
        ("member_unavailable", {}),
        ("capacity_increased", {}),
        ("dependency_blocked", {"task_id": "T-01", "block_days": 5}),
    ],
)
def test_all_supported_simulation_scenarios(client, auth_headers, scenario, params):
    pid = _first_project_id(client, auth_headers)
    resp = client.post(
        f"/api/v1/projects/{pid}/simulations",
        headers=auth_headers,
        json={"scenario": scenario, "params": params},
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["scenario"] == scenario


def test_deadline_shortened_beyond_available_time_is_json_safe(client, auth_headers):
    pid = _first_project_id(client, auth_headers)
    resp = client.post(
        f"/api/v1/projects/{pid}/simulations",
        headers=auth_headers,
        json={"scenario": "deadline_shortened", "params": {"days": 15}},
    )

    assert resp.status_code == 200
    schedule = resp.json()["data"]["after"]["schedule"]
    assert schedule["deadline"] == 0
    assert schedule["deadline_feasible"] is False
    assert schedule["schedule_pressure"] == 10.0


def test_simulation_rejects_invalid_scenario_parameters(client, auth_headers):
    pid = _first_project_id(client, auth_headers)

    missing_task = client.post(
        f"/api/v1/projects/{pid}/simulations",
        headers=auth_headers,
        json={"scenario": "task_delayed", "params": {"days": 3}},
    )
    unknown_task = client.post(
        f"/api/v1/projects/{pid}/simulations",
        headers=auth_headers,
        json={"scenario": "task_delayed", "params": {"task_id": "missing", "days": 3}},
    )
    unknown_scenario = client.post(
        f"/api/v1/projects/{pid}/simulations",
        headers=auth_headers,
        json={"scenario": "unknown", "params": {}},
    )

    assert missing_task.status_code == 422
    assert unknown_task.status_code == 422
    assert unknown_task.json()["error_code"] == "invalid_simulation"
    assert unknown_scenario.status_code == 422


def test_timeline_and_simulation_reject_missing_project(client, auth_headers):
    assert client.get("/api/v1/projects/99999/timeline", headers=auth_headers).status_code == 404
    resp = client.post(
        "/api/v1/projects/99999/simulations",
        headers=auth_headers,
        json={"scenario": "deadline_shortened", "params": {"days": 3}},
    )
    assert resp.status_code == 404


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


def test_explainability_replays_calculation_bearing_health_audit(client, auth_headers):
    pid = _first_project_id(client, auth_headers)
    health = client.get(f"/api/v1/projects/{pid}/health", headers=auth_headers).json()

    resp = client.get(
        f"/api/v1/explainability/{health['audit_id']}", headers=auth_headers
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["calculations"]
    assert data["explanation"]["calculations"]
    assert data["explanation"]["confidence"] == 1.0
