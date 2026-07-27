"use client";

import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from "recharts";

import type { StatusColor } from "@/lib/types";
import { clamp, scoreToStatus, statusStyle } from "@/lib/utils";

/**
 * Radial 0..100 health gauge, coloured by traffic-light status.
 * Uses a single-segment RadialBar with a fixed 0..100 angle axis so the fill
 * fraction maps directly to the score.
 */
export function HealthGauge({
  value,
  status,
  size = 200,
  label = "Overall Health",
}: {
  value: number;
  status?: StatusColor | string;
  size?: number;
  label?: string;
}) {
  const score = clamp(Math.round(value), 0, 100);
  const band = (status as StatusColor) ?? scoreToStatus(score);
  const style = statusStyle(band);
  const data = [{ name: "health", value: score, fill: style.hex }];

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      aria-label={`${label}: ${score} out of 100`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="72%"
          outerRadius="100%"
          data={data}
          startAngle={220}
          endAngle={-40}
          barSize={14}
        >
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            angleAxisId={0}
            tick={false}
          />
          <RadialBar
            background={{ fill: "hsl(220 16% 20%)" }}
            dataKey="value"
            cornerRadius={8}
            angleAxisId={0}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-4xl font-semibold tabular-nums"
          style={{ color: style.hex }}
        >
          {score}
        </span>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {style.label}
        </span>
      </div>
    </div>
  );
}
