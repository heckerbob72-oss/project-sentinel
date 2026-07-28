"""
Scheduling Engine — deterministic Critical Path Method (CPM) + PERT.

Implements, from first principles (no scheduling library):
  - PERT expected duration:  (O + 4M + P) / 6
  - PERT variance:           ((P - O) / 6) ** 2
  - CPM forward pass:        earliest start / earliest finish
  - CPM backward pass:       latest start / latest finish
  - float / slack:           LS - ES  (== LF - EF)
  - critical path:           the chain of zero-float tasks
  - deadline feasibility:    project finish vs. hard deadline
  - schedule compression:    flagged when finish exceeds deadline
  - Gantt export:            per-task ES/EF for the frontend

All results carry an Explanation so a judge can see exactly how the timeline
was derived. Requires a valid DAG (use DependencyEngine first to guarantee it).
"""
from __future__ import annotations

import math
from collections.abc import Iterable
from dataclasses import dataclass, field

from .explain import Calculation, Explanation


@dataclass
class ScheduledTask:
    id: str
    label: str
    optimistic: float
    most_likely: float
    pessimistic: float
    duration: float = 0.0
    variance: float = 0.0
    earliest_start: float = 0.0
    earliest_finish: float = 0.0
    latest_start: float = 0.0
    latest_finish: float = 0.0
    total_float: float = 0.0
    is_critical: bool = False
    predecessors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "label": self.label,
            "duration": round(self.duration, 3),
            "variance": round(self.variance, 4),
            "earliest_start": round(self.earliest_start, 3),
            "earliest_finish": round(self.earliest_finish, 3),
            "latest_start": round(self.latest_start, 3),
            "latest_finish": round(self.latest_finish, 3),
            "total_float": round(self.total_float, 3),
            "is_critical": self.is_critical,
            "predecessors": self.predecessors,
        }


@dataclass
class ScheduleResult:
    tasks: list[ScheduledTask]
    project_duration: float
    project_std_dev: float
    critical_path: list[str]
    deadline: float | None
    deadline_feasible: bool | None
    schedule_pressure: float | None
    explanation: Explanation

    def to_dict(self) -> dict:
        return {
            "tasks": [t.to_dict() for t in self.tasks],
            "project_duration": round(self.project_duration, 3),
            "project_std_dev": round(self.project_std_dev, 3),
            "critical_path": self.critical_path,
            "deadline": self.deadline,
            "deadline_feasible": self.deadline_feasible,
            "schedule_pressure": (
                round(self.schedule_pressure, 3)
                if self.schedule_pressure is not None
                else None
            ),
            "gantt": [
                {
                    "task_id": t.id,
                    "label": t.label,
                    "start": round(t.earliest_start, 3),
                    "end": round(t.earliest_finish, 3),
                    "critical": t.is_critical,
                }
                for t in self.tasks
            ],
            "explanation": self.explanation.to_dict(),
        }


