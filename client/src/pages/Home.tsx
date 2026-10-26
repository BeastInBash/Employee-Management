import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTasks } from "@/contexts/TaskContext";
import type { Task } from "@/contexts/TaskContext";
import { useLiveTasks } from "@/hooks/use-live-tasks";
import { useProjects } from "@/contexts/ProjectContext";
import { PageHeader } from "@/components/layout/Page";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { TaskWindowPill } from "@/components/tasks/TaskWindowPill";
import { ColorSwatch, ProgressMeter, RoleBadge } from "@/components/projects/shared";
import { StatCell, TaskLine, Tile, TileEmpty, TileLink } from "@/components/home/Tile";
import { TodayTile } from "@/components/home/TodayTile";
import { AttendanceCalendar, AttendanceLegend } from "@/components/home/AttendanceCalendar";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { attendanceSummary, weeklyAttendance } from "@/lib/home";
import { gridIn } from "@/lib/motion";
import { greeting } from "@/lib/projectMeta";
import { fetchReport, istDateKey, istToday, mondayOf, shiftDays } from "@/lib/reports";
import type { Report } from "@/lib/reports";
import { usePersistentState } from "@/hooks/use-persistent-state";

// The two charts sit at the bottom of the grid and bring in the chart library
// (about 390 KB), so they load on their own: today's list and the rest of the
// grid don't wait for them.
const ThroughputChart = lazy(() =>
  import("@/components/reports/ReportCharts").then((m) => ({ default: m.ThroughputChart })),
);
const WeeklyAttendance = lazy(() =>
  import("@/components/home/WeeklyAttendance").then((m) => ({ default: m.WeeklyAttendance })),
);
const weeklySkeleton = <div className="h-48 animate-pulse rounded-xl bg-muted" aria-hidden />;
const throughputSkeleton = <div className="h-full min-h-72 animate-pulse rounded-2xl bg-muted" aria-hidden />;

const WEEK_MS = 7 * 86_400_000;

