import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Download, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { useProjects } from "@/contexts/ProjectContext";
import { PageHeader, Section } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, PersonAvatar } from "@/components/projects/shared";
import { AttendanceChart, StatTile, ThroughputChart } from "@/components/reports/ReportCharts";
import { errorMessage } from "@/lib/api";
import {
  RANGE_PRESETS,
  exportDailyCsv,
  exportMembersCsv,
  fetchReport,
  formatDay,
  formatHours,
  formatPct,
  presetRange,
} from "@/lib/reports";
import type { RangePreset, Report, ReportMember, ReportScopeType } from "@/lib/reports";
import { cn } from "@/lib/utils";

type ScopeOption = { value: string; label: string; group: "Workspace" | "Projects" | "Teams" | "You" };

/** Scope values are "type" or "type:id" so they fit in one Select/URL param. */
const parseScope = (v: string): { scope: ReportScopeType; id?: string } => {
  const [scope, id] = v.split(":") as [ReportScopeType, string | undefined];
  return id ? { scope, id } : { scope };
};

const Reports = () => {
  const { user } = useAuth();
  const { activeWorkspace, isLoading: orgsLoading } = useOrg();
  const { projects, teams } = useProjects();
  const [params, setParams] = useSearchParams();
  const isAdmin = user?.role === "admin";

  // Admins can report on everything in the workspace; leads on what they lead;
  // everyone with a seat on themselves.
  const options = useMemo<ScopeOption[]>(() => {
    const out: ScopeOption[] = [];
    if (isAdmin && activeWorkspace) {
      out.push({ value: `workspace:${activeWorkspace.id}`, label: activeWorkspace.name, group: "Workspace" });
    }
    if (!isAdmin) out.push({ value: "me", label: "My productivity", group: "You" });
    for (const p of projects) {
      if (p.myRole === "admin" || p.myRole === "lead")
        out.push({ value: `project:${p.id}`, label: p.name, group: "Projects" });
    }
    for (const t of teams) {
      if (t.myRole === "admin" || t.myRole === "lead")
        out.push({ value: `team:${t.id}`, label: t.name, group: "Teams" });
    }
    return out;
  }, [isAdmin, activeWorkspace, projects, teams]);

  const requested = params.get("scope");
  const scopeValue = requested && options.some((o) => o.value === requested) ? requested : options[0]?.value;
  const preset = (params.get("range") as RangePreset | "custom" | null) ?? "30d";
  const range =
    preset === "custom" && params.get("from") && params.get("to")
      ? { from: params.get("from")!, to: params.get("to")! }
      : presetRange(preset === "custom" ? "30d" : preset);
  const excludeWeekends = params.get("weekends") !== "include";

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };

  const [report, setReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scopeValue) return;
    let cancelled = false;
    setIsLoading(true);
    fetchReport({ ...parseScope(scopeValue), ...range, excludeWeekends })
      .then((r) => {
        if (cancelled) return;
        setReport(r);
        setError(null);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
    // range is derived from these primitives each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeValue, range.from, range.to, excludeWeekends]);

  const waitingForScopes = isAdmin && orgsLoading;

  return (
    <>
      <PageHeader
        title="Reports"
        description={`How work and attendance are going${report ? ` for ${report.scope.name}` : ""}, over the period you choose.`}
        actions={
          report && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportMembersCsv(report)}>People summary</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportDailyCsv(report)}>Daily breakdown</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
      />

      {/* Filters: one row, date range first, scoping everything below. */}
      <div className="mb-8 flex flex-wrap items-end gap-3 rounded-xl border border-border/80 bg-card p-4">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Period</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            value={preset}
            onValueChange={(v) => v && update({ range: v, from: null, to: null })}
            className="flex-wrap"
          >
            {RANGE_PRESETS.map((p) => (
              <ToggleGroupItem key={p.value} value={p.value} className="px-3 text-xs">
                {p.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="report-from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input
              id="report-from"
              type="date"
              value={range.from}
              max={range.to}
              onChange={(e) => e.target.value && update({ range: "custom", from: e.target.value, to: range.to })}
              className="w-38"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="report-to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input
              id="report-to"
              type="date"
              value={range.to}
              min={range.from}
              onChange={(e) => e.target.value && update({ range: "custom", from: range.from, to: e.target.value })}
              className="w-38"
            />
          </div>
        </div>
        <div className="space-y-1 min-w-48 flex-1 sm:flex-none">
          <Label className="text-xs text-muted-foreground">Report on</Label>
          <Select value={scopeValue ?? ""} onValueChange={(v) => update({ scope: v })} disabled={!options.length}>
            <SelectTrigger className="w-full sm:w-60">
              <SelectValue placeholder="Nothing to report on" />
            </SelectTrigger>
            <SelectContent>
              {(["Workspace", "You", "Projects", "Teams"] as const).map((group) => {
                const items = options.filter((o) => o.group === group);
                if (!items.length) return null;
                return (
                  <SelectGroup key={group}>
                    <SelectLabel>{group}</SelectLabel>
                    {items.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground h-9 sm:ml-auto">
          <Switch
            checked={excludeWeekends}
            onCheckedChange={(c) => update({ weekends: c ? null : "include" })}
            aria-label="Exclude weekends from attendance"
          />
          Skip weekends in attendance
        </label>
      </div>

      {waitingForScopes || (isLoading && !report) ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !scopeValue ? (
        <EmptyState
          title="Nothing to report on yet"
          body={
            isAdmin
              ? "Pick or create a workspace on the Members page to see its reports."
              : "Reports cover your own work, plus any project or team you lead."
          }
        />
      ) : error && !report ? (
        <EmptyState title="This report couldn't be loaded" body={error} />
      ) : report ? (
        // Refetch keeps the frame: previous numbers stay, dimmed, while loading.
        <div
          className={cn("space-y-6 transition-opacity duration-200", isLoading && "opacity-50")}
          aria-busy={isLoading}
        >
          <p className="text-sm text-muted-foreground">
            {formatDay(report.range.from, true)} to {formatDay(report.range.to, true)}, {report.range.days} days,{" "}
            {report.summary.people} {report.summary.people === 1 ? "person" : "people"}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatTile
              label="Tasks completed"
              value={report.summary.tasksCompleted.toLocaleString()}
              hint={`${report.summary.tasksCreated} created`}
            />
            <StatTile
              label="Completion rate"
              value={formatPct(report.summary.completionRate)}
              hint="of tasks created"
            />
            <StatTile label="On-time rate" value={formatPct(report.summary.onTimeRate)} hint="done by the due date" />
            <StatTile
              label="Overdue now"
              value={report.summary.overdueOpen}
              hint="open past due date"
              {...(report.summary.overdueOpen > 0 && { tone: "warn" as const })}
            />
            <StatTile
              label="Avg. cycle time"
              value={formatHours(report.summary.avgCycleHours)}
              hint="created → completed"
            />
            <StatTile
              label="Attendance"
              value={formatPct(report.summary.attendanceRate)}
              hint={`${report.summary.presentDays} present, ${report.summary.partialDays} partial`}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <ThroughputChart days={report.trend} />
            <AttendanceChart days={report.trend} excludeWeekends={report.range.excludeWeekends} />
          </div>

          <MembersTable members={report.members} />
        </div>
      ) : null}
    </>
  );
};

// ─── per-person table ───────────────────────────────────────────────────────

type SortKey = "name" | "completed" | "onTimeRate" | "overdueOpen" | "avgCycleHours" | "attendanceRate";

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "name", label: "Person", align: "left" },
  { key: "completed", label: "Completed", align: "right" },
  { key: "onTimeRate", label: "On time", align: "right" },
  { key: "overdueOpen", label: "Overdue", align: "right" },
  { key: "avgCycleHours", label: "Avg. cycle", align: "right" },
  { key: "attendanceRate", label: "Attendance", align: "right" },
];

const MembersTable = ({ members }: { members: ReportMember[] }) => {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "completed", dir: "desc" });

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...members].sort((a, b) => {
      if (sort.key === "name") return a.name.localeCompare(b.name) * dir;
      // Empty values (no data) always sink to the bottom.
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return (av - bv) * dir || a.name.localeCompare(b.name);
    });
  }, [members, sort]);

  const toggle = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" ? "asc" : "desc" },
    );

  if (members.length === 0) {
    return <EmptyState title="No one in this scope" body="Add people to see their numbers here." />;
  }

  return (
    <Section title="People">
      <div className="overflow-x-auto rounded-xl border border-border/80 bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border/70 bg-surface text-xs text-muted-foreground">
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "whitespace-nowrap px-4 py-2.5 font-medium",
                    c.align === "right" ? "text-right" : "text-left",
                  )}
                  aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                >
                  <button
                    onClick={() => toggle(c.key)}
                    className={cn(
                      "inline-flex items-center gap-1 hover:text-foreground",
                      sort.key === c.key && "text-foreground",
                    )}
                  >
                    {c.label}
                    {sort.key === c.key &&
                      (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70 tabular-nums">
            {sorted.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 min-w-44">
                    <PersonAvatar person={m} />
                    <div className="min-w-0">
                      <div className="truncate">{m.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{m.jobTitle}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  {m.completed}
                  <span className="text-muted-foreground text-xs"> / {m.created}</span>
                </td>
                <td className="px-4 py-3 text-right">{formatPct(m.onTimeRate)}</td>
                <td className={cn("px-4 py-3 text-right", m.overdueOpen > 0 && "text-destructive")}>{m.overdueOpen}</td>
                <td className="px-4 py-3 text-right">{formatHours(m.avgCycleHours)}</td>
                <td className="px-4 py-3">
                  <AttendanceCell member={m} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Completed shows tasks finished in the period over tasks created in it. Attendance counts a partial day as half.
      </p>
    </Section>
  );
};

/** Rate plus a thin present/partial/absent strip so the split is visible at a glance. */
const AttendanceCell = ({ member: m }: { member: ReportMember }) => {
  const total = m.present + m.partial + m.absent;
  return (
    <div className="flex items-center justify-end gap-3">
      {total > 0 && (
        <div
          className="hidden sm:flex h-1.5 w-20 gap-px bg-background"
          title={`${m.present} present · ${m.partial} partial · ${m.absent} absent`}
        >
          {m.present > 0 && <span style={{ flex: m.present, backgroundColor: "var(--viz-present)" }} />}
          {m.partial > 0 && <span style={{ flex: m.partial, backgroundColor: "var(--viz-partial)" }} />}
          {m.absent > 0 && <span style={{ flex: m.absent, backgroundColor: "var(--viz-absent)" }} />}
        </div>
      )}
      <span className="w-10 text-right">{formatPct(m.attendanceRate)}</span>
    </div>
  );
};

export default Reports;
