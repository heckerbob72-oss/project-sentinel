import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { StatusColor } from "@/lib/types";

/** Merge Tailwind class names, resolving conflicts. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// Status colour mapping (traffic-light semantics)
// ---------------------------------------------------------------------------

interface StatusStyle {
  /** Solid dot / marker colour. */
  dot: string;
  /** Text colour. */
  text: string;
  /** Subtle tinted background + border for pills. */
  pill: string;
  /** Raw hex, for charts. */
  hex: string;
  label: string;
}

const STATUS_STYLES: Record<StatusColor, StatusStyle> = {
  green: {
    dot: "bg-status-green",
    text: "text-status-green",
    pill: "bg-status-green/10 text-status-green border-status-green/30",
    hex: "#22c55e",
    label: "Green",
  },
  amber: {
    dot: "bg-status-amber",
    text: "text-status-amber",
    pill: "bg-status-amber/10 text-status-amber border-status-amber/30",
    hex: "#f59e0b",
    label: "Amber",
  },
  red: {
    dot: "bg-status-red",
    text: "text-status-red",
    pill: "bg-status-red/10 text-status-red border-status-red/30",
    hex: "#ef4444",
    label: "Red",
  },
  critical: {
    dot: "bg-status-critical",
    text: "text-status-critical",
    pill: "bg-status-critical/10 text-status-critical border-status-critical/40",
    hex: "#a21caf",
    label: "Critical",
  },
};

export function statusStyle(status: StatusColor | string | undefined): StatusStyle {
  const key = (status ?? "").toLowerCase() as StatusColor;
  return STATUS_STYLES[key] ?? STATUS_STYLES.amber;
}

export function statusColor(status: StatusColor | string | undefined): string {
  return statusStyle(status).hex;
}

/** Map a 0..100 score to a traffic-light band consistent with the backend. */
export function scoreToStatus(score: number): StatusColor {
  if (score >= 80) return "green";
  if (score >= 60) return "amber";
  if (score >= 40) return "red";
  return "critical";
}

/** Map a severity/priority word to a status colour. */
export function severityToStatus(severity: string | undefined): StatusColor {
  switch ((severity ?? "").toLowerCase()) {
    case "low":
      return "green";
    case "medium":
    case "moderate":
      return "amber";
    case "high":
      return "red";
    case "critical":
    case "severe":
      return "critical";
    default:
      return "amber";
  }
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

export function formatNumber(
  value: number | undefined | null,
  digits = 0,
): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPercent(
  value: number | undefined | null,
  digits = 0,
): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  // Accept both 0..1 and 0..100 inputs.
  const pct = value <= 1 ? value * 100 : value;
  return `${pct.toFixed(digits)}%`;
}

export function formatSignedPercent(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}`;
}

export function formatDate(
  input: string | number | Date | undefined | null,
  opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
): string {
  if (!input) return "—";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  return d.toLocaleDateString(undefined, opts);
}

export function formatDateTime(input: string | number | Date | undefined | null): string {
  if (!input) return "—";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(days: number | undefined | null): string {
  if (days === undefined || days === null || Number.isNaN(days)) return "—";
  const rounded = Math.round(days * 10) / 10;
  return `${rounded} ${rounded === 1 ? "day" : "days"}`;
}

/** Relative "3h ago" style timestamp. */
export function timeAgo(input: string | number | Date | undefined | null): string {
  if (!input) return "—";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/** Clamp a number into a range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Truncate a string with an ellipsis. */
export function truncate(value: string, max = 80): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
