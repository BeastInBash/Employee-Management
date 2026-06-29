import { OrgRole, PrismaClient } from '@prisma/client'
import type { Request, Response } from 'express'
import ApiError from '../utils/errors/ApiError'

const prisma = new PrismaClient()

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