class SchedulingEngine:
    EPS = 1e-9
    MAX_SCHEDULE_PRESSURE = 10.0

    @staticmethod
    def pert_expected(o: float, m: float, p: float) -> float:
        return (o + 4.0 * m + p) / 6.0

    @staticmethod
    def pert_variance(o: float, p: float) -> float:
        return ((p - o) / 6.0) ** 2

    def schedule(
        self,
        tasks: Iterable[dict],
        dependencies: Iterable[dict],
        deadline: float | None = None,
    ) -> ScheduleResult:
        """
        tasks: [{"id","label","optimistic","most_likely","pessimistic"}]
                (if only "duration" given, O=M=P=duration)
        dependencies: [{"source","target"}]  source finishes before target starts
        deadline: hard project deadline in the same unit as durations (days).
        """
        st: dict[str, ScheduledTask] = {}
        for t in tasks:
            o = float(t.get("optimistic", t.get("duration", 1)))
            m = float(t.get("most_likely", t.get("duration", 1)))
            p = float(t.get("pessimistic", t.get("duration", 1)))
            dur = self.pert_expected(o, m, p)
            var = self.pert_variance(o, p)
            st[t["id"]] = ScheduledTask(
                id=t["id"],
                label=t.get("label", t["id"]),
                optimistic=o,
                most_likely=m,
                pessimistic=p,
                duration=dur,
                variance=var,
            )

        successors: dict[str, list[str]] = {tid: [] for tid in st}
        for dep in dependencies:
            s, tg = dep["source"], dep["target"]
            if s in st and tg in st:
                st[tg].predecessors.append(s)
                successors[s].append(tg)

        order = self._topo(st, successors)
        if order is None:
            raise ValueError(
                "Scheduling requires an acyclic dependency graph; a cycle was found. "
                "Run DependencyEngine and resolve the cycle before scheduling."
            )

        # ----- forward pass: ES / EF -----
        for tid in order:
            task = st[tid]
            if task.predecessors:
                task.earliest_start = max(st[p].earliest_finish for p in task.predecessors)
            else:
                task.earliest_start = 0.0
            task.earliest_finish = task.earliest_start + task.duration

        project_duration = max((t.earliest_finish for t in st.values()), default=0.0)

        # ----- backward pass: LS / LF -----
        for tid in reversed(order):
            task = st[tid]
            succ = successors[tid]
            if succ:
                task.latest_finish = min(st[s].latest_start for s in succ)
            else:
                task.latest_finish = project_duration
            task.latest_start = task.latest_finish - task.duration
            task.total_float = task.latest_start - task.earliest_start
            task.is_critical = abs(task.total_float) < self.EPS

        critical_path = self._critical_path(st, successors, order)

        # PERT project std dev = sqrt(sum of variances along the critical path)
        cp_variance = sum(st[tid].variance for tid in critical_path)
        project_std_dev = math.sqrt(cp_variance)

        deadline_feasible: bool | None = None
        schedule_pressure: float | None = None
        if deadline is not None:
            deadline_feasible = project_duration <= deadline + self.EPS
            # pressure = required work / available time; >1 means infeasible
            schedule_pressure = (
                min(project_duration / deadline, self.MAX_SCHEDULE_PRESSURE)
                if deadline > 0
                else self.MAX_SCHEDULE_PRESSURE
            )

        exp = self._explain(
            st, project_duration, project_std_dev, critical_path,
            deadline, deadline_feasible, schedule_pressure,
        )

        ordered_tasks = [st[tid] for tid in order]
        return ScheduleResult(
            tasks=ordered_tasks,
            project_duration=project_duration,
            project_std_dev=project_std_dev,
            critical_path=critical_path,
            deadline=deadline,
            deadline_feasible=deadline_feasible,
            schedule_pressure=schedule_pressure,
            explanation=exp,
        )

    # ----- helpers -----

    def _topo(self, st, successors) -> list[str] | None:
        in_deg = {tid: len(t.predecessors) for tid, t in st.items()}
        ready = sorted([tid for tid, d in in_deg.items() if d == 0])
        order: list[str] = []
        while ready:
            u = ready.pop(0)
            order.append(u)
            for v in sorted(successors[u]):
                in_deg[v] -= 1
                if in_deg[v] == 0:
                    ready.append(v)
            ready.sort()
        return order if len(order) == len(st) else None

    def _critical_path(self, st, successors, order) -> list[str]:
        # Walk critical tasks from a critical start node following critical successors,
        # choosing the successor whose earliest_start matches this task's earliest_finish.
        critical_ids = [tid for tid in order if st[tid].is_critical]
        if not critical_ids:
            return []
        starts = [tid for tid in critical_ids if not st[tid].predecessors] or [critical_ids[0]]
        # pick the start that leads to the longest chain (deterministic)
        best_path: list[str] = []
        for start in sorted(starts):
            path = [start]
            cur = start
            while True:
                nxt = [
                    s
                    for s in sorted(successors[cur])
                    if st[s].is_critical
                    and abs(st[s].earliest_start - st[cur].earliest_finish) < self.EPS
                ]
                if not nxt:
                    break
                cur = nxt[0]
                path.append(cur)
            if len(path) > len(best_path):
                best_path = path
        return best_path

    def _explain(
        self, st, duration, std_dev, critical_path,
        deadline, feasible, pressure,
    ) -> Explanation:
        exp = Explanation(
            summary=(
                f"Computed schedule via CPM. Project duration = {duration:.1f} days; "
                f"critical path has {len(critical_path)} task(s)."
            ),
            agent="scheduling-engine",
        )
        exp.add_reason(
            "Task durations estimated with PERT: (O + 4M + P) / 6."
        )
        exp.add_reason(
            "Forward pass computed earliest start/finish; backward pass computed "
            "latest start/finish; float = LS - ES."
        )
        exp.add_reason(
            "Critical path = chain of zero-float tasks; it sets the project duration."
        )
        for tid in critical_path:
            t = st[tid]
            exp.add_evidence(
                source=f"task:{tid}",
                detail=f"'{t.label}' on critical path (float={t.total_float:.2f})",
                value={"duration": round(t.duration, 2)},
            )
        exp.add_calc(
            Calculation(
                name="project_duration",
                formula="max(EF over all tasks)",
                inputs={"tasks": len(st)},
                result=round(duration, 3),
            )
        )
        exp.add_calc(
            Calculation(
                name="project_std_dev",
                formula="sqrt(sum(variance) along critical path)",
                inputs={"critical_path": critical_path},
                result=round(std_dev, 3),
            )
        )
        if deadline is not None:
            exp.add_calc(
                Calculation(
                    name="schedule_pressure",
                    formula="project_duration / deadline",
                    inputs={"project_duration": round(duration, 2), "deadline": deadline},
                    result=round(pressure, 3) if pressure is not None else None,
                )
            )
            if feasible:
                exp.add_reason(
                    f"Deadline {deadline} days is feasible "
                    f"({duration:.1f} <= {deadline})."
                )
            else:
                exp.trigger("SCHEDULE_INFEASIBLE")
                if deadline <= 0:
                    exp.add_reason(
                        "The scenario leaves no delivery time; the deadline is "
                        "INFEASIBLE and schedule pressure is capped at the maximum."
                    )
                else:
                    exp.add_reason(
                        f"Deadline {deadline} days is INFEASIBLE — project needs "
                        f"{duration:.1f} days. Schedule compression required."
                    )
                exp.alternatives = [
                    "Reduce scope of non-critical deliverables",
                    "Parallelise independent critical-path tasks",
                    "Add capacity to critical-path owners",
                ]
        exp.confidence = 1.0
        return exp
