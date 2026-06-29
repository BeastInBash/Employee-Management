import type { Request, Response } from 'express'
import { OrgRole, PrismaClient } from '@prisma/client';
import z from 'zod';
import { getMyOrgQuerySchema, getOrgQueryschema } from '../validation/orgValidation';
import ApiError from '../utils/errors/ApiError';

const prisma = new PrismaClient();
const createOrgSchema = z.object({ name: z.string().trim().min(2, "Name is Required") })
export const createOrganization = async (req: Request, res: Response) => {
    // Create Organization for the current loggedin user and make it owner
    const { name } = createOrgSchema.parse(req.body)
    const { userId } = req?.user!
    const result = await prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
            data: {
                name,
                ownerId: userId
            }
        });
        const membership = await tx.orgMembership.create({
            data: {
                userId: organization.ownerId,
                orgId: organization.id,
                role: OrgRole.owner
            }
        })
        return {
            organization, membership
        }
    })

    res.json({
        status: 200,
        message: "Organization Created",
        result
    })
}

export const getMyOrganization = async (req: Request, res: Response) => {
    const { userId } = req.user!
    const { membership, workspace } = getMyOrgQuerySchema.parse(req.query)
    // Orgs the caller owns OR is a member of (a user can belong to orgs they don't own).
    const allOrgs = await prisma.organization.findMany({
        where: {
            OR: [
                { ownerId: userId },
                { memberships: { some: { userId } } }
            ]
        }, include: {
            memberships: membership,
            workspaces: workspace
        }
    })
    res.json({
        status: 200,
        message: "Your Organizations",
        allOrgs

    })
}

export const getOrgById = async (req: Request, res: Response) => {
    const { userId } = req.user!
    const { orgId, membership, workspace } = getOrgQueryschema.parse(req.query)
    const org = await prisma.organization.findFirst({
        where: {
            id: orgId as string
        },
        include: {
            memberships: membership,
            workspaces: workspace

        }

    })
    if (!org) throw ApiError.notFound("Organization not found")

    // Only the owner or a member of the org may read it (and its memberships/workspaces).
    const isOwner = org.ownerId === userId
    if (!isOwner) {
        const callerMembership = await prisma.orgMembership.findUnique({
            where: { userId_orgId: { userId, orgId: orgId as string } }
        })
        if (!callerMembership) throw ApiError.forbidden("You do not have access to this organization")
    }

    res.json({
        status: 200,
        message: "Fetch Successfull",
        org
    })
}
