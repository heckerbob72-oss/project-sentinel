"""Tests for the dependency (DAG) engine."""
from app.engines import DependencyEngine

TASKS = [{"id": t, "label": t} for t in ["A", "B", "C", "D"]]
DEPS = [
    {"source": "A", "target": "B"},
    {"source": "A", "target": "C"},
    {"source": "B", "target": "D"},
    {"source": "C", "target": "D"},
]


def test_acyclic_topological_order():
    res = DependencyEngine().build(TASKS, DEPS)
    assert not res.cycle.has_cycle
    order = res.topological_order
    assert order.index("A") < order.index("B") < order.index("D")
    assert order.index("A") < order.index("C") < order.index("D")


def test_cycle_detection():
    res = DependencyEngine().build(TASKS, DEPS + [{"source": "D", "target": "A"}])
    assert res.cycle.has_cycle
    assert "DEP_CYCLE_DETECTED" in res.explanation.rules_triggered


def test_single_point_of_failure():
    # A is the sole predecessor of both B and C -> SPOF
    res = DependencyEngine().build(TASKS, DEPS)
    assert "A" in res.single_points_of_failure


def test_bottleneck_detection():
    res = DependencyEngine(bottleneck_threshold=1).build(TASKS, DEPS)
    ids = {b["task_id"] for b in res.bottlenecks}
    assert "A" in ids or "D" in ids
