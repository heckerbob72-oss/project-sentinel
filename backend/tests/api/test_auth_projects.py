"""API tests for auth and projects (require FastAPI + SQLAlchemy).

These run in CI and Docker where dependencies are installed.
"""
import pytest

pytest.importorskip("fastapi")
pytest.importorskip("sqlalchemy")


def test_login_success(client):
    resp = client.post("/api/v1/auth/login",
                       json={"email": "pm@sentinel.dev", "password": "pm123456"})
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert "access_token" in body
    assert body["user"]["role"] == "ProjectManager"


def test_login_bad_password(client):
    resp = client.post("/api/v1/auth/login",
                       json={"email": "pm@sentinel.dev", "password": "wrong"})
    assert resp.status_code == 401
    assert resp.json()["status"] == "error"


def test_list_projects_requires_auth(client):
    assert client.get("/api/v1/projects").status_code == 401


def test_list_and_get_project(client, auth_headers):
    resp = client.get("/api/v1/projects", headers=auth_headers)
    assert resp.status_code == 200
    projects = resp.json()["data"]
    assert len(projects) >= 1
    pid = projects[0]["id"]
    detail = client.get(f"/api/v1/projects/{pid}", headers=auth_headers)
    assert detail.status_code == 200


def test_viewer_cannot_create_project(client):
    login = client.post("/api/v1/auth/login",
                        json={"email": "view@sentinel.dev", "password": "view1234"})
    headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}
    resp = client.post("/api/v1/projects", headers=headers, json={"name": "Nope"})
    assert resp.status_code == 403
