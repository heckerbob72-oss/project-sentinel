"""Tests for the CPM/PERT scheduling engine."""
from app.engines import SchedulingEngine

TASKS = [
    {"id": "A", "label": "Design", "optimistic": 2, "most_likely": 4, "pessimistic": 6},
    {"id": "B", "label": "Backend", "optimistic": 4, "most_likely": 6, "pessimistic": 10},
    {"id": "C", "label": "Frontend", "optimistic": 3, "most_likely": 5, "pessimistic": 9},
    {"id": "D", "label": "Test", "optimistic": 1, "most_likely": 2, "pessimistic": 4},
]
DEPS = [
    {"source": "A", "target": "B"},
    {"source": "A", "target": "C"},
    {"source": "B", "target": "D"},
    {"source": "C", "target": "D"},
]


def test_pert_expected():
    assert SchedulingEngine.pert_expected(2, 4, 6) == 4.0
    # (4 + 24 + 10)/6 = 6.333...
    assert abs(SchedulingEngine.pert_expected(4, 6, 10) - 6.3333) < 0.001


def test_critical_path_and_duration():
    res = SchedulingEngine().schedule(TASKS, DEPS)
    # A(4) -> B(6.33) -> D(2.17) = 12.5
    assert abs(res.project_duration - 12.5) < 0.01
    assert res.critical_path == ["A", "B", "D"]


def test_float_of_non_critical_task():
    res = SchedulingEngine().schedule(TASKS, DEPS)
    c = next(t for t in res.tasks if t.id == "C")
    # C (5.33) runs parallel to B (6.33); float = 1.0
    assert abs(c.total_float - 1.0) < 0.01
    assert not c.is_critical


def test_deadline_feasibility():
    feasible = SchedulingEngine().schedule(TASKS, DEPS, deadline=15)
    assert feasible.deadline_feasible is True
    infeasible = SchedulingEngine().schedule(TASKS, DEPS, deadline=10)
    assert infeasible.deadline_feasible is False
    assert "SCHEDULE_INFEASIBLE" in infeasible.explanation.rules_triggered


def test_explanation_present():
    res = SchedulingEngine().schedule(TASKS, DEPS)
    assert res.explanation.confidence == 1.0
    assert res.explanation.calculations
