import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-provider";
import {
    CheckCircle2,
    XCircle,
    Clock,
    CalendarDays,
    TrendingUp,
    Users,
    LogOut,
    ChevronLeft,
    ChevronRight,
    ArrowLeft,
} from "lucide-react";
import { format, getDaysInMonth, startOfMonth, getDay } from "date-fns";

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
    // present in admin single-member report response
    member?: { id: string; name: string; email: string };
}

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

const STATUS_CONFIG: Record<
    AttendanceStatus,
    { label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
    present: {
        label: "Present",
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-500",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    },
    absent: {
        label: "Absent",
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-500",
        icon: <XCircle className="h-3.5 w-3.5" />,
    },
    partial: {
        label: "Partial",
        color: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-500",
        icon: <Clock className="h-3.5 w-3.5" />,
    },
};

// ─── Props ───────────────────────────────────────────────────────────────────
// Two ways to use this component:
//
// 1. Member viewing own attendance — no props needed, uses /attendance/me
//    <Route path="/attendance" element={<MemberDashboard />} />
//
// 2. Admin viewing a specific member — pass memberId via route param
//    <Route path="/dashboard/member/:memberId/attendance" element={<MemberDashboard />} />
//    The component reads memberId from useParams() automatically.

export const MemberDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { memberId } = useParams<{ memberId?: string }>();

    // If memberId param exists, we're in admin-viewing-member mode
    const isAdminView = !!memberId && user?.role === "admin";

    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [data, setData] = useState<AttendanceResponse | null>(null);
    const [loading, setLoading] = useState(false);

    const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);

    const fetchAttendance = useCallback(async () => {
        const token = getAuthToken();
        if (!token) return;

        setLoading(true);
        try {
            // Admin viewing a specific member → /attendance/report/:memberId
            // Member viewing own            → /attendance/me
            const endpoint = isAdminView
                ? `${API_BASE_URL}/attendance/report/${memberId}?month=${selectedMonth}&year=${selectedYear}`
                : `${API_BASE_URL}/attendance/me?month=${selectedMonth}&year=${selectedYear}`;

            const res = await fetch(endpoint, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                const err = await res.json();
                toast.error(err.message ?? "Failed to fetch attendance");
                return;
            }

            const json: AttendanceResponse = await res.json();
            setData(json);
        } catch {
            toast.error("An error occurred while fetching attendance");
        } finally {
            setLoading(false);
        }
    }, [selectedMonth, selectedYear, isAdminView, memberId]);

    useEffect(() => {
        if (!user) {
            navigate("/");
            return;
        }
        // Non-admin trying to access admin view → redirect
        if (memberId && user.role !== "admin") {
            navigate("/attendance");
            return;
        }
        fetchAttendance();
    }, [user, navigate, fetchAttendance, memberId]);

    const handlePrevMonth = () => {
        if (selectedMonth === 1) {
            setSelectedMonth(12);
            setSelectedYear((y) => y - 1);
        } else {
            setSelectedMonth((m) => m - 1);
        }
    };

    const handleNextMonth = () => {
        if (isCurrentMonth) return;
        if (selectedMonth === 12) {
            setSelectedMonth(1);
            setSelectedYear((y) => y + 1);
        } else {
            setSelectedMonth((m) => m + 1);
        }
    };

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    const handleBack = () => {
        if (isAdminView) {
            navigate(`/dashboard/member/${memberId}`);
        } else {
            navigate(-1);
        }
    };

    const attendanceMap = new Map(
        (data?.attendance ?? []).map((r) => [r.date.slice(0, 10), r])
    );

    const daysInMonth = getDaysInMonth(new Date(selectedYear, selectedMonth - 1));
    const firstDayOfWeek = getDay(startOfMonth(new Date(selectedYear, selectedMonth - 1)));
    const calendarCells: (number | null)[] = [
        ...Array.from({ length: firstDayOfWeek }, () => null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];

    const summary = data?.summary;
    const attendancePercent =
        summary && summary.total > 0
            ? summary.attendancePercentage ?? Math.round((summary.present / summary.total) * 100)
            : 0;

    const isCurrentMonth =
        selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear();

    // The name to display in the header
    const viewingName = isAdminView
        ? (data?.member?.name ?? "Member")
        : user?.name ?? "";

    if (!user) return null;

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-sm">
                <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={handleBack}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-md bg-foreground flex items-center justify-center">
                                <Users className="h-4 w-4 text-background" />
                            </div>
                            <span className="font-semibold text-sm tracking-tight">Crewly</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="hidden sm:block text-sm text-muted-foreground">
                            {user.name}
                        </span>
                        <ThemeToggle />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleLogout}
                            className="h-8 w-8"
                        >
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
                {/* Page title */}
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
                        {isAdminView && (
                            <Badge variant="secondary" className="text-xs font-normal">
                                Admin View
                            </Badge>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {isAdminView
                            ? `Viewing attendance record for ${viewingName}`
                            : "Your daily task completion record"}
                    </p>
                </div>

                {/* Month navigator */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={handlePrevMonth}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>

                        <div className="flex items-center gap-2">
                            <Select
                                value={String(selectedMonth)}
                                onValueChange={(v) => setSelectedMonth(Number(v))}
                            >
                                <SelectTrigger className="h-8 w-32 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {MONTHS.map((m, i) => (
                                        <SelectItem key={m} value={String(i + 1)}>
                                            {m}
                                        </SelectItem>
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
                                        <SelectItem key={y} value={String(y)}>
                                            {y}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={handleNextMonth}
                            disabled={isCurrentMonth}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    {!isCurrentMonth && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-8"
                            onClick={() => {
                                setSelectedMonth(now.getMonth() + 1);
                                setSelectedYear(now.getFullYear());
                            }}
                        >
                            Back to today
                        </Button>
                    )}
                </div>

                {/* Summary cards */}
                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-24 rounded-xl" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <SummaryCard
                            label="Present"
                            value={summary?.present ?? 0}
                            total={summary?.total ?? 0}
                            color="emerald"
                            icon={<CheckCircle2 className="h-4 w-4" />}
                        />
                        <SummaryCard
                            label="Absent"
                            value={summary?.absent ?? 0}
                            total={summary?.total ?? 0}
                            color="red"
                            icon={<XCircle className="h-4 w-4" />}
                        />
                        <SummaryCard
                            label="Partial"
                            value={summary?.partial ?? 0}
                            total={summary?.total ?? 0}
                            color="amber"
                            icon={<Clock className="h-4 w-4" />}
                        />
                        <Card className="border-border">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                        Rate
                                    </span>
                                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <p className="text-2xl font-bold tabular-nums">{attendancePercent}%</p>
                                <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-foreground transition-all duration-500"
                                        style={{ width: `${attendancePercent}%` }}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Calendar */}
                <Card className="border-border">
                    <CardHeader className="pb-3 px-5 pt-5">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-muted-foreground" />
                            <CardTitle className="text-sm font-medium">
                                {MONTHS[selectedMonth - 1]} {selectedYear}
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="px-5 pb-5">
                        <div className="grid grid-cols-7 mb-2">
                            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                                <div
                                    key={d}
                                    className="text-center text-xs font-medium text-muted-foreground py-1"
                                >
                                    {d}
                                </div>
                            ))}
                        </div>

                        {loading ? (
                            <div className="grid grid-cols-7 gap-1">
                                {Array.from({ length: 35 }).map((_, i) => (
                                    <Skeleton key={i} className="aspect-square rounded-lg" />
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-7 gap-1">
                                {calendarCells.map((day, idx) => {
                                    if (!day) {
                                        return <div key={`empty-${idx}`} className="aspect-square" />;
                                    }

                                    const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                                    const record = attendanceMap.get(dateStr);
                                    const isToday = isCurrentMonth && day === now.getDate();
                                    const isFuture = isCurrentMonth && day > now.getDate();

                                    return (
                                        <CalendarCell
                                            key={dateStr}
                                            day={day}
                                            record={record}
                                            isToday={isToday}
                                            isFuture={isFuture}
                                        />
                                    );
                                })}
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-border">
                            {(
                                Object.entries(STATUS_CONFIG) as [
                                    AttendanceStatus,
                                    (typeof STATUS_CONFIG)[AttendanceStatus]
                                ][]
                            ).map(([status, config]) => (
                                <div key={status} className="flex items-center gap-1.5">
                                    <div className={`h-2.5 w-2.5 rounded-sm ${config.bgColor}`} />
                                    <span className="text-xs text-muted-foreground">{config.label}</span>
                                </div>
                            ))}
                            <div className="flex items-center gap-1.5">
                                <div className="h-2.5 w-2.5 rounded-sm bg-muted border border-border" />
                                <span className="text-xs text-muted-foreground">No record</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Recent records */}
                {!loading && data && data.attendance.length > 0 && (
                    <Card className="border-border">
                        <CardHeader className="pb-3 px-5 pt-5">
                            <CardTitle className="text-sm font-medium">Recent Records</CardTitle>
                        </CardHeader>
                        <CardContent className="px-5 pb-5">
                            <div className="space-y-1">
                                {[...data.attendance]
                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                    .slice(0, 10)
                                    .map((record) => {
                                        const config = STATUS_CONFIG[record.status];
                                        return (
                                            <div
                                                key={record.id}
                                                className="flex items-center justify-between py-2.5 border-b border-border last:border-0"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className={config.color}>{config.icon}</span>
                                                    <div>
                                                        <p className="text-sm font-medium">
                                                            {format(new Date(record.date), "EEEE, MMM d")}
                                                        </p>
                                                        {record.taskSubmittedAt && (
                                                            <p className="text-xs text-muted-foreground">
                                                                Submitted at{" "}
                                                                {format(new Date(record.taskSubmittedAt), "hh:mm a")}
                                                                {record.allTasksCompletedAt &&
                                                                    ` · Completed at ${format(
                                                                        new Date(record.allTasksCompletedAt),
                                                                        "hh:mm a"
                                                                    )}`}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <Badge
                                                    variant="secondary"
                                                    className={`text-xs font-medium ${config.color}`}
                                                >
                                                    {config.label}
                                                </Badge>
                                            </div>
                                        );
                                    })}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {!loading && data?.attendance.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <CalendarDays className="h-10 w-10 text-muted-foreground/40 mb-3" />
                        <p className="text-sm font-medium text-muted-foreground">No records found</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                            No attendance data for {MONTHS[selectedMonth - 1]} {selectedYear}
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const SummaryCard = ({
    label,
    value,
    total,
    color,
    icon,
}: {
    label: string;
    value: number;
    total: number;
    color: "emerald" | "red" | "amber";
    icon: React.ReactNode;
}) => {
    const colorMap = {
        emerald: "text-emerald-600 dark:text-emerald-400",
        red: "text-red-600 dark:text-red-400",
        amber: "text-amber-600 dark:text-amber-400",
    };

    return (
        <Card className="border-border">
            <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {label}
                    </span>
                    <span className={colorMap[color]}>{icon}</span>
                </div>
                <p className="text-2xl font-bold tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">of {total} working days</p>
            </CardContent>
        </Card>
    );
};

const CalendarCell = ({
    day,
    record,
    isToday,
    isFuture,
}: {
    day: number;
    record: AttendanceRecord | undefined;
    isToday: boolean;
    isFuture: boolean;
}) => {
    const base =
        "aspect-square flex items-center justify-center rounded-lg text-xs font-medium relative transition-colors select-none";

    if (isFuture) {
        return <div className={`${base} text-muted-foreground/30`}>{day}</div>;
    }

    if (!record) {
        return (
            <div
                className={`${base} ${isToday
                        ? "ring-2 ring-foreground text-foreground"
                        : "text-muted-foreground bg-muted/40"
                    }`}
            >
                {day}
            </div>
        );
    }

    const statusStyle: Record<AttendanceStatus, string> = {
        present: "bg-emerald-500 text-white",
        absent: "bg-red-500 text-white",
        partial: "bg-amber-500 text-white",
    };

    return (
        <div
            title={STATUS_CONFIG[record.status].label}
            className={`${base} ${statusStyle[record.status]} ${isToday ? "ring-2 ring-offset-1 ring-offset-background ring-foreground" : ""
                }`}
        >
            {day}
        </div>
    );
};

export default MemberDashboard;
