import { OrgRole, PrismaClient, UserRole } from '@prisma/client'
import type { Request, Response } from 'express'
import ApiError from '../utils/errors/ApiError'
import { updateTaskWindowSchema } from '../validation/workspaceValidation'
import {
    parseTimeString,
    serializeTaskWindow,
    toTaskWindow,
    DEFAULT_TASK_WINDOW_START,
    DEFAULT_TASK_WINDOW_END,
} from '../utils/attendance'
import { assertWorkspaceParticipant } from '../utils/access'

const prisma = new PrismaClient()

const taskWindowSelect = {
    id: true,
    name: true,
    orgId: true,
    taskWindowEnabled: true,
    taskWindowStart: true,
    taskWindowEnd: true,
} as const

export const createWorkspace = async (req: Request, res: Response) => {
    const { workspaceName } = req.body
    const orgId = req.params.orgId as string
    const { userId } = req.user!

    if (!orgId) throw ApiError.badRequest("orgId is required")
    if (typeof workspaceName !== 'string' || workspaceName.trim().length < 2) {
        throw ApiError.badRequest("workspaceName is required")
    }

    // Org must exist, and the caller must be its owner or an org owner/admin.
    const org = await prisma.organization.findUnique({ where: { id: orgId } })
    if (!org) throw ApiError.notFound("Organization not found")

    const isOwner = org.ownerId === userId
    if (!isOwner) {
        const membership = await prisma.orgMembership.findUnique({
            where: { userId_orgId: { userId, orgId } }
        })
        const canManage = membership?.role === OrgRole.owner || membership?.role === OrgRole.admin
        if (!canManage) throw ApiError.forbidden("You cannot add workspaces to this organization")
    }

    // Create the workspace and grant the creator a membership, mirroring createOrganization.
    const result = await prisma.$transaction(async (tx) => {
        const workspace = await tx.workspace.create({
            data: {
                name: workspaceName.trim(),
                orgId,
            }
        })
        const membership = await tx.workspaceMembership.create({
            data: {
                userId,
                workspaceId: workspace.id,
            }
        })
        return { workspace, membership }
    })

    res.json({
        status: 200,
        message: "Workspace created",
        result
    })
}

/**
 * Read the workspace's task submission window. Anyone who belongs to the
 * workspace (as a permission membership or as a domain Member seat) may read it
 * — members need it to know whether their "Add task" button should work.
 */
export const getTaskWindow = async (req: Request, res: Response) => {
    const workspaceId = req.params.workspaceId as string
    const { userId } = req.user!

    if (!workspaceId) throw ApiError.badRequest("workspaceId is required")

    const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: taskWindowSelect,
    })
    if (!workspace) throw ApiError.notFound("Workspace not found")

    const canView = await canViewWorkspace(userId, workspace.id, workspace.orgId)
    if (!canView) throw ApiError.forbidden("You do not have access to this workspace")

    res.json({
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        taskWindow: serializeTaskWindow(toTaskWindow(workspace)),
    })
}

/**
 * Turn the submission window on/off and set its hours. Admin-only: the caller
 * must own the org or be one of its owner/admin members.
 */
export const updateTaskWindow = async (req: Request, res: Response) => {
    const workspaceId = req.params.workspaceId as string
    const { userId, role } = req.user!

    if (!workspaceId) throw ApiError.badRequest("workspaceId is required")
    if (role !== UserRole.admin) throw ApiError.forbidden("Admin access required")

    const parsed = updateTaskWindowSchema.parse(req.body)

    const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: taskWindowSelect,
    })
    if (!workspace) throw ApiError.notFound("Workspace not found")

    await assertCanManageOrg(userId, workspace.orgId, "You cannot change this workspace's settings")

    // Keep the previously configured hours when the admin only flips the toggle.
    const startMinute = parsed.startTime
        ? parseTimeString(parsed.startTime) ?? DEFAULT_TASK_WINDOW_START
        : workspace.taskWindowStart
    const endMinute = parsed.endTime
        ? parseTimeString(parsed.endTime) ?? DEFAULT_TASK_WINDOW_END
        : workspace.taskWindowEnd

    const updated = await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
            taskWindowEnabled: parsed.enabled,
            taskWindowStart: startMinute,
            taskWindowEnd: endMinute,
        },
        select: taskWindowSelect,
    })

    res.json({
        status: 200,
        message: parsed.enabled
            ? "Task submission window updated"
            : "Task submission window removed — members can submit anytime",
        workspaceId: updated.id,
        workspaceName: updated.name,
        taskWindow: serializeTaskWindow(toTaskWindow(updated)),
    })
}

/**
 * Everyone with a Member seat in the workspace, with the teams they're on.
 * Any participant may read it — leads need it to pick people for their
 * project/team; the ids returned are **Member** ids.
 */
export const listWorkspaceMembers = async (req: Request, res: Response) => {
    const workspaceId = req.params.workspaceId as string
    await assertWorkspaceParticipant(req.user!.userId, workspaceId)

    const members = await prisma.member.findMany({
        where: { workspaceId },
        select: {
            id: true,
            userId: true,
            email: true,
            role: true,
            user: { select: { name: true } },
            teams: { select: { role: true, team: { select: { id: true, name: true, color: true } } } },
        },
        orderBy: { createdAt: 'asc' },
    })

    res.json({
        members: members.map((m) => ({
            id: m.id,
            userId: m.userId,
            name: m.user.name,
            email: m.email,
            jobTitle: m.role,
            teams: m.teams.map((t) => ({ ...t.team, role: t.role })),
        })),
    })
}

// ─── helpers ────────────────────────────────────────────────────────────────

/** Throws unless the user owns the org or is an owner/admin member of it. */
async function assertCanManageOrg(userId: string, orgId: string, message: string): Promise<void> {
    const org = await prisma.organization.findUnique({ where: { id: orgId } })
    if (!org) throw ApiError.notFound("Organization not found")
    if (org.ownerId === userId) return

    const membership = await prisma.orgMembership.findUnique({
        where: { userId_orgId: { userId, orgId } },
    })
    if (membership?.role === OrgRole.owner || membership?.role === OrgRole.admin) return

    throw ApiError.forbidden(message)
}

/** Org owner/admin, a workspace membership, or a member seat all count as access. */
async function canViewWorkspace(userId: string, workspaceId: string, orgId: string): Promise<boolean> {
    const [org, workspaceMembership, memberSeat, orgMembership] = await Promise.all([
        prisma.organization.findUnique({ where: { id: orgId }, select: { ownerId: true } }),
        prisma.workspaceMembership.findUnique({
            where: { userId_workspaceId: { userId, workspaceId } },
            select: { id: true },
        }),
        prisma.member.findFirst({ where: { userId, workspaceId }, select: { id: true } }),
        prisma.orgMembership.findUnique({
            where: { userId_orgId: { userId, orgId } },
            select: { role: true },
        }),
    ])

    return (
        org?.ownerId === userId ||
        !!workspaceMembership ||
        !!memberSeat ||
        orgMembership?.role === OrgRole.owner ||
        orgMembership?.role === OrgRole.admin
    )
}









