import { OrgRole, PrismaClient, ScopeRole } from "@prisma/client";
import ApiError from "./errors/ApiError";

const prisma = new PrismaClient();

/**
 * Who the caller is relative to a workspace-scoped resource (project / team):
 *  - `admin`  — owns the org, or is an owner/admin OrgMembership of it
 *  - `lead`   — holds a lead seat on the project/team
 *  - `member` — participates (directly, or via an assigned team for projects)
 *  - `null`   — no relationship
 */
export type ScopeAccess = "admin" | "lead" | "member" | null;

export interface WorkspaceAccess {
    workspaceId: string;
    orgId: string;
    isAdmin: boolean;
    /** The caller's Member seat in this workspace, if any. */
    memberId: string | null;
}

/** True when the user owns the org or is an owner/admin member of it. */
export async function isOrgAdmin(userId: string, orgId: string): Promise<boolean> {
    const [org, membership] = await Promise.all([
        prisma.organization.findUnique({ where: { id: orgId }, select: { ownerId: true } }),
        prisma.orgMembership.findUnique({
            where: { userId_orgId: { userId, orgId } },
            select: { role: true },
        }),
    ]);
    return org?.ownerId === userId || membership?.role === OrgRole.owner || membership?.role === OrgRole.admin;
}

/** Resolve the caller's standing in a workspace. Throws 404 for unknown workspaces. */
export async function getWorkspaceAccess(userId: string, workspaceId: string): Promise<WorkspaceAccess> {
    const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, orgId: true },
    });
    if (!workspace) throw ApiError.notFound("Workspace not found");

    const [isAdmin, seat] = await Promise.all([
        isOrgAdmin(userId, workspace.orgId),
        prisma.member.findFirst({ where: { userId, workspaceId }, select: { id: true } }),
    ]);

    return { workspaceId, orgId: workspace.orgId, isAdmin, memberId: seat?.id ?? null };
}

/** Throws 403 unless the caller is an admin of the workspace or holds a seat in it. */
export async function assertWorkspaceParticipant(userId: string, workspaceId: string): Promise<WorkspaceAccess> {
    const access = await getWorkspaceAccess(userId, workspaceId);
    if (!access.isAdmin && !access.memberId) {
        throw ApiError.forbidden("You do not have access to this workspace");
    }
    return access;
}

export interface ProjectAccess extends WorkspaceAccess {
    projectId: string;
    access: ScopeAccess;
}

/** Resolve the caller's standing on a project. Throws 404 for unknown projects. */
export async function getProjectAccess(userId: string, projectId: string): Promise<ProjectAccess> {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, workspaceId: true },
    });
    if (!project) throw ApiError.notFound("Project not found");

    const ws = await getWorkspaceAccess(userId, project.workspaceId);
    if (ws.isAdmin) return { ...ws, projectId, access: "admin" };
    if (!ws.memberId) return { ...ws, projectId, access: null };

    const [seat, viaTeam] = await Promise.all([
        prisma.projectMember.findUnique({
            where: { projectId_memberId: { projectId, memberId: ws.memberId } },
            select: { role: true },
        }),
        prisma.projectTeam.findFirst({
            where: { projectId, team: { members: { some: { memberId: ws.memberId } } } },
            select: { teamId: true },
        }),
    ]);

    let access: ScopeAccess = null;
    if (seat?.role === ScopeRole.lead) access = "lead";
    else if (seat || viaTeam) access = "member";

    return { ...ws, projectId, access };
}

export interface TeamAccess extends WorkspaceAccess {
    teamId: string;
    access: ScopeAccess;
}

/** Resolve the caller's standing on a team. Throws 404 for unknown teams. */
export async function getTeamAccess(userId: string, teamId: string): Promise<TeamAccess> {
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { id: true, workspaceId: true },
    });
    if (!team) throw ApiError.notFound("Team not found");

    const ws = await getWorkspaceAccess(userId, team.workspaceId);
    if (ws.isAdmin) return { ...ws, teamId, access: "admin" };
    if (!ws.memberId) return { ...ws, teamId, access: null };

    const seat = await prisma.teamMember.findUnique({
        where: { teamId_memberId: { teamId, memberId: ws.memberId } },
        select: { role: true },
    });

    let access: ScopeAccess = null;
    if (seat?.role === ScopeRole.lead) access = "lead";
    else if (seat) access = "member";

    return { ...ws, teamId, access };
}

export const canManage = (access: ScopeAccess) => access === "admin" || access === "lead";

/**
 * Member ids that may be assigned work on a project: direct project members plus
 * everyone on an assigned team.
 */
export async function getProjectParticipantIds(projectId: string): Promise<Set<string>> {
    const [direct, viaTeams] = await Promise.all([
        prisma.projectMember.findMany({ where: { projectId }, select: { memberId: true } }),
        prisma.teamMember.findMany({
            where: { team: { projects: { some: { projectId } } } },
            select: { memberId: true },
        }),
    ]);
    return new Set([...direct, ...viaTeams].map((m) => m.memberId));
}

/** Throws 400 unless every id is a Member seat in the given workspace. */
export async function assertMembersInWorkspace(memberIds: string[], workspaceId: string): Promise<void> {
    const unique = [...new Set(memberIds)];
    if (unique.length === 0) return;
    const found = await prisma.member.count({ where: { id: { in: unique }, workspaceId } });
    if (found !== unique.length) {
        throw ApiError.badRequest("One or more members do not belong to this workspace");
    }
}

/** True when the caller leads the project a task belongs to (or admins its workspace). */
export async function canLeadTaskProject(userId: string, projectId: string | null): Promise<boolean> {
    if (!projectId) return false;
    const { access } = await getProjectAccess(userId, projectId);
    return canManage(access);
}
