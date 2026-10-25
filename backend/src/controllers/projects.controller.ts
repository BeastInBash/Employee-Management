import { AttendanceStatus, Prisma, PrismaClient, ScopeRole, TaskStatus } from "@prisma/client";
import type { Request, Response } from "express";
import ApiError from "../utils/errors/ApiError";
import {
    assertMembersInWorkspace,
    assertWorkspaceParticipant,
    canManage,
    getProjectAccess,
    getProjectParticipantIds,
    type ScopeAccess,
} from "../utils/access";
import {
    addSeatSchema,
    assignTeamSchema,
    createProjectSchema,
    createProjectTaskSchema,
    listScopeQuerySchema,
    projectTasksQuerySchema,
    updateProjectSchema,
    updateSeatSchema,
} from "../validation/projectValidation";
import {
    getTodayISTDate,
    isWithinTaskWindow,
    serializeTaskWindow,
    taskWindowClosedMessage,
    toTaskWindow,
} from "../utils/attendance";

const prisma = new PrismaClient();

export const memberSummarySelect = {
    id: true,
    userId: true,
    email: true,
    role: true,
    user: { select: { name: true } },
} as const;

type MemberSummaryRow = Prisma.MemberGetPayload<{ select: typeof memberSummarySelect }>;

/** The wire shape for a Member seat inside projects/teams. `jobTitle` is `Member.role`. */
export function serializeMember(m: MemberSummaryRow) {
    return { id: m.id, userId: m.userId, name: m.user.name, email: m.email, jobTitle: m.role };
}

export interface TaskStats {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
    progress: number;
}

function emptyStats(): TaskStats {
    return { total: 0, completed: 0, inProgress: 0, overdue: 0, progress: 0 };
}

function finishStats(s: TaskStats): TaskStats {
    s.progress = s.total === 0 ? 0 : Math.round((s.completed / s.total) * 100);
    return s;
}

/** Per-project task counts for many projects in two queries. */
async function taskStatsByProject(projectIds: string[]): Promise<Map<string, TaskStats>> {
    const stats = new Map<string, TaskStats>(projectIds.map((id) => [id, emptyStats()]));
    if (projectIds.length === 0) return stats;

    const [byStatus, overdue] = await Promise.all([
        prisma.task.groupBy({
            by: ["projectId", "status"],
            where: { projectId: { in: projectIds } },
            _count: { _all: true },
        }),
        prisma.task.groupBy({
            by: ["projectId"],
            where: {
                projectId: { in: projectIds },
                status: { not: TaskStatus.completed },
                dueDate: { lt: new Date() },
            },
            _count: { _all: true },
        }),
    ]);

    for (const row of byStatus) {
        const s = row.projectId ? stats.get(row.projectId) : undefined;
        if (!s) continue;
        s.total += row._count._all;
        if (row.status === TaskStatus.completed) s.completed += row._count._all;
        if (row.status === TaskStatus.in_progress || row.status === TaskStatus.review) {
            s.inProgress += row._count._all;
        }
    }
    for (const row of overdue) {
        const s = row.projectId ? stats.get(row.projectId) : undefined;
        if (s) s.overdue = row._count._all;
    }
    stats.forEach(finishStats);
    return stats;
}

const projectListInclude = {
    members: { select: { role: true, member: { select: memberSummarySelect } } },
    teams: { select: { team: { select: { id: true, name: true, color: true } } } },
} as const;

type ProjectListRow = Prisma.ProjectGetPayload<{ include: typeof projectListInclude }>;

function serializeProjectSummary(p: ProjectListRow, stats: TaskStats | undefined, myRole: ScopeAccess) {
    return {
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        color: p.color,
        startDate: p.startDate,
        dueDate: p.dueDate,
        workspaceId: p.workspaceId,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        leads: p.members.filter((m) => m.role === ScopeRole.lead).map((m) => serializeMember(m.member)),
        memberCount: p.members.length,
        teams: p.teams.map((t) => t.team),
        stats: stats ?? finishStats(emptyStats()),
        myRole,
    };
}

