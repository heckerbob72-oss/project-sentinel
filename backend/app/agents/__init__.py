"""Project Sentinel multi-agent layer.

Agents are explainable orchestrators. Planning/risk/health agents delegate
computation to deterministic engines; analysis/comms agents use the LLM only for
language. Every agent returns an AgentResult carrying an Explanation.
"""
from .analysis import (
    DocumentAnalysisAgent,
    GapDetectionAgent,
    GitHubImportAgent,
    IntakeAgent,
    MethodologyAgent,
    ProjectDNAAgent,
)
from .base import AgentResult, BaseAgent
from .comms import (
    ExecutiveCopilotAgent,
    ExplainabilityAgent,
    MeetingMinutesAgent,
    ReportingAgent,
)
from .planning import (
    DependencyAgent,
    ResourceAllocationAgent,
    TimelineAgent,
    WorkBreakdownAgent,
)
from .risk_health import (
    HealthAgent,
    NextBestActionAgent,
    RecoveryAgent,
    RescueAgent,
    RiskAgent,
    SuccessAgent,
)

AGENT_REGISTRY = {
    a.name: a
    for a in [
        DocumentAnalysisAgent(), GapDetectionAgent(), IntakeAgent(),
        ProjectDNAAgent(), MethodologyAgent(), WorkBreakdownAgent(),
        DependencyAgent(), TimelineAgent(), ResourceAllocationAgent(),
        RiskAgent(), HealthAgent(), SuccessAgent(), RecoveryAgent(),
        RescueAgent(), NextBestActionAgent(), ReportingAgent(),
        ExecutiveCopilotAgent(), MeetingMinutesAgent(), ExplainabilityAgent(),
        GitHubImportAgent(),
    ]
}

__all__ = ["BaseAgent", "AgentResult", "AGENT_REGISTRY"]
