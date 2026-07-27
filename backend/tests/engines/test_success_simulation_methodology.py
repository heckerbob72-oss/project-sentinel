"""Tests for success probability, simulation, and methodology engines."""
from app.engines import (
    MethodologyEngine,
    SimulationEngine,
    SuccessProbabilityCalculator,
)


def test_success_probability_bounds_and_weights():
    res = SuccessProbabilityCalculator().calculate({
        "schedule_pressure": 0.7, "max_utilisation": 0.7, "open_risk_score": 5,
        "dependency_density": 0.8, "spof_count": 0, "requirement_completeness": 1.0,
        "testing_window_days": 5,
    })
    assert 0 <= res.probability <= 100
    assert res.probability >= 90  # near-ideal inputs
    assert sum(f.max_points for f in res.factors) == 100


def test_success_probability_low_for_bad_inputs():
    res = SuccessProbabilityCalculator().calculate({
        "schedule_pressure": 1.5, "max_utilisation": 1.4, "open_risk_score": 100,
        "dependency_density": 2.0, "spof_count": 3, "requirement_completeness": 0.3,
        "testing_window_days": 0,
    })
    assert res.probability < 30


def test_simulation_task_delay_extends_duration():
    state = {
        "tasks": [
            {"id": "A", "label": "A", "optimistic": 2, "most_likely": 4, "pessimistic": 6},
            {"id": "B", "label": "B", "optimistic": 3, "most_likely": 5, "pessimistic": 7},
        ],
        "dependencies": [{"source": "A", "target": "B"}],
        "deadline": 15,
        "health_metrics": {"team_size": 3},
    }
    res = SimulationEngine().simulate(state, "task_delayed", {"task_id": "A", "days": 5})
    assert res.deltas["project_duration"] == 5.0


def test_methodology_recommends_scrum_for_unstable_reqs():
    res = MethodologyEngine().recommend({"requirements_stability": 0.3, "change_frequency": "high"})
    assert res.recommended == "scrum"
    assert res.ceremonies


def test_methodology_waterfall_for_regulated_stable():
    res = MethodologyEngine().recommend({
        "requirements_stability": 0.9, "change_frequency": "low", "regulatory": True,
    })
    assert res.recommended == "waterfall"