/** Where-clause for projects a Member seat participates in (directly or via a team). */
function participatesIn(memberIds: string[]): Prisma.ProjectWhereInput {
    return {
        OR: [
            { members: { some: { memberId: { in: memberIds } } } },
            { teams: { some: { team: { members: { some: { memberId: { in: memberIds } } } } } } },
        ],
    };
}

function myRoleOn(p: ProjectListRow, isAdmin: boolean, memberIds: Set<string>): ScopeAccess {
    if (isAdmin) return "admin";
    const seat = p.members.find((m) => memberIds.has(m.member.id));
    if (seat?.role === ScopeRole.lead) return "lead";
    return "member";
}

/**
 * GET /api/projects?workspaceId=
 * With a workspace: admins see every project in it, members see the ones they're on.
 * Without: every project the caller participates in, across workspaces.
 */
export const listProjects = async (req: Request, res: Response) => {
    const { userId } = req.user!;
    const { workspaceId } = listScopeQuerySchema.parse(req.query);

    let where: Prisma.ProjectWhereInput;
    let isAdmin = false;
    let mySeats: string[];

    if (workspaceId) {
        const ws = await assertWorkspaceParticipant(userId, workspaceId);
        isAdmin = ws.isAdmin;
        mySeats = ws.memberId ? [ws.memberId] : [];
        where = isAdmin ? { workspaceId } : { workspaceId, ...participatesIn(mySeats) };
    } else {
        const seats = await prisma.member.findMany({ where: { userId }, select: { id: true } });
        mySeats = seats.map((s) => s.id);
        where = participatesIn(mySeats);
    }

    const projects = await prisma.project.findMany({
        where,
        include: projectListInclude,
        orderBy: [{ updatedAt: "desc" }],
    });
    const stats = await taskStatsByProject(projects.map((p) => p.id));
    const seatSet = new Set(mySeats);

    res.json({
        projects: projects.map((p) => serializeProjectSummary(p, stats.get(p.id), myRoleOn(p, isAdmin, seatSet))),
    });
};

/** POST /api/projects — admin only. Optionally seeds leads, members and teams. */
export const createProject = async (req: Request, res: Response) => {
    const { userId } = req.user!;
    const data = createProjectSchema.parse(req.body);

    const ws = await assertWorkspaceParticipant(userId, data.workspaceId);
    if (!ws.isAdmin) throw ApiError.forbidden("Only workspace admins can create projects");

    const leadIds = [...new Set(data.leadIds)];
    const memberIds = [...new Set(data.memberIds)].filter((id) => !leadIds.includes(id));
    await assertMembersInWorkspace([...leadIds, ...memberIds], data.workspaceId);

    const teamIds = [...new Set(data.teamIds)];
    if (teamIds.length) {
        const found = await prisma.team.count({ where: { id: { in: teamIds }, workspaceId: data.workspaceId } });
        if (found !== teamIds.length) throw ApiError.badRequest("One or more teams do not belong to this workspace");
    }

    const project = await prisma.project.create({
        data: {
            name: data.name,
            status: data.status,
            workspaceId: data.workspaceId,
            createdById: userId,
            ...(data.description !== undefined && { description: data.description }),
            ...(data.color !== undefined && { color: data.color }),
            ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
            ...(data.dueDate !== undefined && { dueDate: new Date(data.dueDate) }),
            members: {
                create: [
                    ...leadIds.map((memberId) => ({ memberId, role: ScopeRole.lead })),
                    ...memberIds.map((memberId) => ({ memberId, role: ScopeRole.member })),
                ],
            },
            teams: { create: teamIds.map((teamId) => ({ teamId })) },
        },
        include: projectListInclude,
    });

    res.status(201).json({ project: serializeProjectSummary(project, undefined, "admin") });
};

