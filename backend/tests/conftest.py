"""Shared pytest fixtures.

Engine tests are pure-Python and always run. API tests require FastAPI +
SQLAlchemy; they use an in-memory SQLite DB and a seeded client.
"""
from __future__ import annotations

import pytest

pytest.register_assert_rewrite("tests")


@pytest.fixture()
def client():
    """A TestClient wired to a fresh in-memory database with seed data."""
    from fastapi.testclient import TestClient

    from app.database import Base, engine
    from app.main import app
    from app.seed.seed_data import seed
    from app.database import SessionLocal

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()
    return TestClient(app)


@pytest.fixture()
def auth_headers(client):
    resp = client.post("/api/v1/auth/login",
                       json={"email": "pm@sentinel.dev", "password": "pm123456"})
    token = resp.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}
