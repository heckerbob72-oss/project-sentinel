"use client";

import { useMemo } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  Position,
  type Edge,
  type Node,
} from "reactflow";

import type { DependencyEdge, DependencyNode } from "@/lib/types";

import "reactflow/dist/style.css";

/**
 * React Flow wrapper for the task dependency graph. Nodes on the critical path
 * (or single points of failure) are highlighted red. Layout is a simple
 * longest-path layering so the DAG reads left→right.
 */
export function DependencyGraph({
  nodes,
  edges,
  criticalIds = [],
  height = 460,
}: {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  criticalIds?: string[];
  height?: number;
}) {
  const critical = useMemo(() => new Set(criticalIds), [criticalIds]);

  const { rfNodes, rfEdges } = useMemo(() => {
    // longest-path layering: depth = max(depth(pred)) + 1
    const preds = new Map<string, string[]>();
    nodes.forEach((n) => preds.set(n.id, []));
    edges.forEach((e) => {
      if (preds.has(e.target)) preds.get(e.target)!.push(e.source);
    });

    const depth = new Map<string, number>();
    const resolve = (id: string, seen: Set<string>): number => {
      if (depth.has(id)) return depth.get(id)!;
      if (seen.has(id)) return 0; // cycle guard
      seen.add(id);
      const ps = preds.get(id) ?? [];
      const d = ps.length ? Math.max(...ps.map((p) => resolve(p, seen) + 1)) : 0;
      depth.set(id, d);
      return d;
    };
    nodes.forEach((n) => resolve(n.id, new Set()));

    const perLayer = new Map<number, number>();
    const rfNodes: Node[] = nodes.map((n) => {
      const d = depth.get(n.id) ?? 0;
      const row = perLayer.get(d) ?? 0;
      perLayer.set(d, row + 1);
      const isCritical = critical.has(n.id);
      return {
        id: n.id,
        position: { x: d * 240, y: row * 96 },
        data: { label: n.label },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: {
          padding: "8px 12px",
          borderRadius: 10,
          fontSize: 12,
          fontWeight: 500,
          width: 176,
          color: isCritical ? "#fecaca" : "#e5e9f0",
          background: isCritical ? "rgba(239,68,68,0.12)" : "hsl(222 26% 12%)",
          border: `1px solid ${isCritical ? "rgba(239,68,68,0.6)" : "hsl(220 18% 24%)"}`,
        },
      };
    });

    const rfEdges: Edge[] = edges.map((e, i) => {
      const isCritical = critical.has(e.source) && critical.has(e.target);
      return {
        id: `e-${e.source}-${e.target}-${i}`,
        source: e.source,
        target: e.target,
        animated: isCritical,
        label: e.dependency_type,
        style: {
          stroke: isCritical ? "#ef4444" : "hsl(220 18% 34%)",
          strokeWidth: isCritical ? 2 : 1.25,
        },
        labelStyle: { fill: "hsl(218 12% 60%)", fontSize: 9 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isCritical ? "#ef4444" : "hsl(220 18% 40%)",
        },
      };
    });

    return { rfNodes, rfEdges };
  }, [nodes, edges, critical]);

  if (!nodes.length) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground"
        style={{ height }}
      >
        No dependency data to graph.
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-lg border border-border bg-surface"
      style={{ height }}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        nodesDraggable
        nodesConnectable={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(220 18% 22%)" />
        <Controls className="!bg-surface-overlay !text-foreground" showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
