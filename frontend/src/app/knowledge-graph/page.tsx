"use client";

import { useQuery } from "@tanstack/react-query";
import { Share2 } from "lucide-react";
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

import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiGetData } from "@/lib/api";
import { useProjectStore } from "@/store/useProjectStore";

import "reactflow/dist/style.css";

interface KgNode {
  id: string;
  type: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attributes?: Record<string, any>;
}

interface KgEdge {
  source: string;
  target: string;
  relation?: string;
}

interface KnowledgeGraph {
  nodes: KgNode[];
  edges: KgEdge[];
}

/** Node fill / border colours by entity type. */
const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  project: { bg: "rgba(99,102,241,0.16)", border: "rgba(129,140,248,0.7)", text: "#c7d2fe" },
  risk: { bg: "rgba(239,68,68,0.14)", border: "rgba(239,68,68,0.6)", text: "#fecaca" },
  task: { bg: "rgba(245,158,11,0.14)", border: "rgba(245,158,11,0.6)", text: "#fde68a" },
  deliverable: { bg: "rgba(34,197,94,0.14)", border: "rgba(34,197,94,0.6)", text: "#bbf7d0" },
  person: { bg: "rgba(56,189,248,0.14)", border: "rgba(56,189,248,0.6)", text: "#bae6fd" },
};

const DEFAULT_COLOR = { bg: "hsl(222 26% 12%)", border: "hsl(220 18% 24%)", text: "#e5e9f0" };

const LEGEND = ["project", "risk", "task", "deliverable", "person"];

export default function KnowledgeGraphPage() {
  const projectId = useProjectStore((s) => s.selectedProjectId) ?? "1";
  const projectName = useProjectStore((s) => s.selectedProjectName);

  const { data, isLoading, isError, fetchStatus } = useQuery({
    queryKey: ["knowledge-graph", projectId],
    queryFn: () => apiGetData<KnowledgeGraph>(`/knowledge-graph/${projectId}`),
    enabled: Boolean(projectId),
    retry: 0,
  });

  const nodes = useMemo(() => data?.nodes ?? [], [data]);
  const edges = useMemo(() => data?.edges ?? [], [data]);

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
      if (seen.has(id)) return 0;
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
      const color = TYPE_COLORS[n.type?.toLowerCase()] ?? DEFAULT_COLOR;
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
          color: color.text,
          background: color.bg,
          border: `1px solid ${color.border}`,
        },
      };
    });

    const rfEdges: Edge[] = edges.map((e, i) => ({
      id: `e-${e.source}-${e.target}-${i}`,
      source: e.source,
      target: e.target,
      label: e.relation,
      style: { stroke: "hsl(220 18% 34%)", strokeWidth: 1.25 },
      labelStyle: { fill: "hsl(218 12% 60%)", fontSize: 9 },
      labelBgStyle: { fill: "hsl(222 26% 12%)" },
      markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(220 18% 40%)" },
    }));

    return { rfNodes, rfEdges };
  }, [nodes, edges]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <Share2 size={20} className="text-sentinel-300" /> Knowledge Graph
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {projectName ?? "Selected project"} · the interconnected memory of
          projects, people, risks, and deliverables.
        </p>
      </div>

      {isLoading && fetchStatus !== "idle" ? (
        <Card className="p-5">
          <Skeleton className="h-[520px] w-full" />
        </Card>
      ) : isError ? (
        <EmptyState
          variant="error"
          title="Couldn't load the knowledge graph"
          description="The knowledge-graph API is unavailable. This view populates once the backend is online."
        />
      ) : !nodes.length ? (
        <EmptyState title="No graph data" description="No entities have been indexed for this project yet." />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            {LEGEND.map((t) => {
              const c = TYPE_COLORS[t];
              return (
                <span key={t} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: c.border }}
                  />
                  <span className="capitalize">{t}</span>
                </span>
              );
            })}
          </div>

          <div
            className="overflow-hidden rounded-lg border border-border bg-surface"
            style={{ height: 560 }}
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
        </div>
      )}
    </div>
  );
}
