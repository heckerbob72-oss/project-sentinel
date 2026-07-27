"""Tests for the health engine."""
from app.engines import HealthEngine


def test_healthy_project_is_green():
    res = HealthEngine().score({
        "schedule_pressure": 0.7, "max_utilisation": 0.7, "open_risk_score": 10,
        "requirement_completeness": 0.95, "testing_window_days": 5, "team_size": 4,
        "overloaded_members": 0, "spof_count": 0, "delivery_readiness": 0.9,
        "stakeholder_alignment": 0.9, "documentation_ratio": 0.9, "demo_readiness": 0.9,
        "dependency_density": 0.8,
    })
    assert res.status == "green"
    assert res.overall >= 80
    assert not res.rescue_recommended


def test_troubled_project_trips_rescue():
    res = HealthEngine().score({
        "schedule_pressure": 1.4, "max_utilisation": 1.4, "open_risk_score": 90,
        "requirement_completeness": 0.4, "testing_window_days": 1, "team_size": 4,
        "overloaded_members": 2, "spof_count": 3, "delivery_readiness": 0.3,
        "demo_readiness": 0.3, "dependency_density": 2.0,
    })
    assert res.rescue_recommended
    assert res.status in {"red", "critical"}
    assert "HEALTH_RESCUE_THRESHOLD" in res.explanation.rules_triggered


def test_status_bands():
    assert HealthEngine.status_for(85) == "green"
    assert HealthEngine.status_for(70) == "amber"
    assert HealthEngine.status_for(45) == "red"
    assert HealthEngine.status_for(30) == "critical"


def test_weights_sum_to_one():
    from app.engines.health import DEFAULT_WEIGHTS
    assert abs(sum(DEFAULT_WEIGHTS.values()) - 1.0) < 1e-9
