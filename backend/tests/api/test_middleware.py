"""Cross-cutting middleware behavior tests."""
from __future__ import annotations

from app.config import settings
from app.main import _hits


def test_preflight_is_not_rate_limited_and_429_keeps_cors(client, monkeypatch):
    origin = "http://localhost:3000"
    monkeypatch.setattr(settings, "rate_limit_per_minute", 1)
    _hits.clear()

    preflight_headers = {
        "Origin": origin,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization",
    }
    assert client.options("/api/v1/projects", headers=preflight_headers).status_code == 200
    assert not _hits

    first = client.get("/api/v1/projects", headers={"Origin": origin})
    assert first.status_code == 401

    limited = client.get("/api/v1/projects", headers={"Origin": origin})
    assert limited.status_code == 429
    assert limited.headers["access-control-allow-origin"] == origin

    _hits.clear()