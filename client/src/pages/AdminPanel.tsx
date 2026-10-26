import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { format, getDay, getDaysInMonth, startOfMonth } from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight, Clock, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { toast } from "@/components/ui/sonner";
import { PageHeader } from "@/components/layout/Page";
import { EmptyState, PersonAvatar } from "@/components/projects/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const API_BASE_URL = import.meta.env.VITE_API_URL;
const getAuthToken = () => localStorage.getItem("authToken");

// ─── Types ───────────────────────────────────────────────────────────────────

type AttendanceStatus = "present" | "absent" | "partial";

interface MemberInfo {
  id: string;
  name: string;
  email: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: AttendanceStatus;
  taskSubmittedAt: string | null;
  allTasksCompletedAt: string | null;
}

interface MemberReport {
  member: MemberInfo;
  summary: { present: number; absent: number; partial: number; total: number; attendancePercentage: number };
  attendance: AttendanceRecord[];
}

interface TodayOverviewEntry {
  member: MemberInfo;
  status: AttendanceStatus;
  taskSubmittedAt: string | null;
  allTasksCompletedAt: string | null;
}

interface TodayOverviewResponse {
  date: string;
  overview: TodayOverviewEntry[];
}

interface AllMembersReportResponse {
  report: MemberReport[];
  generatedAt: string;
}

const STATUS: Record<AttendanceStatus, { label: string; pill: string; dot: string; cell: string }> = {
  present: {
    label: "Present",
    pill: "bg-sage-soft text-sage",
    dot: "bg-[var(--viz-present)]",
    cell: "bg-sage-soft text-sage",
  },
  partial: {
    label: "Partial",
    pill: "bg-honey-soft text-honey",
    dot: "bg-[var(--viz-partial)]",
    cell: "bg-honey-soft text-honey",
  },
  absent: {
    label: "Absent",
    pill: "bg-destructive/8 text-destructive",
    dot: "bg-destructive/70",
    cell: "bg-destructive/8 text-destructive",
  },
};

const ORDER: AttendanceStatus[] = ["present", "partial", "absent"];