/**
 * GET /api/projects/:projectId — full detail: seats, teams (with their members),
 * per-assignee task stats and today's attendance for everyone on the project.
 */
export const getProject = async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const access = await getProjectAccess(req.user!.userId, projectId);
    if (!access.access) throw ApiError.forbidden("You do not have access to this project");

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
            members: {
                select: { role: true, addedAt: true, member: { select: memberSummarySelect } },
                orderBy: { addedAt: "asc" },
            },
            teams: {
                select: {
                    team: {
                        select: {
                            id: true,
                            name: true,
                            color: true,
                            members: { select: { role: true, member: { select: memberSummarySelect } } },
                        },
                    },
                },
            },
        },
    });
    if (!project) throw ApiError.notFound("Project not found");

    // Everyone who can be assigned work here, keyed by Member id.
    const people = new Map<string, ReturnType<typeof serializeMember> & { projectRole: ScopeRole | null; viaTeams: string[] }>();
    for (const seat of project.members) {
        people.set(seat.member.id, { ...serializeMember(seat.member), projectRole: seat.role, viaTeams: [] });
    }
    for (const { team } of project.teams) {
        for (const tm of team.members) {
            const existing = people.get(tm.member.id);
            if (existing) existing.viaTeams.push(team.name);
            else people.set(tm.member.id, { ...serializeMember(tm.member), projectRole: null, viaTeams: [team.name] });
        }
    }

    const memberIds = [...people.keys()];
    const today = getTodayISTDate();
    const [byAssignee, overdueByAssignee, attendance, stats] = await Promise.all([
        prisma.task.groupBy({
            by: ["memberId", "status"],
            where: { projectId },
            _count: { _all: true },
        }),
        prisma.task.groupBy({
            by: ["memberId"],
            where: { projectId, status: { not: TaskStatus.completed }, dueDate: { lt: new Date() } },
            _count: { _all: true },
        }),
        prisma.dailyAttendance.findMany({
            where: { memberId: { in: memberIds }, date: today },
            select: { memberId: true, status: true },
        }),
        taskStatsByProject([projectId]),
    ]);

    const perMember = new Map<string, TaskStats>();
    for (const row of byAssignee) {
        const s = perMember.get(row.memberId) ?? emptyStats();
        s.total += row._count._all;
        if (row.status === TaskStatus.completed) s.completed += row._count._all;
        if (row.status === TaskStatus.in_progress || row.status === TaskStatus.review) s.inProgress += row._count._all;
        perMember.set(row.memberId, s);
    }
    for (const row of overdueByAssignee) {
        const s = perMember.get(row.memberId) ?? emptyStats();
        s.overdue = row._count._all;
        perMember.set(row.memberId, s);
    }
    const todayStatus = new Map(attendance.map((a) => [a.memberId, a.status]));

    res.json({
        project: {
            id: project.id,
            name: project.name,
            description: project.description,
            status: project.status,
            color: project.color,
            startDate: project.startDate,
            dueDate: project.dueDate,
            workspaceId: project.workspaceId,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            stats: stats.get(projectId) ?? finishStats(emptyStats()),
            teams: project.teams.map(({ team }) => ({
                id: team.id,
                name: team.name,
                color: team.color,
                memberCount: team.members.length,
            })),
            people: [...people.values()].map((p) => ({
                ...p,
                stats: finishStats(perMember.get(p.id) ?? emptyStats()),
                // No row yet today means they haven't submitted anything.
                todayAttendance: todayStatus.get(p.id) ?? AttendanceStatus.absent,
            })),
        },
        myRole: access.access,
        permissions: {
            canManage: canManage(access.access),
            canAssignLeads: access.access === "admin",
            canDelete: access.access === "admin",
        },
    });
};

