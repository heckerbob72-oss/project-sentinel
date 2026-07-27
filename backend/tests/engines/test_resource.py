"""Tests for the resource allocation engine."""
from app.engines import ResourceEngine

MEMBERS = [
    {"id": "m1", "name": "Asha", "skills": {"python": 5, "fastapi": 4}, "capacity_hours": 40},
    {"id": "m2", "name": "Ben", "skills": {"react": 4, "typescript": 4}, "capacity_hours": 40},
]


def test_skill_matched_assignment():
    tasks = [{"id": "t1", "label": "API", "required_skills": ["python", "fastapi"], "hours": 20}]
    res = ResourceEngine().allocate(tasks, MEMBERS)
    a = res.assignments[0]
    assert a.member_name == "Asha"
    assert a.skill_match > 0.9


def test_skill_gap_detection():
    tasks = [{"id": "t1", "label": "ML", "required_skills": ["pytorch"], "hours": 10}]
    res = ResourceEngine().allocate(tasks, MEMBERS)
    assert "pytorch" in res.skill_gaps
    assert "t1" in res.unassigned_tasks


def test_overload_detection():
    tasks = [
        {"id": "t1", "label": "A", "required_skills": ["python"], "hours": 30},
        {"id": "t2", "label": "B", "required_skills": ["python"], "hours": 30},
    ]
    res = ResourceEngine().allocate(tasks, [MEMBERS[0]])
    # 60h of work, 40h capacity -> one task unassigned (capacity respected)
    assert res.unassigned_tasks


def test_utilisation_reported():
    tasks = [{"id": "t1", "label": "API", "required_skills": ["python"], "hours": 20}]
    res = ResourceEngine().allocate(tasks, MEMBERS)
    assert res.utilisation["m1"] == 0.5