/** The admin's view of everyone's attendance: today, and month by month. */
export const AdminAttendancePanel = () => {
  const { user } = useAuth();
  const { activeWorkspace } = useOrg();
  const navigate = useNavigate();

  const now = new Date();
  const [tab, setTab] = useState<"today" | "month">("today");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [today, setToday] = useState<TodayOverviewResponse | null>(null);
  const [report, setReport] = useState<AllMembersReportResponse | null>(null);
  const [todayLoading, setTodayLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  const fetchJson = async <T,>(path: string): Promise<T | null> => {
    const token = getAuthToken();
    if (!token) return null;
    const res = await fetch(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.message ?? "Attendance couldn't be loaded");
      return null;
    }
    return res.json();
  };

  const loadToday = useCallback(async () => {
    setTodayLoading(true);
    try {
      const data = await fetchJson<TodayOverviewResponse>("/attendance/today");
      if (data) setToday(data);
    } finally {
      setTodayLoading(false);
    }
  }, []);

  const loadReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const data = await fetchJson<AllMembersReportResponse>(`/attendance/report?month=${month}&year=${year}`);
      if (data) setReport(data);
    } finally {
      setReportLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "admin") {
      navigate("/attendance", { replace: true });
      return;
    }
    loadToday();
  }, [user, navigate, loadToday]);

  useEffect(() => {
    if (tab === "month") loadReport();
  }, [tab, loadReport]);

  if (!user) return null;

  const counts = today
    ? Object.fromEntries(ORDER.map((s) => [s, today.overview.filter((e) => e.status === s).length]))
    : null;
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
  const shift = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setMonth(d.getMonth() + 1);
    setYear(d.getFullYear());
  };
  const taskWindow = activeWorkspace?.taskWindow;
  const openMember = (id: string) => navigate(`/dashboard/member/${id}/attendance`);

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Nobody clocks in: a day counts as present when someone finishes everything they planned, partial when they finish some of it."
        actions={
          taskWindow && (
            <span className="inline-flex h-9 items-center gap-2 rounded-full bg-card px-3.5 text-sm text-muted-foreground ring-1 ring-border/80">
              <Clock className="h-3.5 w-3.5" />
              {taskWindow.enabled
                ? `Tasks accepted ${taskWindow.startTime}–${taskWindow.endTime} IST`
                : "Tasks accepted anytime"}
            </span>
          )
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "today" | "month")}>
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="month">By month</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-6 space-y-6">
          {todayLoading && !today ? (
            <div className="space-y-3">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
          ) : today && counts ? (
            <>
              <section className="rounded-xl border border-border/80 bg-card p-5 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(`${today.date}T00:00:00`), "EEEE, d MMMM")}
                    </p>
                    <p className="mt-1 text-[32px] font-semibold leading-none tracking-tight">
                      {counts.present} of {today.overview.length}{" "}
                      <span className="text-lg font-medium text-muted-foreground">present so far</span>
                    </p>
                  </div>
                  <dl className="flex gap-6 text-sm">
                    {ORDER.map((s) => (
                      <div key={s} className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", STATUS[s].dot)} />
                        <dt className="text-muted-foreground">{STATUS[s].label}</dt>
                        <dd className="font-semibold tabular-nums">{counts[s]}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                {/* One bar, three parts: the day's split at a glance. */}
                {today.overview.length > 0 && (
                  <div className="mt-5 flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-muted">
                    {ORDER.map((s) =>
                      counts[s]! > 0 ? (
                        <motion.span
                          key={s}
                          className={STATUS[s].dot}
                          initial={{ flexGrow: 0 }}
                          animate={{ flexGrow: counts[s] }}
                          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                          style={{ flexBasis: 0 }}
                        />
                      ) : null,
                    )}
                  </div>
                )}
              </section>

              {today.overview.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No one to show yet"
                  body="Add members on the Members page and their day will appear here."
                />
              ) : (
                <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/80 bg-card">
                  {today.overview.map((entry) => (
                    <li key={entry.member.id}>
                      <button
                        onClick={() => openMember(entry.member.id)}
                        className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none active:scale-100"
                      >
                        <PersonAvatar person={entry.member} className="h-9 w-9 text-xs" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-medium">{entry.member.name}</span>
                          <span className="block truncate text-sm text-muted-foreground">
                            {entry.taskSubmittedAt
                              ? `Tasks in at ${format(new Date(entry.taskSubmittedAt), "h:mm a")}`
                              : "No tasks yet today"}
                            {entry.allTasksCompletedAt &&
                              `, all done at ${format(new Date(entry.allTasksCompletedAt), "h:mm a")}`}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                            STATUS[entry.status].pill,
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", STATUS[entry.status].dot)} />
                          {STATUS[entry.status].label}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="month" className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-full bg-card p-1 ring-1 ring-border/80">
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                onClick={() => shift(-1)}
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-32 text-center text-sm font-medium">
                {format(new Date(year, month - 1), "MMMM yyyy")}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                onClick={() => shift(1)}
                disabled={isCurrentMonth}
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {report && (
              <span className="text-xs text-muted-foreground">
                Updated {format(new Date(report.generatedAt), "d MMM, h:mm a")}
              </span>
            )}
          </div>

          {reportLoading && !report ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : report ? (
            report.report.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No one to show yet"
                body="Add members on the Members page to see their month."
              />
            ) : (
              <div className={cn("space-y-6 transition-opacity", reportLoading && "opacity-50")}>
                <TeamSummary report={report.report} />
                <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/80 bg-card">
                  {report.report.map((r) => (
                    <MemberMonthRow
                      key={r.member.id}
                      report={r}
                      month={month}
                      year={year}
                      onOpen={() => openMember(r.member.id)}
                    />
                  ))}
                </ul>
              </div>
            )
          ) : null}
        </TabsContent>
      </Tabs>
    </>
  );
};

// ─── Sub-components ─────────────────────────────────────────────────────────

const TeamSummary = ({ report }: { report: MemberReport[] }) => {
  const totals = report.reduce(
    (acc, r) => ({
      present: acc.present + r.summary.present,
      partial: acc.partial + r.summary.partial,
      absent: acc.absent + r.summary.absent,
      total: acc.total + r.summary.total,
    }),
    { present: 0, partial: 0, absent: 0, total: 0 },
  );
  const rate = totals.total > 0 ? Math.round((totals.present / totals.total) * 100) : 0;
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-xl bg-card px-4 py-3.5 ring-1 ring-border/70">
        <dd className="text-2xl font-semibold tracking-tight">{rate}%</dd>
        <dt className="text-xs text-muted-foreground">Team attendance</dt>
      </div>
      {ORDER.map((s) => (
        <div key={s} className="rounded-xl bg-card px-4 py-3.5 ring-1 ring-border/70">
          <dd className="text-2xl font-semibold tracking-tight tabular-nums">{totals[s]}</dd>
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("h-1.5 w-1.5 rounded-full", STATUS[s].dot)} />
            {STATUS[s].label} days
          </dt>
        </div>
      ))}
    </dl>
  );
};

/** A member's month: summary row that expands into a mini calendar. */
const MemberMonthRow = ({
  report,
  month,
  year,
  onOpen,
}: {
  report: MemberReport;
  month: number;
  year: number;
  onOpen: () => void;
}) => {
  const { member, summary, attendance } = report;
  const [expanded, setExpanded] = useState(false);
  const records = new Map(attendance.map((r) => [r.date.slice(0, 10), r]));
  const firstWeekday = getDay(startOfMonth(new Date(year, month - 1)));
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: getDaysInMonth(new Date(year, month - 1)) }, (_, i) => i + 1),
  ];
  const now = new Date();
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  return (
    <li>
      <div className="flex items-center gap-4 px-5 py-3.5">
        <button
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-4 text-left focus-visible:outline-2 focus-visible:outline-ring active:scale-100"
        >
          <PersonAvatar person={member} className="h-9 w-9 text-xs" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium">{member.name}</span>
            <span className="block truncate text-sm text-muted-foreground">
              {summary.present} present, {summary.partial} partial, {summary.absent} absent
            </span>
          </span>
          <span className="hidden w-24 overflow-hidden rounded-full bg-muted sm:block">
            <span
              className="block h-1.5 rounded-full bg-honey transition-[width] duration-500"
              style={{ width: `${summary.attendancePercentage}%` }}
            />
          </span>
          <span className="w-11 text-right text-sm font-semibold tabular-nums">{summary.attendancePercentage}%</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              expanded && "rotate-180",
            )}
          />
        </button>
        <Button variant="ghost" size="sm" onClick={onOpen}>
          Details
        </Button>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="bg-surface px-5 py-4">
              <div className="mx-auto grid max-w-md grid-cols-7 gap-1">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <div key={i} className="py-1 text-center text-[11px] text-muted-foreground">
                    {d}
                  </div>
                ))}
                {cells.map((day, i) => {
                  if (!day) return <div key={`b-${i}`} className="aspect-square" />;
                  const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const record = records.get(key);
                  const future = isCurrentMonth && day > now.getDate();
                  return (
                    <div
                      key={key}
                      title={record ? STATUS[record.status].label : undefined}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-md text-[11px] tabular-nums",
                        future
                          ? "text-muted-foreground/40"
                          : record
                            ? STATUS[record.status].cell
                            : "bg-card text-muted-foreground",
                      )}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
};

export default AdminAttendancePanel;
