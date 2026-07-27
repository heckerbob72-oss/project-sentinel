"""Analysis agents: Document Analysis, Gap Detection, Intake, Project DNA, Methodology."""
from __future__ import annotations

import re

from ..engines import MethodologyEngine
from ..engines.explain import Explanation
from ..llm import LLMMessage, get_llm
from .base import AgentResult, BaseAgent

# Structured intake template — the fields the system needs to plan well.
INTAKE_FIELDS = [
    "project_objective", "project_type", "team_size", "team_members",
    "member_skills", "member_availability", "start_date", "deadline",
    "milestones", "deliverables", "technology_constraints", "budget",
    "deployment_constraints", "submission_rules", "stakeholder_expectations",
    "testing_window", "demo_date", "risk_tolerance", "priority",
]

_FIELD_IMPORTANCE = {
    "project_objective": "critical", "deadline": "critical", "deliverables": "critical",
    "team_members": "high", "member_skills": "high", "member_availability": "high",
    "milestones": "high", "testing_window": "high", "demo_date": "high",
    "budget": "medium", "technology_constraints": "medium",
    "deployment_constraints": "medium", "submission_rules": "medium",
    "stakeholder_expectations": "medium", "risk_tolerance": "low",
    "start_date": "medium", "team_size": "medium", "project_type": "high",
    "priority": "low",
}


class DocumentAnalysisAgent(BaseAgent):
    name = "document-analysis-agent"
    purpose = "Extract structured, source-cited project facts from documents."

    _PATTERNS = {
        "deadline": r"(?:deadline|due|submit(?:ted)? by|delivery date)[:\s]+([A-Za-z0-9,\-/ ]+)",
        "budget": r"(?:budget|cost)[:\s]+\$?([0-9,]+)",
        "team_size": r"team of (\d+)|(\d+)[ -]person team",
        "objective": r"(?:objective|goal|aim)[:\s]+([^\n\.]+)",
    }

    def run(self, payload: dict) -> AgentResult:
        text = payload.get("text", "")
        document = payload.get("document", "document")
        facts: dict = {}
        exp = Explanation(
            summary="Extracted project facts from the document (source-cited).",
            agent=self.name, confidence=0.8,
        )
        for field, pat in self._PATTERNS.items():
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                value = next((g for g in m.groups() if g), "").strip()
                facts[field] = value
                exp.add_evidence(
                    source=f"document:{document}",
                    detail=f"Matched '{field}'",
                    value=value,
                )
        # LLM is used only to produce a natural-language digest of the extracted facts.
        llm = get_llm()
        digest = llm.complete([
            LLMMessage("system", "Summarise the extracted project facts. Do not invent facts."),
            LLMMessage("user", "\n".join(f"{k}: {v}" for k, v in facts.items()) or "No facts extracted."),
        ])
        facts["_digest"] = digest
        exp.add_reason("Regex extraction for structured facts; LLM only rephrases them.")
        na = [self._na("Run gap analysis", "Check extracted facts for gaps", "high", "intake")]
        return AgentResult(self.name, {"facts": facts, "document": document}, exp, na)


