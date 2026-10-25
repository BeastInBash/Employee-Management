import { AttendanceStatus, Prisma, PrismaClient, TaskStatus } from "@prisma/client";
import type { Request, Response } from "express";
import ApiError from "../utils/errors/ApiError";
import { canManage, getProjectAccess, getProjectParticipantIds, getTeamAccess, getWorkspaceAccess } from "../utils/access";
import { reportQuerySchema } from "../validation/reportValidation";

const prisma = new PrismaClient();

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 366;

// ─── IST calendar helpers ───────────────────────────────────────────────────
// Reports work in IST calendar days ("YYYY-MM-DD"), matching how attendance
// rows are keyed (UTC midnight of the IST date, see getTodayISTDate).

/** The IST calendar day an instant falls on. */
export function istDateKey(instant: Date): string {
    return new Date(instant.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The instant an IST calendar day starts. */
function istDayStart(key: string): Date {
    return new Date(Date.parse(`${key}T00:00:00Z`) - IST_OFFSET_MS);
}

/** Attendance rows store the IST day as UTC midnight. */
function attendanceDate(key: string): Date {
    return new Date(`${key}T00:00:00Z`);
}

function isWeekend(key: string): boolean {
    const day = new Date(`${key}T00:00:00Z`).getUTCDay();
    return day === 0 || day === 6;
}

function eachDay(from: string, to: string): string[] {
    const days: string[] = [];
    for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += DAY_MS) {
        days.push(new Date(t).toISOString().slice(0, 10));
    }
    return days;
}

const pct = (part: number, whole: number) => (whole === 0 ? null : Math.round((part / whole) * 100));
const round1 = (n: number) => Math.round(n * 10) / 10;

// ─── scope resolution ───────────────────────────────────────────────────────

interface ResolvedScope {
    type: "workspace" | "project" | "team" | "me";
    id: string | null;
    name: string;
    /** Member seats whose work and attendance are reported. */
    memberIds: string[];
    /** Restrict task metrics to one project (project scope only). */
    projectId?: string;
}

async function resolveScope(userId: string, type: ResolvedScope["type"], id: string | undefined): Promise<ResolvedScope> {
    if (type === "me") {
        const seats = await prisma.member.findMany({ where: { userId }, select: { id: true } });
        if (seats.length === 0) throw ApiError.notFound("You don't have a member seat in any workspace");
        return { type, id: null, name: "My productivity", memberIds: seats.map((s) => s.id) };
    }
    if (!id) throw ApiError.badRequest("id is required for this scope");

    if (type === "workspace") {
        const access = await getWorkspaceAccess(userId, id);
        if (!access.isAdmin) throw ApiError.forbidden("Only workspace admins can view workspace reports");
        const [workspace, members] = await Promise.all([
            prisma.workspace.findUnique({ where: { id }, select: { name: true } }),
            prisma.member.findMany({ where: { workspaceId: id }, select: { id: true } }),
        ]);
        return { type, id, name: workspace?.name ?? "Workspace", memberIds: members.map((m) => m.id) };
    }

    if (type === "project") {
        const access = await getProjectAccess(userId, id);
        if (!canManage(access.access)) throw ApiError.forbidden("Only admins and project leads can view project reports");
        const [project, participants] = await Promise.all([
            prisma.project.findUnique({ where: { id }, select: { name: true } }),
            getProjectParticipantIds(id),
        ]);
        return { type, id, name: project?.name ?? "Project", memberIds: [...participants], projectId: id };
    }

    const access = await getTeamAccess(userId, id);
    if (!canManage(access.access)) throw ApiError.forbidden("Only admins and team leads can view team reports");
    const [team, seats] = await Promise.all([
        prisma.team.findUnique({ where: { id }, select: { name: true } }),
        prisma.teamMember.findMany({ where: { teamId: id }, select: { memberId: true } }),
    ]);
    return { type, id, name: team?.name ?? "Team", memberIds: seats.map((s) => s.memberId) };
}

// ─── report ─────────────────────────────────────────────────────────────────

interface MemberRow {
    id: string;
    userId: string;
    name: string;
    jobTitle: string;
    created: number;
    completed: number;
    onTime: number;
    overdueOpen: number;
    cycleHoursTotal: number;
    present: number;
    partial: number;
    absent: number;
}

/**
 * GET /api/reports?scope=workspace|project|team|me&id&from&to&excludeWeekends
 *
 * Task metrics for the IST date range:
 *  - created / completed — tasks created / completed within the range
 *  - completionRate     — of tasks created in the range, the share now completed
 *  - onTimeRate         — of tasks completed in the range, the share done by their due date
 *  - overdueOpen        — open tasks past their due date right now
 *  - avgCycleHours      — mean created→completed time for tasks completed in the range
 * Attendance metrics count the derived DailyAttendance rows (present = 1,
 * partial = ½) and skip Saturdays/Sundays when `excludeWeekends` is on.
 */
export const getReport = async (req: Request, res: Response) => {
    const q = reportQuerySchema.parse(req.query);
    const days = eachDay(q.from, q.to);
    if (days.length === 0) throw ApiError.badRequest("from must be on or before to");
    if (days.length > MAX_RANGE_DAYS) throw ApiError.badRequest(`Reports cover at most ${MAX_RANGE_DAYS} days`);

    const scope = await resolveScope(req.user!.userId, q.scope, q.id);
    const rangeStart = istDayStart(q.from);
    const rangeEnd = new Date(istDayStart(q.to).getTime() + DAY_MS);
    const memberFilter = { memberId: { in: scope.memberIds } };
    const projectFilter = scope.projectId ? { projectId: scope.projectId } : {};
    const taskScope: Prisma.TaskWhereInput = { ...memberFilter, ...projectFilter };

    const [members, created, completed, overdue, attendance] = await Promise.all([
        prisma.member.findMany({
            where: { id: { in: scope.memberIds } },
            select: { id: true, userId: true, role: true, user: { select: { name: true } } },
        }),
        prisma.task.findMany({
            where: { ...taskScope, createdAt: { gte: rangeStart, lt: rangeEnd } },
            select: { memberId: true, createdAt: true, status: true },
        }),
        prisma.task.findMany({
            where: { ...taskScope, completedAt: { gte: rangeStart, lt: rangeEnd } },
            select: { memberId: true, createdAt: true, completedAt: true, dueDate: true },
        }),
        prisma.task.groupBy({
            by: ["memberId"],
            where: { ...taskScope, status: { not: TaskStatus.completed }, dueDate: { lt: new Date() } },
            _count: { _all: true },
        }),
        prisma.dailyAttendance.findMany({
            where: { ...memberFilter, date: { gte: attendanceDate(q.from), lte: attendanceDate(q.to) } },
            select: { memberId: true, date: true, status: true },
        }),
    ]);

    const rows = new Map<string, MemberRow>(
        members.map((m) => [
            m.id,
            {
                id: m.id,
                userId: m.userId,
                name: m.user.name,
                jobTitle: m.role,
                created: 0,
                completed: 0,
                onTime: 0,
                overdueOpen: 0,
                cycleHoursTotal: 0,
                present: 0,
                partial: 0,
                absent: 0,
            },
        ])
    );
    const trend = new Map(
        days.map((d) => [d, { date: d, weekend: isWeekend(d), created: 0, completed: 0, present: 0, partial: 0, absent: 0 }])
    );

    let createdNowDone = 0;
    for (const t of created) {
        const row = rows.get(t.memberId);
        if (row) row.created++;
        const day = trend.get(istDateKey(t.createdAt));
        if (day) day.created++;
        if (t.status === TaskStatus.completed) createdNowDone++;
    }

    for (const t of completed) {
        const row = rows.get(t.memberId);
        const onTime = t.completedAt! <= t.dueDate;
        const hours = (t.completedAt!.getTime() - t.createdAt.getTime()) / 3_600_000;
        if (row) {
            row.completed++;
            if (onTime) row.onTime++;
            row.cycleHoursTotal += hours;
        }
        const day = trend.get(istDateKey(t.completedAt!));
        if (day) day.completed++;
    }

    for (const o of overdue) {
        const row = rows.get(o.memberId);
        if (row) row.overdueOpen = o._count._all;
    }

    for (const a of attendance) {
        const key = a.date.toISOString().slice(0, 10);
        if (q.excludeWeekends && isWeekend(key)) continue;
        const row = rows.get(a.memberId);
        const day = trend.get(key);
        const field =
            a.status === AttendanceStatus.present ? "present" : a.status === AttendanceStatus.partial ? "partial" : "absent";
        if (row) row[field]++;
        if (day) day[field]++;
    }

    const memberRows = [...rows.values()]
        .map((r) => {
            const recorded = r.present + r.partial + r.absent;
            return {
                id: r.id,
                userId: r.userId,
                name: r.name,
                jobTitle: r.jobTitle,
                created: r.created,
                completed: r.completed,
                onTimeRate: pct(r.onTime, r.completed),
                overdueOpen: r.overdueOpen,
                avgCycleHours: r.completed ? round1(r.cycleHoursTotal / r.completed) : null,
                present: r.present,
                partial: r.partial,
                absent: r.absent,
                attendanceRate: pct(r.present + r.partial / 2, recorded),
            };
        })
        .sort((a, b) => b.completed - a.completed || a.name.localeCompare(b.name));

    const totals = [...rows.values()].reduce(
        (acc, r) => ({
            onTime: acc.onTime + r.onTime,
            cycle: acc.cycle + r.cycleHoursTotal,
            present: acc.present + r.present,
            partial: acc.partial + r.partial,
            absent: acc.absent + r.absent,
        }),
        { onTime: 0, cycle: 0, present: 0, partial: 0, absent: 0 }
    );
    const recorded = totals.present + totals.partial + totals.absent;

    res.json({
        scope: { type: scope.type, id: scope.id, name: scope.name },
        range: { from: q.from, to: q.to, days: days.length, excludeWeekends: q.excludeWeekends },
        summary: {
            people: members.length,
            tasksCreated: created.length,
            tasksCompleted: completed.length,
            completionRate: pct(createdNowDone, created.length),
            onTimeRate: pct(totals.onTime, completed.length),
            overdueOpen: memberRows.reduce((n, r) => n + r.overdueOpen, 0),
            avgCycleHours: completed.length ? round1(totals.cycle / completed.length) : null,
            attendanceRate: pct(totals.present + totals.partial / 2, recorded),
            presentDays: totals.present,
            partialDays: totals.partial,
            absentDays: totals.absent,
        },
        trend: [...trend.values()],
        members: memberRows,
    });
};
