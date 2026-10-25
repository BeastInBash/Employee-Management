import { AttendanceStatus, Prisma, PrismaClient, ScopeRole, TaskStatus } from "@prisma/client";
import type { Request, Response } from "express";
import ApiError from "../utils/errors/ApiError";
import {
    assertMembersInWorkspace,
    assertWorkspaceParticipant,
    canManage,
    getTeamAccess,
    type ScopeAccess,
} from "../utils/access";
import {
    addSeatSchema,
    createTeamSchema,
    listScopeQuerySchema,
    updateSeatSchema,
    updateTeamSchema,
} from "../validation/projectValidation";
import { getTodayISTDate } from "../utils/attendance";
import { memberSummarySelect, serializeMember } from "./projects.controller";

const prisma = new PrismaClient();

const teamListInclude = {
    members: { select: { role: true, member: { select: memberSummarySelect } } },
    _count: { select: { projects: true } },
} as const;

type TeamListRow = Prisma.TeamGetPayload<{ include: typeof teamListInclude }>;

function myRoleOn(t: TeamListRow, isAdmin: boolean, mySeats: Set<string>): ScopeAccess {
    if (isAdmin) return "admin";
    const seat = t.members.find((m) => mySeats.has(m.member.id));
    if (!seat) return null;
    return seat.role === ScopeRole.lead ? "lead" : "member";
}

function serializeTeamSummary(t: TeamListRow, myRole: ScopeAccess) {
    return {
        id: t.id,
        name: t.name,
        description: t.description,
        color: t.color,
        workspaceId: t.workspaceId,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        leads: t.members.filter((m) => m.role === ScopeRole.lead).map((m) => serializeMember(m.member)),
        memberCount: t.members.length,
        projectCount: t._count.projects,
        myRole,
    };
}

/**
 * GET /api/teams?workspaceId=
 * Teams aren't secret inside a workspace: any participant sees all of them
 * (`myRole` is null for teams they're not on). Without a workspace, returns
 * the teams the caller belongs to.
 */
export const listTeams = async (req: Request, res: Response) => {
    const { userId } = req.user!;
    const { workspaceId } = listScopeQuerySchema.parse(req.query);

    let where: Prisma.TeamWhereInput;
    let isAdmin = false;
    let mySeats: string[];

    if (workspaceId) {
        const ws = await assertWorkspaceParticipant(userId, workspaceId);
        isAdmin = ws.isAdmin;
        mySeats = ws.memberId ? [ws.memberId] : [];
        where = { workspaceId };
    } else {
        const seats = await prisma.member.findMany({ where: { userId }, select: { id: true } });
        mySeats = seats.map((s) => s.id);
        where = { members: { some: { memberId: { in: mySeats } } } };
    }

    const teams = await prisma.team.findMany({ where, include: teamListInclude, orderBy: { name: "asc" } });
    const seatSet = new Set(mySeats);
    res.json({ teams: teams.map((t) => serializeTeamSummary(t, myRoleOn(t, isAdmin, seatSet))) });
};

/** POST /api/teams — admin only. */
export const createTeam = async (req: Request, res: Response) => {
    const { userId } = req.user!;
    const data = createTeamSchema.parse(req.body);

    const ws = await assertWorkspaceParticipant(userId, data.workspaceId);
    if (!ws.isAdmin) throw ApiError.forbidden("Only workspace admins can create teams");

    const leadIds = [...new Set(data.leadIds)];
    const memberIds = [...new Set(data.memberIds)].filter((id) => !leadIds.includes(id));
    await assertMembersInWorkspace([...leadIds, ...memberIds], data.workspaceId);

    const team = await prisma.team.create({
        data: {
            name: data.name,
            workspaceId: data.workspaceId,
            ...(data.description !== undefined && { description: data.description }),
            ...(data.color !== undefined && { color: data.color }),
            members: {
                create: [
                    ...leadIds.map((memberId) => ({ memberId, role: ScopeRole.lead })),
                    ...memberIds.map((memberId) => ({ memberId, role: ScopeRole.member })),
                ],
            },
        },
        include: teamListInclude,
    });

    res.status(201).json({ team: serializeTeamSummary(team, "admin") });
};

/**
 * GET /api/teams/:teamId — roster with each member's open/completed task counts
 * and today's attendance, plus the projects the team is assigned to. Any
 * workspace participant may view; leads/admins get `permissions.canManage`.
 */
