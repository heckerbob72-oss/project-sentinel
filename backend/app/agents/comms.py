"""Communication agents: Reporting, Executive Copilot, Meeting Minutes, Explainability."""
from __future__ import annotations

from ..engines.explain import Explanation
from ..llm import LLMMessage, get_llm
from .base import AgentResult, BaseAgent


class ReportingAgent(BaseAgent):
    name = "reporting-agent"
    purpose = "Generate status/risk/readiness reports grounded in project data."

    def run(self, payload: dict) -> AgentResult:
        report_type = payload.get("report_type", "weekly_status")
        facts = payload.get("facts", {})
        exp = Explanation(
            summary=f"Generated '{report_type}' report from project data.",
            agent=self.name, confidence=0.85,
        )
        body = self._compose(report_type, facts)
        exp.add_reason("Report is assembled from current project facts only; no progress is invented.")
        for k, v in facts.items():
            exp.add_evidence(self.name, f"Fact: {k}", value=v)
        return AgentResult(self.name, {"report_type": report_type, "title": report_type.replace('_', ' ').title(), "body": body}, exp, [])

    @staticmethod
    def _compose(report_type: str, facts: dict) -> str:
        health = facts.get("health", "n/a")
        risks = facts.get("open_risks", 0)
        progress = facts.get("progress", "n/a")
        deadline = facts.get("deadline", "n/a")
        return (
            f"# {report_type.replace('_', ' ').title()}\n\n"
            f"**Overall health:** {health}\n"
            f"**Progress:** {progress}\n"
            f"**Open risks:** {risks}\n"
            f"**Deadline:** {deadline}\n\n"
            "## Completed\n- (derived from task status)\n\n"
            "## Upcoming\n- (derived from schedule)\n\n"
            "## Blockers & Risks\n- (derived from risk engine)\n\n"
            "## Decisions required\n- (human-in-the-loop approvals pending)\n"
        )


class ExecutiveCopilotAgent(BaseAgent):
    name = "executive-copilot-agent"
    purpose = "Translate project status into executive-friendly communication."

    def run(self, payload: dict) -> AgentResult:
        tone = payload.get("tone", "executive")
        facts = payload.get("facts", {})
        llm = get_llm()
        text = llm.complete([
            LLMMessage("system", f"Write a {tone} stakeholder update. Ground strictly "
                                 "in the facts; do not fabricate progress."),
            LLMMessage("user", "\n".join(f"{k}: {v}" for k, v in facts.items())),
        ])
        exp = Explanation(
            summary=f"Drafted a {tone} executive update.",
            agent=self.name, confidence=0.75,
        )
        exp.add_reason("LLM used for phrasing only; all figures come from project facts.")
        exp.assumptions = ["No new commitments were introduced beyond stated facts."]
        na = [self._na("Review before sending", "Human approval required for external comms",
                       "high", "executive")]
        return AgentResult(self.name, {"tone": tone, "draft": text}, exp, na)


class MeetingMinutesAgent(BaseAgent):
    name = "meeting-minutes-agent"
    purpose = "Turn raw notes/transcript into minutes, decisions, and action items."

    def run(self, payload: dict) -> AgentResult:
        notes = payload.get("notes", "")
        attendees = payload.get("attendees", [])
        decisions = self._extract(notes, ["decided", "agreed", "will proceed"])
        actions = self._extract(notes, ["action", "todo", "to do", "will ", "assign"])
        blockers = self._extract(notes, ["blocked", "blocker", "waiting on", "stuck"])
        exp = Explanation(
            summary="Generated minutes from the supplied notes.",
            agent=self.name, confidence=0.7,
        )
        exp.add_reason("Extraction is keyword-anchored to the notes; nothing invented.")
        data = {
            "attendees": attendees,
            "summary": get_llm().complete([
                LLMMessage("system", "Summarise the meeting notes faithfully."),
                LLMMessage("user", notes[:2000] or "No notes provided."),
            ]),
            "decisions": decisions,
            "action_items": [{"description": a, "owner": "TBD"} for a in actions],
            "blockers": blockers,
        }
        na = [self._na("Convert action items to tasks", "Link decisions to the plan",
                       "medium", "wbs")]
        return AgentResult(self.name, data, exp, na)

    @staticmethod
    def _extract(text: str, markers: list[str]) -> list[str]:
        out = []
        for line in text.splitlines():
            low = line.lower()
            if any(mk in low for mk in markers):
                out.append(line.strip("-• ").strip())
        return out


class ExplainabilityAgent(BaseAgent):
    name = "judge-explainability-agent"
    purpose = "Answer 'Why did Sentinel recommend this?' with the full trace."

    def run(self, payload: dict) -> AgentResult:
        subject = payload.get("subject", "recommendation")
        source_exp = payload.get("explanation", {})
        exp = Explanation(
            summary=f"Explainability trace for: {subject}.",
            agent=self.name, confidence=1.0,
        )
        exp.reasoning = source_exp.get("reasoning", [])
        exp.rules_triggered = source_exp.get("rules_triggered", [])
        exp.calculations = source_exp.get("calculations", [])
        exp.alternatives = source_exp.get("alternatives", [])
        data = {
            "subject": subject,
            "source_facts": source_exp.get("evidence", []),
            "rules_triggered": source_exp.get("rules_triggered", []),
            "calculations": source_exp.get("calculations", []),
            "alternatives_considered": source_exp.get("alternatives", []),
            "confidence": source_exp.get("confidence", 1.0),
            "human_decision_needed": payload.get("human_decision", "Approve or reject the recommendation."),
        }
        return AgentResult(self.name, data, exp, [])