/** PATCH /api/projects/:projectId — admins and project leads. */
export const updateProject = async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const access = await getProjectAccess(req.user!.userId, projectId);
    if (!canManage(access.access)) throw ApiError.forbidden("Only admins and project leads can edit this project");

    const data = updateProjectSchema.parse(req.body);
    const toDate = (v: string | null) => (v === null ? null : new Date(v));

    const project = await prisma.project.update({
        where: { id: projectId },
        data: {
            ...(data.name !== undefined && { name: data.name }),
            ...(data.description !== undefined && { description: data.description }),
            ...(data.status !== undefined && { status: data.status }),
            ...(data.color !== undefined && { color: data.color }),
            ...(data.startDate !== undefined && { startDate: toDate(data.startDate) }),
            ...(data.dueDate !== undefined && { dueDate: toDate(data.dueDate) }),
        },
        include: projectListInclude,
    });
    const stats = await taskStatsByProject([projectId]);

    res.json({ project: serializeProjectSummary(project, stats.get(projectId), access.access) });
};

/** DELETE /api/projects/:projectId — admin only. Tasks survive with projectId cleared. */
export const deleteProject = async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const access = await getProjectAccess(req.user!.userId, projectId);
    if (access.access !== "admin") throw ApiError.forbidden("Only workspace admins can delete projects");

    await prisma.project.delete({ where: { id: projectId } });
    res.json({ message: "Project deleted" });
};

// ─── seats ──────────────────────────────────────────────────────────────────

/** POST /api/projects/:projectId/members — leads may add members; only admins may add leads. */
export const addProjectMember = async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const access = await getProjectAccess(req.user!.userId, projectId);
    if (!canManage(access.access)) throw ApiError.forbidden("Only admins and project leads can add members");

    const { memberId, role } = addSeatSchema.parse(req.body);
    if (role === ScopeRole.lead && access.access !== "admin") {
        throw ApiError.forbidden("Only workspace admins can appoint project leads");
    }
    await assertMembersInWorkspace([memberId], access.workspaceId);

    const seat = await prisma.projectMember.create({
        data: { projectId, memberId, role },
        select: { role: true, addedAt: true, member: { select: memberSummarySelect } },
    });
    res.status(201).json({ member: { ...serializeMember(seat.member), projectRole: seat.role } });
};

/** PATCH /api/projects/:projectId/members/:memberId — promote/demote; admin only. */
export const updateProjectMember = async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const memberId = req.params.memberId as string;
    const access = await getProjectAccess(req.user!.userId, projectId);
    if (access.access !== "admin") throw ApiError.forbidden("Only workspace admins can change project roles");

    const { role } = updateSeatSchema.parse(req.body);
    const seat = await prisma.projectMember.update({
        where: { projectId_memberId: { projectId, memberId } },
        data: { role },
        select: { role: true, member: { select: memberSummarySelect } },
    });
    res.json({ member: { ...serializeMember(seat.member), projectRole: seat.role } });
};

/** DELETE /api/projects/:projectId/members/:memberId — leads can't remove other leads. */
export const removeProjectMember = async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const memberId = req.params.memberId as string;
    const access = await getProjectAccess(req.user!.userId, projectId);
    if (!canManage(access.access)) throw ApiError.forbidden("Only admins and project leads can remove members");

    const seat = await prisma.projectMember.findUnique({
        where: { projectId_memberId: { projectId, memberId } },
        select: { role: true },
    });
    if (!seat) throw ApiError.notFound("That person is not on this project");
    if (seat.role === ScopeRole.lead && access.access !== "admin") {
        throw ApiError.forbidden("Only workspace admins can remove a project lead");
    }

    await prisma.projectMember.delete({ where: { projectId_memberId: { projectId, memberId } } });
    res.json({ message: "Removed from project" });
};

/** POST /api/projects/:projectId/teams — assign a whole team. */
export const assignProjectTeam = async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const access = await getProjectAccess(req.user!.userId, projectId);
    if (!canManage(access.access)) throw ApiError.forbidden("Only admins and project leads can assign teams");

    const { teamId } = assignTeamSchema.parse(req.body);
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, name: true, color: true, workspaceId: true } });
    if (!team || team.workspaceId !== access.workspaceId) throw ApiError.badRequest("Team does not belong to this workspace");

    await prisma.projectTeam.create({ data: { projectId, teamId } });
    res.status(201).json({ team: { id: team.id, name: team.name, color: team.color } });
};

