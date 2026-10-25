import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format, getDay, getDaysInMonth, startOfMonth } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import { PageHeader, Section } from "@/components/layout/Page";
import { EmptyState, ProgressMeter } from "@/components/projects/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const API_BASE_URL = import.meta.env.VITE_API_URL;
const getAuthToken = () => localStorage.getItem("authToken");

type AttendanceStatus = "present" | "absent" | "partial";

interface AttendanceRecord {
    id: string;
    date: string;
    status: AttendanceStatus;
    taskSubmittedAt: string | null;
    allTasksCompletedAt: string | null;
}

interface AttendanceSummary {
    present: number;
    absent: number;
    partial: number;
    total: number;
    attendancePercentage?: number;
}

interface AttendanceResponse {
    attendance: AttendanceRecord[];
    summary: AttendanceSummary;
    // present in the admin single-member report response
    member?: { id: string; name: string; email: string };
}

const STATUS: Record<AttendanceStatus, { label: string; cell: string; dot: string; text: string }> = {
    present: { label: "Present", cell: "bg-secondary text-primary", dot: "bg-[var(--viz-present)]", text: "text-primary" },
    partial: { label: "Partial", cell: "bg-olive-soft text-olive", dot: "bg-[var(--viz-partial)]", text: "text-olive" },
    absent: { label: "Absent", cell: "bg-destructive/8 text-destructive", dot: "bg-destructive/70", text: "text-destructive" },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Monthly attendance. Two modes:
 *  - "/attendance" — the signed-in member's own record (/attendance/me)
 *  - "/dashboard/member/:memberId/attendance" — an admin viewing one member
 */
export const MemberDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { memberId } = useParams<{ memberId?: string }>();
    const isAdminView = !!memberId && user?.role === "admin";

    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [data, setData] = useState<AttendanceResponse | null>(null);
    const [loading, setLoading] = useState(false);

    const fetchAttendance = useCallback(async () => {
        const token = getAuthToken();
        if (!token) return;
        setLoading(true);
        try {
            const endpoint = isAdminView
                ? `${API_BASE_URL}/attendance/report/${memberId}?month=${month}&year=${year}`
                : `${API_BASE_URL}/attendance/me?month=${month}&year=${year}`;
            const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) {
                const err = await res.json();
                toast.error(err.message ?? "Attendance couldn't be loaded");
                return;
            }
            setData(await res.json());
        } catch {
            toast.error("Attendance couldn't be loaded");
        } finally {
            setLoading(false);
        }
    }, [month, year, isAdminView, memberId]);

    useEffect(() => {
        if (!user) return;
        // A member opening someone else's attendance link is sent to their own.
        if (memberId && user.role !== "admin") {
            navigate("/attendance", { replace: true });
            return;
        }
        fetchAttendance();
    }, [user, navigate, fetchAttendance, memberId]);

    if (!user) return null;

    const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
    const shift = (delta: number) => {
        const d = new Date(year, month - 1 + delta, 1);
        setMonth(d.getMonth() + 1);
        setYear(d.getFullYear());
    };

    const records = new Map((data?.attendance ?? []).map((r) => [r.date.slice(0, 10), r]));
    const firstWeekday = getDay(startOfMonth(new Date(year, month - 1)));
    const cells: (number | null)[] = [
        ...Array.from({ length: firstWeekday }, () => null),
        ...Array.from({ length: getDaysInMonth(new Date(year, month - 1)) }, (_, i) => i + 1),
    ];

    const summary = data?.summary;
    const rate =
        summary && summary.total > 0
            ? summary.attendancePercentage ?? Math.round((summary.present / summary.total) * 100)
            : 0;
    const monthLabel = format(new Date(year, month - 1), "MMMM yyyy");
    const name = isAdminView ? data?.member?.name ?? "this member" : user.name;

    return (
        <>
            <PageHeader
                {...(isAdminView && { back: { to: `/member/${memberId}`, label: data?.member?.name ?? "Member" } })}
                title={isAdminView ? `${name}'s attendance` : "Attendance"}
                description="Worked out from tasks: finish everything you planned for the day and it counts as present; finish some and it's partial."
                actions={
                    <div className="flex items-center gap-1 rounded-full bg-card p-1 ring-1 ring-border/80">
                        <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => shift(-1)} aria-label="Previous month">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="min-w-32 text-center text-sm font-medium">{monthLabel}</span>
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
                }
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
                <section className="rounded-xl border border-border/80 bg-card p-5 sm:p-6">
                    <div className="mb-3 grid grid-cols-7 gap-1.5">
                        {WEEKDAYS.map((d) => (
                            <div key={d} className="py-1 text-center text-xs text-muted-foreground">
                                {d}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                        {loading
                            ? Array.from({ length: 35 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)
                            : cells.map((day, i) => {
                                  if (!day) return <div key={`blank-${i}`} className="aspect-square" />;
                                  const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                                  const record = records.get(key);
                                  const isToday = isCurrentMonth && day === now.getDate();
                                  const isFuture = isCurrentMonth && day > now.getDate();
                                  return (
                                      <div
                                          key={key}
                                          title={record ? `${format(new Date(year, month - 1, day), "d MMM")}: ${STATUS[record.status].label}` : undefined}
                                          className={cn(
                                              "relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm tabular-nums",
                                              isFuture
                                                  ? "text-muted-foreground/40"
                                                  : record
                                                    ? STATUS[record.status].cell
                                                    : "bg-surface text-muted-foreground",
                                              isToday && "ring-2 ring-primary ring-offset-2 ring-offset-card"
                                          )}
                                      >
                                          {day}
                                          {record && <span className={cn("absolute bottom-1.5 h-1 w-1 rounded-full", STATUS[record.status].dot)} />}
                                      </div>
                                  );
                              })}
                    </div>
                    <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-border/70 pt-4 text-xs text-muted-foreground">
                        {(Object.keys(STATUS) as AttendanceStatus[]).map((s) => (
                            <span key={s} className="flex items-center gap-1.5">
                                <span className={cn("h-2 w-2 rounded-full", STATUS[s].dot)} />
                                {STATUS[s].label}
                            </span>
                        ))}
                        <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-border" />
                            No record
                        </span>
                    </div>
                </section>

                <aside className="space-y-4">
                    <div className="rounded-xl border border-border/80 bg-card p-5">
                        <p className="text-sm text-muted-foreground">Attendance rate</p>
                        <p className="mt-1 text-[40px] font-semibold leading-none tracking-tight">{loading ? "–" : `${rate}%`}</p>
                        <ProgressMeter value={rate} className="mt-4" />
                        <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
                            {(["present", "partial", "absent"] as AttendanceStatus[]).map((s) => (
                                <div key={s} className="rounded-lg bg-surface py-2.5">
                                    <dd className={cn("text-lg font-semibold tabular-nums", STATUS[s].text)}>{summary?.[s] ?? 0}</dd>
                                    <dt className="text-xs text-muted-foreground">{STATUS[s].label}</dt>
                                </div>
                            ))}
                        </dl>
                        <p className="mt-3 text-xs text-muted-foreground">
                            Out of {summary?.total ?? 0} recorded {summary?.total === 1 ? "day" : "days"} in {format(new Date(year, month - 1), "MMMM")}.
                        </p>
                    </div>
                    {!isCurrentMonth && (
                        <Button
                            variant="ghost"
                            className="w-full"
                            onClick={() => {
                                setMonth(now.getMonth() + 1);
                                setYear(now.getFullYear());
                            }}
                        >
                            Back to this month
                        </Button>
                    )}
                </aside>
            </div>

            <Section title="Day by day" className="mt-10">
                {!loading && data && data.attendance.length === 0 ? (
                    <EmptyState
                        icon={CalendarDays}
                        title={`No records for ${monthLabel}`}
                        body="Days appear here once tasks are submitted, or after the end-of-day check runs."
                    />
                ) : (
                    <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/80 bg-card">
                        {[...(data?.attendance ?? [])]
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map((r) => (
                                <li key={r.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                                    <div>
                                        <p className="text-sm font-medium">{format(new Date(r.date), "EEEE, d MMMM")}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {r.taskSubmittedAt ? `Tasks in at ${format(new Date(r.taskSubmittedAt), "h:mm a")}` : "No tasks submitted"}
                                            {r.allTasksCompletedAt && `, all done at ${format(new Date(r.allTasksCompletedAt), "h:mm a")}`}
                                        </p>
                                    </div>
                                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", STATUS[r.status].cell)}>
                                        <span className={cn("h-1.5 w-1.5 rounded-full", STATUS[r.status].dot)} />
                                        {STATUS[r.status].label}
                                    </span>
                                </li>
                            ))}
                    </ul>
                )}
            </Section>
        </>
    );
};

export default MemberDashboard;