class GitHubImportAgent(BaseAgent):
    name = "github-import-agent"
    purpose = "Turn a public GitHub repo's real metadata into cited intake facts."

    # Primary language -> best-fit WBS template + a typical role for that skill.
    _LANGUAGE_HINTS = {
        "python": ("ai_application", "Backend Engineer"),
        "jupyter notebook": ("ai_application", "Data Scientist"),
        "typescript": ("web_application", "Frontend Engineer"),
        "javascript": ("web_application", "Frontend Engineer"),
        "vue": ("web_application", "Frontend Engineer"),
        "html": ("web_application", "Frontend Engineer"),
        "java": ("web_application", "Backend Engineer"),
        "go": ("web_application", "Backend Engineer"),
        "c#": ("web_application", "Backend Engineer"),
        "rust": ("web_application", "Backend Engineer"),
    }
    _AI_HINTS = {"ai", "ml", "machine-learning", "llm", "agent", "agents", "nlp", "genai"}

    def run(self, payload: dict) -> AgentResult:
        repo = payload.get("repo", {})
        repo_url = payload.get("repo_url", repo.get("html_url", ""))
        full_name = repo.get("full_name", "")

        exp = Explanation(
            summary=f"Extracted intake facts from the public GitHub repo '{full_name}'.",
            agent=self.name, confidence=0.75,
        )
        exp.add_reason(
            "Facts are read directly from the GitHub API (repo metadata, languages, "
            "contributors, README) — nothing is inferred beyond simple language/topic "
            "keyword matching for the suggested template and roles."
        )

        facts: dict = {}
        if repo.get("description"):
            facts["project_objective"] = repo["description"]
            exp.add_evidence(f"github:{full_name}", "Repo description", value=repo["description"])

        topics = repo.get("topics", [])
        languages = list((repo.get("languages") or {}).keys())
        primary = (repo.get("primary_language") or "").lower()

        project_type = "ai_application" if self._AI_HINTS & {t.lower() for t in topics} else None
        if not project_type:
            project_type = self._LANGUAGE_HINTS.get(primary, ("ai_application", "Engineer"))[0]
        facts["project_type"] = project_type
        exp.add_evidence(f"github:{full_name}", "Primary language", value=repo.get("primary_language"))

        if languages:
            facts["technology_constraints"] = languages
            exp.add_evidence(f"github:{full_name}", "Detected languages", value=languages)

        headings = repo.get("readme_headings", [])
        if headings:
            facts["deliverables"] = headings
            exp.add_evidence(f"github:{full_name}", "README section headings", value=headings)
        elif topics:
            facts["deliverables"] = topics
            exp.add_evidence(f"github:{full_name}", "Repo topics (no README headings found)", value=topics)

        contributors = repo.get("contributors", [])
        if contributors:
            _, default_role = self._LANGUAGE_HINTS.get(primary, ("ai_application", "Contributor"))
            facts["team_members"] = [
                {"name": c["login"], "role": default_role, "capacity_hours": 40.0, "skills": {}}
                for c in contributors
            ]
            exp.add_evidence(
                f"github:{full_name}", "Contributors (by commit count)",
                value=[c["login"] for c in contributors],
            )

        na = [self._na(
            "Review the imported facts and answer any remaining questions",
            "GitHub import only fills what the repo actually contains",
            "high", "intake",
        )]
        return AgentResult(
            self.name,
            {"facts": facts, "repo_summary": {
                "full_name": full_name, "url": repo_url,
                "stars": repo.get("stargazers_count", 0),
                "open_issues": repo.get("open_issues_count", 0),
            }},
            exp, na,
        )