export const getTeam = async (req: Request, res: Response) => {
    const teamId = req.params.teamId as string;
    const access = await getTeamAccess(req.user!.userId, teamId);
    if (!access.isAdmin && !access.memberId) throw ApiError.forbidden("You do not have access to this team");

    const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
            members: {
                select: { role: true, joinedAt: true, member: { select: memberSummarySelect } },
                orderBy: { joinedAt: "asc" },
            },
            projects: {
                select: { project: { select: { id: true, name: true, color: true, status: true, dueDate: true } } },
            },
        },
    });
    if (!team) throw ApiError.notFound("Team not found");

    const memberIds = team.members.map((m) => m.member.id);
    const today = getTodayISTDate();
    const [byStatus, overdue, attendance] = await Promise.all([
        prisma.task.groupBy({
            by: ["memberId", "status"],
            where: { memberId: { in: memberIds } },
            _count: { _all: true },
        }),
        prisma.task.groupBy({
            by: ["memberId"],
            where: { memberId: { in: memberIds }, status: { not: TaskStatus.completed }, dueDate: { lt: new Date() } },
            _count: { _all: true },
        }),
        prisma.dailyAttendance.findMany({
            where: { memberId: { in: memberIds }, date: today },
            select: { memberId: true, status: true },
        }),
    ]);

    const counts = new Map<string, { total: number; completed: number; overdue: number }>();
    for (const row of byStatus) {
        const c = counts.get(row.memberId) ?? { total: 0, completed: 0, overdue: 0 };
        c.total += row._count._all;
        if (row.status === TaskStatus.completed) c.completed += row._count._all;
        counts.set(row.memberId, c);
    }
    for (const row of overdue) {
        const c = counts.get(row.memberId) ?? { total: 0, completed: 0, overdue: 0 };
        c.overdue = row._count._all;
        counts.set(row.memberId, c);
    }
    const todayStatus = new Map(attendance.map((a) => [a.memberId, a.status]));

    res.json({
        team: {
            id: team.id,
            name: team.name,
            description: team.description,
            color: team.color,
            workspaceId: team.workspaceId,
            createdAt: team.createdAt,
            updatedAt: team.updatedAt,
            members: team.members.map((m) => ({
                ...serializeMember(m.member),
                teamRole: m.role,
                joinedAt: m.joinedAt,
                stats: counts.get(m.member.id) ?? { total: 0, completed: 0, overdue: 0 },
                todayAttendance: todayStatus.get(m.member.id) ?? AttendanceStatus.absent,
            })),
            projects: team.projects.map((p) => p.project),
        },
        myRole: access.access,
        permissions: {
            canManage: canManage(access.access),
            canAssignLeads: access.access === "admin",
            canDelete: access.access === "admin",
        },
    });
};

/** PATCH /api/teams/:teamId — admins and team leads. */
export const updateTeam = async (req: Request, res: Response) => {
    const teamId = req.params.teamId as string;
    const access = await getTeamAccess(req.user!.userId, teamId);
    if (!canManage(access.access)) throw ApiError.forbidden("Only admins and team leads can edit this team");

    const data = updateTeamSchema.parse(req.body);
    const team = await prisma.team.update({
        where: { id: teamId },
        data: {
            ...(data.name !== undefined && { name: data.name }),
            ...(data.description !== undefined && { description: data.description }),
            ...(data.color !== undefined && { color: data.color }),
        },
        include: teamListInclude,
    });
    res.json({ team: serializeTeamSummary(team, access.access) });
};

/** DELETE /api/teams/:teamId — admin only. */
export const deleteTeam = async (req: Request, res: Response) => {
    const teamId = req.params.teamId as string;
    const access = await getTeamAccess(req.user!.userId, teamId);
    if (access.access !== "admin") throw ApiError.forbidden("Only workspace admins can delete teams");

    await prisma.team.delete({ where: { id: teamId } });
    res.json({ message: "Team deleted" });
};

/** POST /api/teams/:teamId/members — leads may add members; only admins may add leads. */
export const addTeamMember = async (req: Request, res: Response) => {
    const teamId = req.params.teamId as string;
    const access = await getTeamAccess(req.user!.userId, teamId);
    if (!canManage(access.access)) throw ApiError.forbidden("Only admins and team leads can add members");

    const { memberId, role } = addSeatSchema.parse(req.body);
    if (role === ScopeRole.lead && access.access !== "admin") {
        throw ApiError.forbidden("Only workspace admins can appoint team leads");
    }
    await assertMembersInWorkspace([memberId], access.workspaceId);

    const seat = await prisma.teamMember.create({
        data: { teamId, memberId, role },
        select: { role: true, joinedAt: true, member: { select: memberSummarySelect } },
    });
    res.status(201).json({ member: { ...serializeMember(seat.member), teamRole: seat.role, joinedAt: seat.joinedAt } });
};

/** PATCH /api/teams/:teamId/members/:memberId — promote/demote; admin only. */
export const updateTeamMember = async (req: Request, res: Response) => {
    const teamId = req.params.teamId as string;
    const memberId = req.params.memberId as string;
    const access = await getTeamAccess(req.user!.userId, teamId);
    if (access.access !== "admin") throw ApiError.forbidden("Only workspace admins can change team roles");

    const { role } = updateSeatSchema.parse(req.body);
    const seat = await prisma.teamMember.update({
        where: { teamId_memberId: { teamId, memberId } },
        data: { role },
        select: { role: true, joinedAt: true, member: { select: memberSummarySelect } },
    });
    res.json({ member: { ...serializeMember(seat.member), teamRole: seat.role, joinedAt: seat.joinedAt } });
};

/** DELETE /api/teams/:teamId/members/:memberId — leads can't remove other leads. */
export const removeTeamMember = async (req: Request, res: Response) => {
    const teamId = req.params.teamId as string;
    const memberId = req.params.memberId as string;
    const access = await getTeamAccess(req.user!.userId, teamId);
    if (!canManage(access.access)) throw ApiError.forbidden("Only admins and team leads can remove members");

    const seat = await prisma.teamMember.findUnique({
        where: { teamId_memberId: { teamId, memberId } },
        select: { role: true },
    });
    if (!seat) throw ApiError.notFound("That person is not on this team");
    if (seat.role === ScopeRole.lead && access.access !== "admin") {
        throw ApiError.forbidden("Only workspace admins can remove a team lead");
    }

    await prisma.teamMember.delete({ where: { teamId_memberId: { teamId, memberId } } });
    res.json({ message: "Removed from team" });
};
