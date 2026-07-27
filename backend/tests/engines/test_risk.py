"""Tests for the rule-based risk engine."""
from app.engines import RiskContext, RiskEngine


def test_schedule_compression_fires():
    ctx = RiskContext(metrics={"schedule_pressure": 1.2})
    risks = RiskEngine().evaluate(ctx)
    ids = {r.rule_id for r in risks}
    assert "RISK_SCHEDULE_COMPRESSION" in ids
    r = next(r for r in risks if r.rule_id == "RISK_SCHEDULE_COMPRESSION")
    assert r.severity == "critical"
    assert r.score == 100.0  # 5*5/25*100


def test_no_risk_when_metric_absent():
    # No metrics -> nothing can be evaluated -> no false risks
    assert RiskEngine().evaluate(RiskContext(metrics={})) == []


def test_testing_window_rule():
    risks = RiskEngine().evaluate(RiskContext(metrics={"testing_window_days": 1}))
    assert any(r.rule_id == "RISK_TESTING_WINDOW_MINIMUM" for r in risks)


def test_evidence_and_explanation_attached():
    risks = RiskEngine().evaluate(RiskContext(metrics={"max_utilisation": 1.3}))
    r = next(r for r in risks if r.rule_id == "RISK_RESOURCE_OVERLOAD")
    assert r.evidence and r.evidence[0]["observed"] == 1.3
    assert "RISK_RESOURCE_OVERLOAD" in r.explanation.rules_triggered


def test_risks_sorted_by_score_desc():
    ctx = RiskContext(metrics={"schedule_pressure": 1.2, "documentation_ratio": 0.2})
    risks = RiskEngine().evaluate(ctx)
    scores = [r.score for r in risks]
    assert scores == sorted(scores, reverse=True)