class GapDetectionAgent(BaseAgent):
    name = "gap-detection-agent"
    purpose = "Detect missing critical intake fields and generate targeted questions."

    def run(self, payload: dict) -> AgentResult:
        known = {k for k, v in payload.get("facts", {}).items() if v and not k.startswith("_")}
        # normalise a few aliases
        alias = {"objective": "project_objective"}
        known = {alias.get(k, k) for k in known}

        gaps = []
        for field in INTAKE_FIELDS:
            if field not in known:
                importance = _FIELD_IMPORTANCE.get(field, "medium")
                gaps.append({
                    "field": field,
                    "importance": importance,
                    "question": self._question(field),
                    "expected_answer_type": self._answer_type(field),
                    "affected_modules": self._affected(field),
                })
        # sort by importance
        order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        gaps.sort(key=lambda g: order[g["importance"]])
        completeness = 1 - len(gaps) / len(INTAKE_FIELDS)

        exp = Explanation(
            summary=f"Found {len(gaps)} gap(s); intake {completeness:.0%} complete.",
            agent=self.name, confidence=1.0,
        )
        exp.add_reason(
            "Compared extracted facts against the structured intake template; "
            "questions are generated only for genuinely missing fields."
        )
        exp.add_evidence(self.name, "Intake completeness", value=round(completeness, 2))
        na = [self._na("Answer clarification questions",
                       "Resolve gaps before planning", "high", "intake")] if gaps else \
             [self._na("Generate WBS", "Intake is complete", "high", "wbs")]
        return AgentResult(
            self.name,
            {"gaps": gaps, "completeness": round(completeness, 3)},
            exp, na,
        )

    @staticmethod
    def _question(field: str) -> str:
        q = {
            "deadline": "What is the hard deadline for delivery?",
            "deliverables": "What are the required deliverables and their acceptance criteria?",
            "team_members": "Who are the team members and their roles?",
            "member_skills": "What skills does each team member have?",
            "member_availability": "How many hours per week is each member available?",
            "testing_window": "How many days are allocated for testing before the deadline?",
            "demo_date": "When is the demo or submission scheduled?",
        }
        return q.get(field, f"Please provide the project's {field.replace('_', ' ')}.")

    @staticmethod
    def _answer_type(field: str) -> str:
        if field in {"deadline", "start_date", "demo_date"}:
            return "date"
        if field in {"team_size", "budget", "testing_window"}:
            return "number"
        if field in {"deliverables", "milestones", "team_members", "member_skills"}:
            return "list"
        return "text"

    @staticmethod
    def _affected(field: str) -> list[str]:
        m = {
            "deadline": ["timeline", "risk", "health"],
            "member_skills": ["resources", "risk"],
            "member_availability": ["resources", "timeline"],
            "deliverables": ["wbs", "reports"],
            "testing_window": ["risk", "health"],
        }
        return m.get(field, ["intake"])


class IntakeAgent(BaseAgent):
    name = "intake-agent"
    purpose = "Merge answers into the project profile and report completeness."

    def run(self, payload: dict) -> AgentResult:
        profile = dict(payload.get("profile", {}))
        answers = payload.get("answers", {})
        profile.update({k: v for k, v in answers.items() if v not in (None, "", [])})
        filled = [f for f in INTAKE_FIELDS if profile.get(f) not in (None, "", [])]
        completeness = len(filled) / len(INTAKE_FIELDS)
        exp = Explanation(
            summary=f"Intake updated; now {completeness:.0%} complete.",
            agent=self.name, confidence=1.0,
        )
        exp.add_reason("Only non-empty answers were merged; nothing was assumed.")
        return AgentResult(
            self.name,
            {"profile": profile, "completeness": round(completeness, 3)},
            exp, [],
        )


class ProjectDNAAgent(BaseAgent):
    name = "project-dna-agent"
    purpose = "Build a reusable project fingerprint for template/methodology matching."

    def run(self, payload: dict) -> AgentResult:
        p = payload.get("profile", {})
        dna = {
            "project_type": p.get("project_type", "ai_application"),
            "methodology": p.get("methodology", "hybrid"),
            "complexity": self._bucket(payload.get("task_count", 0), 8, 20),
            "risk_tolerance": p.get("risk_tolerance", "medium"),
            "team_size": p.get("team_size", 0),
            "dependency_density": payload.get("dependency_density", 0.0),
            "technology_stack": p.get("technology_constraints", []),
            "innovation_level": "high" if "ai" in str(p.get("project_type", "")) else "medium",
        }
        exp = Explanation(
            summary="Built project DNA fingerprint.",
            agent=self.name, confidence=0.85,
        )
        exp.add_reason("DNA is derived from confirmed profile facts and computed metrics.")
        exp.add_evidence(self.name, "DNA", value=dna)
        return AgentResult(self.name, {"dna": dna}, exp, [])

    @staticmethod
    def _bucket(n, lo, hi):
        return "low" if n < lo else ("high" if n > hi else "medium")


class MethodologyAgent(BaseAgent):
    name = "methodology-agent"
    purpose = "Recommend a delivery methodology and map PMBOK."

    def run(self, payload: dict) -> AgentResult:
        res = MethodologyEngine().recommend(payload.get("profile", {}))
        na = [self._na("Confirm methodology", "Human approval recommended",
                       "medium", "methodology")]
        return AgentResult(self.name, res.to_dict(), res.explanation, na)