/** The signed-in member's dashboard ("/home"): today, what's coming, and how attendance is going. */
const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addTask, updateTask, taskWindow, refreshTaskWindow } = useTasks();
  const { projects } = useProjects();

  // Stays current on its own: tasks an admin or lead assigns show up without a refresh.
  const { tasks, setTasks } = useLiveTasks(user?.id);
  // Cached per day, so the charts and calendar draw at once after a refresh.
  const [report, setReport] = usePersistentState<Report | null>(
    user ? `${user.id}:report:home:${istToday()}` : null,
    null,
  );
  const [reportFailed, setReportFailed] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [isFormOpen, setIsFormOpen] = useState(false);

  const today = istToday();
  const monday = mondayOf(today);

  useEffect(() => {
    if (user && user.role !== "member") navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;
    // Eight full weeks for the weekly chart; this month and the last 30 days fall inside it.
    fetchReport({ scope: "me", from: shiftDays(monday, -49), to: today, excludeWeekends: true })
      .then(setReport)
      .catch(() => setReportFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const view = useMemo(() => {
    const all = tasks ?? [];
    const now = Date.now();
    const open = all.filter((t) => t.status !== "completed");
    const byDue = (a: Task, b: Task) => a.dueDate.getTime() - b.dueDate.getTime();
    const overdue = open.filter((t) => t.dueDate.getTime() < now).sort(byDue);
    const soon = open.filter((t) => t.dueDate.getTime() >= now && t.dueDate.getTime() <= now + WEEK_MS).sort(byDue);
    return {
      // Attendance counts the tasks planned today, so "today" is by creation day.
      todays: all.filter((t) => istDateKey(t.createdAt) === today),
      overdue,
      // Overdue first: they need attention before anything merely due soon.
      upcoming: [...overdue, ...soon].slice(0, 5),
      projectTasks: open
        .filter((t) => t.project)
        .sort(byDue)
        .slice(0, 5),
      doneThisWeek: all.filter((t) => t.completedAt && istDateKey(t.completedAt) >= monday).length,
    };
  }, [tasks, today, monday]);

  const month = useMemo(
    () => (report ? report.trend.filter((d) => d.date.startsWith(today.slice(0, 7))) : []),
    [report, today],
  );
  const monthSummary = attendanceSummary(month);
  const weeks = useMemo(() => (report ? weeklyAttendance(report.trend, today) : []), [report, today]);
  const activeProjects = projects.filter((p) => p.status !== "completed" && p.status !== "archived").slice(0, 4);

  if (!user) return null;

  const closed = !!taskWindow?.enabled && !taskWindow.open;

  const openAdd = async () => {
    // Re-check first, so a window that closed while the page sat open
    // doesn't hand out a form that can only fail.
    const current = await refreshTaskWindow();
    if (current?.enabled && !current.open) {
      toast.error(`Task submissions are closed. They open ${current.label}.`);
      return;
    }
    setIsFormOpen(true);
  };

  const toggle = async (task: Task) => {
    setPending((p) => new Set(p).add(task.id));
    const updated = await updateTask(task.id, { status: task.status === "completed" ? "todo" : "completed" });
    if (updated) setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    setPending((p) => {
      const next = new Set(p);
      next.delete(task.id);
      return next;
    });
  };

  const left = view.todays.filter((t) => t.status !== "completed").length;
  const description =
    tasks === null
      ? "Loading your day…"
      : view.todays.length === 0
        ? "Nothing planned for today yet. Add what you'll get done."
        : left === 0
          ? "Today's list is done, so today counts as present."
          : `${left} ${left === 1 ? "task" : "tasks"} left today. Finish them all and today counts as present.`;

  const monthName = new Date(`${today}T00:00:00Z`).toLocaleDateString(undefined, { month: "long", timeZone: "UTC" });
  const boardHref = `/todos/${user.id}`;

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.name.split(" ")[0]}`}
        description={description}
        actions={
          <>
            {taskWindow && <TaskWindowPill taskWindow={taskWindow} />}
            <Button
              onClick={openAdd}
              disabled={closed}
              title={closed ? `Your admin limited task submissions to ${taskWindow?.label}` : undefined}
            >
              <Plus className="h-4 w-4" />
              Add task
            </Button>
          </>
        }
      />

      <motion.div
        initial="hidden"
        animate="show"
        variants={gridIn}
        className="grid grid-flow-dense gap-4 md:grid-cols-6 lg:grid-cols-12"
      >
        <TodayTile
          tasks={view.todays}
          loading={tasks === null}
          pending={pending}
          onToggle={toggle}
          onAdd={openAdd}
          addDisabled={closed}
          boardHref={boardHref}
          className="md:col-span-6 lg:col-span-5 lg:row-span-2"
        />

        <Tile
          title={`${monthName} attendance`}
          description="Weekdays, worked out from your tasks"
          action={<TileLink to="/attendance">Calendar</TileLink>}
          className="md:col-span-3 md:row-span-2 lg:col-span-4"
        >
          {reportFailed ? (
            <TileEmpty>Attendance couldn't be loaded. Refresh the page to try again.</TileEmpty>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-[34px] font-semibold leading-none tracking-tight tabular">
                  {report ? (monthSummary.rate === null ? "—" : `${monthSummary.rate}%`) : "…"}
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {monthSummary.recorded
                    ? `${monthSummary.present} present, ${monthSummary.partial} partial, ${monthSummary.absent} absent`
                    : "No days recorded yet this month"}
                </p>
              </div>
              <AttendanceCalendar days={month} today={today} />
              <div className="mt-4">
                <AttendanceLegend />
              </div>
            </>
          )}
        </Tile>

        <div className="md:col-span-3 lg:col-span-3 [&>*]:h-full">
          <StatCell
            label="Done this week"
            value={tasks === null ? "…" : view.doneThisWeek}
            hint={view.doneThisWeek === 1 ? "task finished since Monday" : "tasks finished since Monday"}
          />
        </div>
        <div className="md:col-span-3 lg:col-span-3 [&>*]:h-full">
          <StatCell
            label="Overdue"
            value={tasks === null ? "…" : view.overdue.length}
            hint={view.overdue.length ? "Past their due date and still open" : "Nothing past due"}
            {...(view.overdue.length > 0 && { tone: "warn" as const })}
          />
        </div>

        <Tile
          title="Coming up"
          description="Overdue first, then the next 7 days"
          action={<TileLink to={boardHref}>All tasks</TileLink>}
          className="md:col-span-6 lg:col-span-5"
        >
          {tasks !== null && view.upcoming.length === 0 ? (
            <TileEmpty>Nothing due in the next week.</TileEmpty>
          ) : (
            <ul className="-my-2.5 divide-y divide-border/70">
              {view.upcoming.map((t) => (
                <TaskLine key={t.id} task={t} overdue={t.dueDate.getTime() < Date.now()} />
              ))}
            </ul>
          )}
        </Tile>

        <Tile title="Project tasks" description="Open work on your projects" className="md:col-span-3 lg:col-span-4">
          {tasks !== null && view.projectTasks.length === 0 ? (
            <TileEmpty>No open project work right now.</TileEmpty>
          ) : (
            <ul className="-my-2.5 divide-y divide-border/70">
              {view.projectTasks.map((t) => (
                <TaskLine key={t.id} task={t} show="status" />
              ))}
            </ul>
          )}
        </Tile>

        <Tile
          title="Your projects"
          action={<TileLink to="/projects">All</TileLink>}
          className="md:col-span-3 lg:col-span-3"
        >
          {activeProjects.length === 0 ? (
            <TileEmpty>You're not on any active projects.</TileEmpty>
          ) : (
            <ul className="space-y-3.5">
              {activeProjects.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/projects/${p.id}`}
                    className="block rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="flex items-center gap-2">
                      <ColorSwatch color={p.color} className="h-2.5 w-2.5" />
                      <span className="min-w-0 flex-1 truncate text-sm hover:underline">{p.name}</span>
                      {p.myRole === "lead" && <RoleBadge role="lead" />}
                    </span>
                    <ProgressMeter value={p.stats.progress} className="mt-1.5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Tile>

        <Tile
          title="Attendance by week"
          description="Last 8 weeks, weekdays only"
          className="md:col-span-6 lg:col-span-5"
        >
          {reportFailed ? (
            <TileEmpty>Attendance couldn't be loaded. Refresh the page to try again.</TileEmpty>
          ) : report ? (
            <Suspense fallback={weeklySkeleton}>
              <WeeklyAttendance weeks={weeks} />
            </Suspense>
          ) : (
            weeklySkeleton
          )}
        </Tile>

        <motion.div
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
          className="min-w-0 md:col-span-6 lg:col-span-7"
        >
          {report ? (
            <Suspense fallback={throughputSkeleton}>
              <ThroughputChart days={report.trend.slice(-30)} className="h-full rounded-2xl" />
            </Suspense>
          ) : (
            throughputSkeleton
          )}
        </motion.div>
      </motion.div>

      <TaskFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        task={null}
        description={taskWindow?.enabled ? `Submissions for your workspace are open ${taskWindow.label}.` : undefined}
        onSubmit={async (values) => {
          const created = await addTask({ ...values, memberId: user.id });
          if (created) setTasks((prev) => [...prev, created]);
          return !!created;
        }}
      />
    </>
  );
};

export default Home;
