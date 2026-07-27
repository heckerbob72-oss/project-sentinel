"""
Dependency Engine — deterministic DAG construction and analysis.

Responsibilities:
  - build a directed graph of task dependencies
  - validate it is a DAG (detect cycles)
  - topological sort (execution order)
  - detect bottlenecks (high fan-out / fan-in nodes)
  - detect single points of failure
  - export nodes/edges for visualisation (React Flow compatible)

Pure standard library — no third-party graph package — so behaviour is
transparent and fully testable. Every result carries an Explanation.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

from .explain import Calculation, Explanation


@dataclass
class DependencyNode:
    id: str
    label: str
    successors: list[str] = field(default_factory=list)
    predecessors: list[str] = field(default_factory=list)


@dataclass
class DependencyEdge:
    source: str
    target: str
    dependency_type: str = "finish_to_start"
    reason: str = ""


@dataclass
class CycleResult:
    has_cycle: bool
    cycle_path: list[str]


@dataclass
class DependencyGraphResult:
    nodes: list[DependencyNode]
    edges: list[DependencyEdge]
    cycle: CycleResult
    topological_order: list[str]
    bottlenecks: list[dict]
    single_points_of_failure: list[str]
    explanation: Explanation

    def to_dict(self) -> dict:
        return {
            "nodes": [
                {
                    "id": n.id,
                    "label": n.label,
                    "successors": n.successors,
                    "predecessors": n.predecessors,
                }
                for n in self.nodes
            ],
            "edges": [
                {
                    "source": e.source,
                    "target": e.target,
                    "dependency_type": e.dependency_type,
                    "reason": e.reason,
                }
                for e in self.edges
            ],
            "cycle": {"has_cycle": self.cycle.has_cycle, "cycle_path": self.cycle.cycle_path},
            "topological_order": self.topological_order,
            "bottlenecks": self.bottlenecks,
            "single_points_of_failure": self.single_points_of_failure,
            "explanation": self.explanation.to_dict(),
        }


class DependencyEngine:
    """Build and analyse a task dependency graph."""

    def __init__(self, bottleneck_threshold: int = 2):
        # A node is flagged a bottleneck when (fan_in + fan_out) >= threshold*2
        self.bottleneck_threshold = bottleneck_threshold

    def build(
        self,
        tasks: Iterable[dict],
        dependencies: Iterable[dict],
    ) -> DependencyGraphResult:
        """
        tasks: [{"id": "T1", "label": "Design API"}, ...]
        dependencies: [{"source": "T1", "target": "T2", "type": "finish_to_start",
                        "reason": "API contract needed before frontend"}, ...]
        Edge semantics: source must finish before target can start.
        """
        nodes: dict[str, DependencyNode] = {
            t["id"]: DependencyNode(id=t["id"], label=t.get("label", t["id"]))
            for t in tasks
        }
        edges: list[DependencyEdge] = []

        for dep in dependencies:
            s, tg = dep["source"], dep["target"]
            if s not in nodes or tg not in nodes:
                # skip dangling edges but record nothing invalid in the graph
                continue
            edges.append(
                DependencyEdge(
                    source=s,
                    target=tg,
                    dependency_type=dep.get("type", "finish_to_start"),
                    reason=dep.get("reason", ""),
                )
            )
            nodes[s].successors.append(tg)
            nodes[tg].predecessors.append(s)

        cycle = self._detect_cycle(nodes)
        topo = [] if cycle.has_cycle else self._topological_sort(nodes)
        bottlenecks = self._bottlenecks(nodes)
        spof = self._single_points_of_failure(nodes)

        exp = Explanation(
            summary=(
                f"Built dependency graph with {len(nodes)} tasks and {len(edges)} edges."
            ),
            agent="dependency-engine",
        )
        exp.add_calc(
            Calculation(
                name="graph_size",
                formula="|V|, |E|",
                inputs={"tasks": len(nodes), "dependencies": len(edges)},
                result={"nodes": len(nodes), "edges": len(edges)},
            )
        )
        if cycle.has_cycle:
            exp.trigger("DEP_CYCLE_DETECTED")
            exp.add_reason(
                "A dependency cycle was detected — the plan cannot be scheduled "
                f"until it is broken: {' -> '.join(cycle.cycle_path)}."
            )
            exp.add_evidence(
                source="dependency-engine",
                detail="Cycle path",
                value=cycle.cycle_path,
            )
            exp.confidence = 1.0
        else:
            exp.add_reason(
                "Graph is a valid DAG; a topological execution order exists."
            )
        if bottlenecks:
            exp.trigger("DEP_BOTTLENECK")
            exp.add_reason(
                f"{len(bottlenecks)} bottleneck task(s) concentrate dependencies."
            )
        if spof:
            exp.trigger("DEP_SINGLE_POINT_OF_FAILURE")
            exp.add_reason(
                f"{len(spof)} task(s) are single points of failure "
                "(sole predecessor of downstream work)."
            )

        return DependencyGraphResult(
            nodes=list(nodes.values()),
            edges=edges,
            cycle=cycle,
            topological_order=topo,
            bottlenecks=bottlenecks,
            single_points_of_failure=spof,
            explanation=exp,
        )

    # ----- graph algorithms (transparent, standard library only) -----

    def _detect_cycle(self, nodes: dict[str, DependencyNode]) -> CycleResult:
        WHITE, GRAY, BLACK = 0, 1, 2
        color = {nid: WHITE for nid in nodes}
        parent: dict[str, str | None] = {nid: None for nid in nodes}

        def dfs(u: str) -> list[str] | None:
            color[u] = GRAY
            for v in nodes[u].successors:
                if color[v] == GRAY:
                    # reconstruct cycle path
                    path = [v, u]
                    cur = parent[u]
                    while cur is not None and cur != v:
                        path.append(cur)
                        cur = parent[cur]
                    path.append(v)
                    path.reverse()
                    return path
                if color[v] == WHITE:
                    parent[v] = u
                    found = dfs(v)
                    if found:
                        return found
            color[u] = BLACK
            return None

        for nid in nodes:
            if color[nid] == WHITE:
                found = dfs(nid)
                if found:
                    return CycleResult(has_cycle=True, cycle_path=found)
        return CycleResult(has_cycle=False, cycle_path=[])

    def _topological_sort(self, nodes: dict[str, DependencyNode]) -> list[str]:
        # Kahn's algorithm — deterministic ordering by sorting ready set.
        in_degree = {nid: len(n.predecessors) for nid, n in nodes.items()}
        ready = sorted([nid for nid, d in in_degree.items() if d == 0])
        order: list[str] = []
        while ready:
            u = ready.pop(0)
            order.append(u)
            for v in sorted(nodes[u].successors):
                in_degree[v] -= 1
                if in_degree[v] == 0:
                    ready.append(v)
            ready.sort()
        return order

    def _bottlenecks(self, nodes: dict[str, DependencyNode]) -> list[dict]:
        results = []
        for n in nodes.values():
            score = len(n.predecessors) + len(n.successors)
            if score >= self.bottleneck_threshold * 2:
                results.append(
                    {
                        "task_id": n.id,
                        "label": n.label,
                        "fan_in": len(n.predecessors),
                        "fan_out": len(n.successors),
                        "bottleneck_score": score,
                    }
                )
        return sorted(results, key=lambda r: r["bottleneck_score"], reverse=True)

    def _single_points_of_failure(self, nodes: dict[str, DependencyNode]) -> list[str]:
        # A task is a SPOF if it is the ONLY predecessor of >=2 downstream tasks.
        spof = []
        for n in nodes.values():
            dependents_with_single_pred = [
                s for s in n.successors if len(nodes[s].predecessors) == 1
            ]
            if len(dependents_with_single_pred) >= 2:
                spof.append(n.id)
        return spof
