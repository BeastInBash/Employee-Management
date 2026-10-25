import { api } from "./api";

// Mirrors GET /api/reports (backend reports.controller.ts).

export type ReportScopeType = "workspace" | "project" | "team" | "me";

export type ReportSummary = {
  people: number;
  tasksCreated: number;
  tasksCompleted: number;
  /** % of tasks created in the range that are now done; null when none were created. */
  completionRate: number | null;
  /** % of tasks completed in the range that were done by their due date. */
  onTimeRate: number | null;
  overdueOpen: number;
  avgCycleHours: number | null;
  /** (present + ½ partial) / recorded days, weekends optionally excluded. */
  attendanceRate: number | null;
  presentDays: number;
  partialDays: number;
  absentDays: number;
};

export type ReportDay = {
  date: string;
  weekend: boolean;
  created: number;
  completed: number;
  present: number;
  partial: number;
  absent: number;
};

export type ReportMember = {
  id: string;
  userId: string;
  name: string;
  jobTitle: string;
  created: number;
  completed: number;
  onTimeRate: number | null;
  overdueOpen: number;
  avgCycleHours: number | null;
  present: number;
  partial: number;
  absent: number;
  attendanceRate: number | null;
};

export type Report = {
  scope: { type: ReportScopeType; id: string | null; name: string };
  range: { from: string; to: string; days: number; excludeWeekends: boolean };
  summary: ReportSummary;
  trend: ReportDay[];
  members: ReportMember[];
};

export type ReportParams = {
  scope: ReportScopeType;
  id?: string;
  from: string;
  to: string;
  excludeWeekends: boolean;
};

export const fetchReport = (p: ReportParams) =>
  api<Report>("/reports", {
    query: {
      scope: p.scope,
      id: p.id,
      from: p.from,
      to: p.to,
      excludeWeekends: String(p.excludeWeekends),
    },
  });

// ─── dates (IST calendar days, like the API) ──────────────────────────────────

const IST_OFFSET_MS = 330 * 60 * 1000;

export const istToday = () => new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);

export const shiftDays = (key: string, days: number) =>
  new Date(Date.parse(`${key}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export type RangePreset = "7d" | "30d" | "90d" | "month";

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "month", label: "This month" },
];

export function presetRange(preset: RangePreset): { from: string; to: string } {
  const to = istToday();
  if (preset === "month") return { from: `${to.slice(0, 8)}01`, to };
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  return { from: shiftDays(to, -(days - 1)), to };
}

/** "21 Oct" (or "21 Oct 2026" with `withYear`) from a YYYY-MM-DD key, timezone-safe. */
export const formatDay = (key: string, withYear = false) =>
  new Date(`${key}T00:00:00Z`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(withYear && { year: "numeric" }),
    timeZone: "UTC",
  });

export const formatPct = (v: number | null) => (v === null ? "—" : `${v}%`);

/** 5.5 → "5.5h", 30 → "1.3d". */
export const formatHours = (v: number | null) => {
  if (v === null) return "—";
  return v >= 24 ? `${Math.round((v / 24) * 10) / 10}d` : `${v}h`;
};

// ─── CSV export ─────────────────────────────────────────────────────────────

/**
 * Quote a cell, and neutralise values a spreadsheet would run as a formula
 * (names come from users, so "=HYPERLINK(...)" must stay text).
 */
function csvCell(value: string | number | null): string {
  if (value === null) return "";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(filename: string, header: string[], rows: (string | number | null)[][]) {
  const body = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  // BOM so Excel opens UTF-8 names correctly.
  const blob = new Blob(["﻿", body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "report";

export function exportMembersCsv(report: Report) {
  downloadCsv(
    `${slug(report.scope.name)}-people-${report.range.from}-to-${report.range.to}.csv`,
    [
      "Name",
      "Job title",
      "Tasks created",
      "Tasks completed",
      "On-time %",
      "Overdue now",
      "Avg cycle (hours)",
      "Present days",
      "Partial days",
      "Absent days",
      "Attendance %",
    ],
    report.members.map((m) => [
      m.name,
      m.jobTitle,
      m.created,
      m.completed,
      m.onTimeRate,
      m.overdueOpen,
      m.avgCycleHours,
      m.present,
      m.partial,
      m.absent,
      m.attendanceRate,
    ])
  );
}

export function exportDailyCsv(report: Report) {
  downloadCsv(
    `${slug(report.scope.name)}-daily-${report.range.from}-to-${report.range.to}.csv`,
    ["Date", "Weekend", "Tasks created", "Tasks completed", "Present", "Partial", "Absent"],
    report.trend.map((d) => [d.date, d.weekend ? "yes" : "no", d.created, d.completed, d.present, d.partial, d.absent])
  );
}
