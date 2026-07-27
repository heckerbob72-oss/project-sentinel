"""
Resource Engine — deterministic skill-matched allocation and capacity analysis.

Responsibilities:
  - match tasks to members by required skills + expertise
  - respect available capacity (hours), avoid over-allocation
  - compute utilisation per member
  - detect overloaded members and single points of failure
  - suggest a backup owner for critical tasks
  - report unassigned tasks and skill gaps

Greedy, explainable assignment: each task goes to the best-fitting member with
remaining capacity. Every assignment records why it was made.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .explain import Calculation, Explanation


@dataclass
class Member:
    id: str
    name: str
    skills: dict[str, int]      # skill -> expertise 1..5
    capacity_hours: float
    role: str = "Contributor"
    allocated_hours: float = 0.0


@dataclass
class Assignment:
    task_id: str
    task_label: str
    member_id: str | None
    member_name: str | None
    skill_match: float          # 0..1
    hours: float
    reason: str
    backup_member_id: str | None = None

    def to_dict(self) -> dict:
        return {
            "task_id": self.task_id,
            "task_label": self.task_label,
            "member_id": self.member_id,
            "member_name": self.member_name,
            "skill_match": round(self.skill_match, 2),
            "hours": self.hours,
            "reason": self.reason,
            "backup_member_id": self.backup_member_id,
        }


@dataclass
class AllocationResult:
    assignments: list[Assignment]
    utilisation: dict[str, float]
    overloaded_members: list[str]
    unassigned_tasks: list[str]
    skill_gaps: list[str]
    explanation: Explanation

    def to_dict(self) -> dict:
        return {
            "assignments": [a.to_dict() for a in self.assignments],
            "utilisation": {k: round(v, 3) for k, v in self.utilisation.items()},
            "overloaded_members": self.overloaded_members,
            "unassigned_tasks": self.unassigned_tasks,
            "skill_gaps": self.skill_gaps,
            "explanation": self.explanation.to_dict(),
        }


class ResourceEngine:
    def allocate(self, tasks: list[dict], members: list[dict]) -> AllocationResult:
        """
        tasks:   [{"id","label","required_skills":[..],"hours":8,"critical":bool}]
        members: [{"id","name","skills":{skill:level},"capacity_hours":40,"role"}]
        """
        mem: dict[str, Member] = {
            m["id"]: Member(
                id=m["id"],
                name=m.get("name", m["id"]),
                skills={k: int(v) for k, v in m.get("skills", {}).items()},
                capacity_hours=float(m.get("capacity_hours", 40)),
                role=m.get("role", "Contributor"),
            )
            for m in members
        }

        assignments: list[Assignment] = []
        unassigned: list[str] = []
        skill_gaps: set[str] = set()

        # deterministic order: critical first, then by required skill count
        ordered = sorted(
            tasks,
            key=lambda t: (not t.get("critical", False), -len(t.get("required_skills", []))),
        )

        for t in ordered:
            req = t.get("required_skills", [])
            hours = float(t.get("hours", 8))
            ranked = self._rank_members(req, mem, hours)
            if not ranked:
                # is it a capacity problem or a skill problem?
                if not any(self._match(req, m.skills)[0] > 0 for m in mem.values()) and req:
                    for s in req:
                        if not any(s in m.skills for m in mem.values()):
                            skill_gaps.add(s)
                unassigned.append(t["id"])
                assignments.append(
                    Assignment(
                        task_id=t["id"],
                        task_label=t.get("label", t["id"]),
                        member_id=None,
                        member_name=None,
                        skill_match=0.0,
                        hours=hours,
                        reason="No member with matching skills and free capacity.",
                    )
                )
                continue

            best_id, match = ranked[0]
            backup_id = ranked[1][0] if len(ranked) > 1 else None
            m = mem[best_id]
            m.allocated_hours += hours
            reason = (
                f"{m.name} has the strongest skill match ({match:.0%}) for "
                f"{req or 'general'} and free capacity "
                f"({m.allocated_hours:.0f}/{m.capacity_hours:.0f}h after assignment)."
            )
            assignments.append(
                Assignment(
                    task_id=t["id"],
                    task_label=t.get("label", t["id"]),
                    member_id=best_id,
                    member_name=m.name,
                    skill_match=match,
                    hours=hours,
                    reason=reason,
                    backup_member_id=backup_id,
                )
            )

        utilisation = {
            m.id: (m.allocated_hours / m.capacity_hours if m.capacity_hours else 0.0)
            for m in mem.values()
        }
        overloaded = [mid for mid, u in utilisation.items() if u > 1.0]

        exp = Explanation(
            summary=(
                f"Allocated {len(assignments) - len(unassigned)}/{len(tasks)} tasks "
                f"across {len(mem)} members."
            ),
            agent="resource-engine",
            confidence=1.0,
        )
        exp.add_reason(
            "Greedy skill-matched assignment: critical tasks first, each to the "
            "best-fitting member with remaining capacity."
        )
        exp.add_calc(
            Calculation(
                name="utilisation",
                formula="allocated_hours / capacity_hours per member",
                inputs={m.id: {"alloc": m.allocated_hours, "cap": m.capacity_hours} for m in mem.values()},
                result={k: round(v, 2) for k, v in utilisation.items()},
            )
        )
        if overloaded:
            exp.trigger("RESOURCE_OVERLOAD")
            exp.add_reason(f"Overloaded members: {', '.join(overloaded)}.")
        if unassigned:
            exp.add_reason(f"Unassigned tasks: {', '.join(unassigned)}.")
        if skill_gaps:
            exp.trigger("SKILL_GAP")
            exp.add_reason(f"Skill gaps on team: {', '.join(sorted(skill_gaps))}.")

        return AllocationResult(
            assignments=assignments,
            utilisation=utilisation,
            overloaded_members=overloaded,
            unassigned_tasks=unassigned,
            skill_gaps=sorted(skill_gaps),
            explanation=exp,
        )

    def _match(self, required: list[str], skills: dict[str, int]) -> tuple[float, int]:
        if not required:
            return 0.5, 0  # neutral fit for skill-agnostic work
        covered = [s for s in required if s in skills]
        if not covered:
            return 0.0, 0
        avg_level = sum(skills[s] for s in covered) / len(covered)
        coverage = len(covered) / len(required)
        # weight coverage 70%, expertise 30% (expertise normalised to 5)
        return coverage * 0.7 + (avg_level / 5.0) * 0.3, len(covered)

    def _rank_members(self, required, mem, hours) -> list[tuple[str, float]]:
        ranked = []
        for m in mem.values():
            match, _ = self._match(required, m.skills)
            has_capacity = (m.allocated_hours + hours) <= m.capacity_hours
            if match > 0 and has_capacity:
                ranked.append((m.id, match))
        # sort by match desc, then least-loaded first for tie-break, then id
        ranked.sort(key=lambda r: (-r[1], mem[r[0]].allocated_hours, r[0]))
        return ranked