/** DELETE /api/projects/:projectId/teams/:teamId */
export const unassignProjectTeam = async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const teamId = req.params.teamId as string;
    const access = await getProjectAccess(req.user!.userId, projectId);
    if (!canManage(access.access)) throw ApiError.forbidden("Only admins and project leads can unassign teams");

    await prisma.projectTeam.delete({ where: { projectId_teamId: { projectId, teamId } } });
    res.json({ message: "Team unassigned" });
};

// ─── tasks ──────────────────────────────────────────────────────────────────

export const taskWithAssigneeInclude = {
    member: { select: memberSummarySelect },
    project: { select: { id: true, name: true, color: true } },
} as const;

type TaskWithAssignee = Prisma.TaskGetPayload<{ include: typeof taskWithAssigneeInclude }>;

export function serializeTask(t: TaskWithAssignee) {
    const { member, ...task } = t;
    return { ...task, assignee: serializeMember(member) };
}

/** GET /api/projects/:projectId/tasks?status&memberId — anyone on the project. */
export const listProjectTasks = async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const access = await getProjectAccess(req.user!.userId, projectId);
    if (!access.access) throw ApiError.forbidden("You do not have access to this project");

    const filters = projectTasksQuerySchema.parse(req.query);
    const tasks = await prisma.task.findMany({
        where: {
            projectId,
            ...(filters.status && { status: filters.status }),
            ...(filters.memberId && { memberId: filters.memberId }),
        },
        include: taskWithAssigneeInclude,
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });

    res.json({ tasks: tasks.map(serializeTask) });
};

/**
 * POST /api/projects/:projectId/tasks
 * Admins/leads may assign to anyone on the project. Regular members may only
 * create tasks for themselves — and those count as their daily submission, so
 * the workspace's task window applies, just like POST /api/tasks.
 */
export const createProjectTask = async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const access = await getProjectAccess(req.user!.userId, projectId);
    if (!access.access) throw ApiError.forbidden("You do not have access to this project");

    const data = createProjectTaskSchema.parse(req.body);
    const assigneeId = data.memberId ?? access.memberId;
    if (!assigneeId) throw ApiError.badRequest("memberId is required");

    const isSelf = assigneeId === access.memberId;
    if (!isSelf && !canManage(access.access)) {
        throw ApiError.forbidden("Only admins and project leads can assign tasks to others");
    }

    const participants = await getProjectParticipantIds(projectId);
    if (!participants.has(assigneeId)) {
        throw ApiError.badRequest("The assignee must be on this project (directly or through a team)");
    }

    if (isSelf && access.access !== "admin") {
        const workspace = await prisma.workspace.findUnique({
            where: { id: access.workspaceId },
            select: { taskWindowEnabled: true, taskWindowStart: true, taskWindowEnd: true },
        });
        const window = toTaskWindow(workspace);
        if (!isWithinTaskWindow(window)) {
            res.status(403).json({ message: taskWindowClosedMessage(window), taskWindow: serializeTaskWindow(window) });
            return;
        }
    }

    const task = await prisma.task.create({
        data: {
            title: data.title,
            description: data.description,
            status: data.status,
            priority: data.priority,
            dueDate: new Date(data.dueDate),
            memberId: assigneeId,
            projectId,
        },
        include: taskWithAssigneeInclude,
    });

    if (isSelf && access.access !== "admin") {
        const today = getTodayISTDate();
        await prisma.dailyAttendance.upsert({
            where: { memberId_date: { memberId: assigneeId, date: today } },
            update: {},
            create: { memberId: assigneeId, date: today, status: AttendanceStatus.absent, taskSubmittedAt: new Date() },
        });
    }

    res.status(201).json({ task: serializeTask(task) });
};
