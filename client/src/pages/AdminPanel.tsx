import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-provider";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    CheckCircle2,
    XCircle,
    Clock,
    Users,
    LogOut,
    ArrowLeft,
    ClipboardList,
    CalendarDays,
    TrendingUp,
    ChevronRight,
    Circle,
} from "lucide-react";
import { format, getDaysInMonth, startOfMonth, getDay } from "date-fns";

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

interface MemberSummary {
    present: number;
    absent: number;
    partial: number;
    total: number;
    attendancePercentage: number;
}

interface MemberReport {
    member: MemberInfo;
    summary: MemberSummary;
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
    submissionWindowOpen: boolean;
    completionDeadlinePassed: boolean;
    overview: TodayOverviewEntry[];
}

interface AllMembersReportResponse {
    report: MemberReport[];
    generatedAt: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

const STATUS_CONFIG: Record<
    AttendanceStatus,
    { label: string; textColor: string; bgColor: string; mutedBg: string; icon: React.ReactNode }
> = {
    present: {
        label: "Present",
        textColor: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-500",
        mutedBg: "bg-emerald-50 dark:bg-emerald-950/40",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    },
    absent: {
        label: "Absent",
        textColor: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-500",
        mutedBg: "bg-red-50 dark:bg-red-950/40",
        icon: <XCircle className="h-3.5 w-3.5" />,
    },
    partial: {
        label: "Partial",
        textColor: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-500",
        mutedBg: "bg-amber-50 dark:bg-amber-950/40",
        icon: <Clock className="h-3.5 w-3.5" />,
    },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const AdminAttendancePanel = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const now = new Date();
    const [activeTab, setActiveTab] = useState<"today" | "report">("today");
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());

    const [todayData, setTodayData] = useState<TodayOverviewResponse | null>(null);
    const [reportData, setReportData] = useState<AllMembersReportResponse | null>(null);
    const [todayLoading, setTodayLoading] = useState(false);
    const [reportLoading, setReportLoading] = useState(false);

    const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);

    const fetchToday = useCallback(async () => {
        const token = getAuthToken();
        if (!token) return;
        setTodayLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/attendance/today`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                const err = await res.json();
                toast.error(err.message ?? "Failed to fetch today's overview");
                return;
            }
            setTodayData(await res.json());
        } catch {
            toast.error("An error occurred while fetching today's data");
        } finally {
            setTodayLoading(false);
        }
    }, []);

    const fetchReport = useCallback(async () => {
        const token = getAuthToken();
        if (!token) return;
        setReportLoading(true);
        try {
            const res = await fetch(
                `${API_BASE_URL}/attendance/report?month=${selectedMonth}&year=${selectedYear}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) {
                const err = await res.json();
                toast.error(err.message ?? "Failed to fetch report");
                return;
            }
            setReportData(await res.json());
        } catch {
            toast.error("An error occurred while fetching report");
        } finally {
            setReportLoading(false);
        }
    }, [selectedMonth, selectedYear]);

    useEffect(() => {
        if (!user) { navigate("/"); return; }
        if (user.role !== "admin") { navigate("/dashboard"); return; }
        fetchToday();
    }, [user, navigate, fetchToday]);

    useEffect(() => {
        if (activeTab === "report") fetchReport();
    }, [activeTab, fetchReport]);

    const handleLogout = () => { logout(); navigate("/"); };

    // Today tab stats
    const todayStats = todayData
        ? {
            present: todayData.overview.filter((e) => e.status === "present").length,
            absent: todayData.overview.filter((e) => e.status === "absent").length,
            partial: todayData.overview.filter((e) => e.status === "partial").length,
            total: todayData.overview.length,
        }
        : null;

    if (!user) return null;

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-sm">
                <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => navigate("/dashboard")}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-md bg-foreground flex items-center justify-center">
                                <ClipboardList className="h-4 w-4 text-background" />
                            </div>
                            <div>
                                <span className="font-semibold text-sm tracking-tight">Attendance Panel</span>
                                <span className="hidden sm:inline text-xs text-muted-foreground ml-2">
                                    Admin · {user.name}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout}>
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
                {/* Page title */}
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Attendance Overview</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Monitor your team's daily task completion and attendance
                        </p>
                    </div>
                    <Badge variant="outline" className="hidden sm:flex items-center gap-1.5 text-xs">
                        <Users className="h-3 w-3" />
                        {todayData?.overview.length ?? "—"} members
                    </Badge>
                </div>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "today" | "report")}>
                    <TabsList className="h-9">
                        <TabsTrigger value="today" className="text-sm gap-1.5">
                            <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
                            Today
                        </TabsTrigger>
                        <TabsTrigger value="report" className="text-sm gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            Monthly Report
                        </TabsTrigger>
                    </TabsList>

                    {/* ── TODAY TAB ─────────────────────────────────────────────────── */}
                    <TabsContent value="today" className="mt-6 space-y-6">
                        {todayLoading ? (
                            <TodaySkeletons />
                        ) : todayData ? (
                            <>
                                {/* Window status banner */}
                                <WindowStatusBanner
                                    submissionWindowOpen={todayData.submissionWindowOpen}
                                    completionDeadlinePassed={todayData.completionDeadlinePassed}
                                    date={todayData.date}
                                />

                                {/* Today summary cards */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <TodaySummaryCard label="Total" value={todayStats!.total} icon={<Users className="h-4 w-4" />} color="default" />
                                    <TodaySummaryCard label="Present" value={todayStats!.present} icon={<CheckCircle2 className="h-4 w-4" />} color="emerald" />
                                    <TodaySummaryCard label="Partial" value={todayStats!.partial} icon={<Clock className="h-4 w-4" />} color="amber" />
                                    <TodaySummaryCard label="Absent" value={todayStats!.absent} icon={<XCircle className="h-4 w-4" />} color="red" />
                                </div>

                                {/* Member list */}
                                <Card className="border-border">
                                    <CardHeader className="px-5 pt-5 pb-3">
                                        <CardTitle className="text-sm font-medium">
                                            Team Status — {format(new Date(todayData.date + "T00:00:00"), "EEEE, MMMM d")}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="px-5 pb-5">
                                        {todayData.overview.length === 0 ? (
                                            <EmptyTeam />
                                        ) : (
                                            <div className="space-y-1.5">
                                                {todayData.overview.map((entry) => (
                                                    <TodayMemberRow
                                                        key={entry.member.id}
                                                        entry={entry}
                                                        onViewAttendance={() =>
                                                            navigate(`/dashboard/member/${entry.member.id}/attendance`)
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </>
                        ) : null}
                    </TabsContent>

                    {/* ── REPORT TAB ────────────────────────────────────────────────── */}
                    <TabsContent value="report" className="mt-6 space-y-6">
                        {/* Month / Year selector */}
                        <div className="flex items-center gap-3">
                            <Select
                                value={String(selectedMonth)}
                                onValueChange={(v) => setSelectedMonth(Number(v))}
                            >
                                <SelectTrigger className="h-8 w-36 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {MONTHS.map((m, i) => (
                                        <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select
                                value={String(selectedYear)}
                                onValueChange={(v) => setSelectedYear(Number(v))}
                            >
                                <SelectTrigger className="h-8 w-24 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {years.map((y) => (
                                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {reportData && (
                                <span className="text-xs text-muted-foreground ml-auto">
                                    Generated {format(new Date(reportData.generatedAt), "MMM d, hh:mm a")}
                                </span>
                            )}
                        </div>

                        {reportLoading ? (
                            <ReportSkeletons />
                        ) : reportData ? (
                            <>
                                {/* Team aggregate summary */}
                                <TeamAggregateSummary report={reportData.report} />

                                {/* Per-member cards */}
                                <div className="space-y-3">
                                    {reportData.report.length === 0 ? (
                                        <EmptyTeam />
                                    ) : (
                                        reportData.report.map((memberReport) => (
                                            <MemberReportCard
                                                key={memberReport.member.id}
                                                report={memberReport}
                                                month={selectedMonth}
                                                year={selectedYear}
                                                onViewDetail={() =>
                                                    navigate(`/dashboard/member/${memberReport.member.id}/attendance`)
                                                }
                                            />
                                        ))
                                    )}
                                </div>
                            </>
                        ) : null}
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const WindowStatusBanner = ({
    submissionWindowOpen,
    completionDeadlinePassed,
    date,
}: {
    submissionWindowOpen: boolean;
    completionDeadlinePassed: boolean;
    date: string;
}) => {
    let message = "Submission window is closed (opens 9:00 AM – 11:00 AM IST)";
    let style = "bg-muted/60 border-border text-muted-foreground";

    if (submissionWindowOpen) {
        message = "Submission window is open — members can submit tasks until 11:00 AM IST";
        style = "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300";
    } else if (completionDeadlinePassed) {
        message = "Completion deadline passed — attendance has been finalized for today";
        style = "bg-muted/60 border-border text-muted-foreground";
    }

    return (
        <div className={`rounded-lg border px-4 py-3 text-sm flex items-center justify-between ${style}`}>
            <span>{message}</span>
            <span className="text-xs opacity-70 shrink-0 ml-4">
                {format(new Date(date + "T00:00:00"), "MMM d, yyyy")}
            </span>
        </div>
    );
};

const TodaySummaryCard = ({
    label,
    value,
    icon,
    color,
}: {
    label: string;
    value: number;
    icon: React.ReactNode;
    color: "default" | "emerald" | "red" | "amber";
}) => {
    const colorMap = {
        default: "text-foreground",
        emerald: "text-emerald-600 dark:text-emerald-400",
        red: "text-red-600 dark:text-red-400",
        amber: "text-amber-600 dark:text-amber-400",
    };

    return (
        <Card className="border-border">
            <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {label}
                    </span>
                    <span className={colorMap[color]}>{icon}</span>
                </div>
                <p className="text-3xl font-bold tabular-nums">{value}</p>
            </CardContent>
        </Card>
    );
};

const TodayMemberRow = ({
    entry,
    onViewAttendance,
}: {
    entry: TodayOverviewEntry;
    onViewAttendance: () => void;
}) => {
    const config = STATUS_CONFIG[entry.status];

    return (
        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
            <div className="flex items-center gap-3 min-w-0">
                <div className={`h-2 w-2 rounded-full shrink-0 ${config.bgColor}`} />
                <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{entry.member.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                        {entry.taskSubmittedAt
                            ? `Submitted ${format(new Date(entry.taskSubmittedAt), "hh:mm a")}`
                            : entry.status === "absent"
                                ? "No tasks submitted"
                                : "—"}
                        {entry.allTasksCompletedAt &&
                            ` · Done ${format(new Date(entry.allTasksCompletedAt), "hh:mm a")}`}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <Badge
                    variant="secondary"
                    className={`text-xs hidden sm:flex ${config.textColor}`}
                >
                    {config.label}
                </Badge>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={onViewAttendance}
                >
                    <ChevronRight className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
};

const TeamAggregateSummary = ({ report }: { report: MemberReport[] }) => {
    if (report.length === 0) return null;

    const totals = report.reduce(
        (acc, r) => ({
            present: acc.present + r.summary.present,
            absent: acc.absent + r.summary.absent,
            partial: acc.partial + r.summary.partial,
            total: acc.total + r.summary.total,
        }),
        { present: 0, absent: 0, partial: 0, total: 0 }
    );

    const avgRate =
        totals.total > 0 ? Math.round((totals.present / totals.total) * 100) : 0;

    return (
        <Card className="border-border">
            <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        Team Aggregate
                    </p>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                    <div>
                        <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                            {avgRate}%
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">Avg attendance rate</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold tabular-nums">{totals.present}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Total present days</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold tabular-nums">{totals.partial}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Total partial days</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold tabular-nums">{totals.absent}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Total absent days</p>
                    </div>
                </div>
                <div className="mt-4 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                        style={{ width: `${avgRate}%` }}
                    />
                </div>
            </CardContent>
        </Card>
    );
};

const MemberReportCard = ({
    report,
    month,
    year,
    onViewDetail,
}: {
    report: MemberReport;
    month: number;
    year: number;
    onViewDetail: () => void;
}) => {
    const { member, summary, attendance } = report;
    const [expanded, setExpanded] = useState(false);

    const attendanceMap = new Map(attendance.map((r) => [r.date.slice(0, 10), r]));
    const daysInMonth = getDaysInMonth(new Date(year, month - 1));
    const firstDayOfWeek = getDay(startOfMonth(new Date(year, month - 1)));
    const calendarCells: (number | null)[] = [
        ...Array.from({ length: firstDayOfWeek }, () => null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];

    const now = new Date();
    const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

    return (
        <Card className="border-border overflow-hidden">
            {/* Member row */}
            <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpanded((e) => !e)}
            >
                <div className="flex items-center gap-4 min-w-0">
                    {/* Avatar */}
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-semibold uppercase">
                        {member.name.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                    {/* Mini stat pills */}
                    <div className="hidden sm:flex items-center gap-2">
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            {summary.present}P
                        </span>
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                            {summary.partial}Pa
                        </span>
                        <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                            {summary.absent}A
                        </span>
                    </div>

                    {/* Rate bar */}
                    <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden hidden sm:block">
                            <div
                                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${summary.attendancePercentage}%` }}
                            />
                        </div>
                        <span className="text-sm font-semibold tabular-nums w-10 text-right">
                            {summary.attendancePercentage}%
                        </span>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                            e.stopPropagation();
                            onViewDetail();
                        }}
                    >
                        <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Expanded mini calendar */}
            {expanded && (
                <div className="border-t border-border px-5 py-4 bg-muted/20">
                    <div className="grid grid-cols-7 mb-1">
                        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                            <div key={i} className="text-center text-[10px] text-muted-foreground py-1">
                                {d}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-0.5">
                        {calendarCells.map((day, idx) => {
                            if (!day) return <div key={`e-${idx}`} className="aspect-square" />;

                            const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                            const record = attendanceMap.get(dateStr);
                            const isFuture = isCurrentMonth && day > now.getDate();

                            const base = "aspect-square flex items-center justify-center rounded text-[10px] font-medium select-none";

                            if (isFuture) {
                                return <div key={dateStr} className={`${base} text-muted-foreground/20`}>{day}</div>;
                            }

                            if (!record) {
                                return (
                                    <div key={dateStr} className={`${base} text-muted-foreground/50 bg-muted/30`}>
                                        {day}
                                    </div>
                                );
                            }

                            const cellStyle: Record<AttendanceStatus, string> = {
                                present: "bg-emerald-500 text-white",
                                absent: "bg-red-500 text-white",
                                partial: "bg-amber-500 text-white",
                            };

                            return (
                                <div
                                    key={dateStr}
                                    title={STATUS_CONFIG[record.status].label}
                                    className={`${base} ${cellStyle[record.status]}`}
                                >
                                    {day}
                                </div>
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
                        {(Object.entries(STATUS_CONFIG) as [AttendanceStatus, typeof STATUS_CONFIG[AttendanceStatus]][]).map(
                            ([status, config]) => (
                                <div key={status} className="flex items-center gap-1.5">
                                    <div className={`h-2 w-2 rounded-sm ${config.bgColor}`} />
                                    <span className="text-[10px] text-muted-foreground">{config.label}</span>
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}
        </Card>
    );
};

const EmptyTeam = () => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
        <Users className="h-8 w-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No members found</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
            Add members from the dashboard to see their attendance
        </p>
    </div>
);

const TodaySkeletons = () => (
    <div className="space-y-4">
        <Skeleton className="h-11 rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
    </div>
);

const ReportSkeletons = () => (
    <div className="space-y-3">
        <Skeleton className="h-24 rounded-xl" />
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
    </div>
);

export default AdminAttendancePanel;
