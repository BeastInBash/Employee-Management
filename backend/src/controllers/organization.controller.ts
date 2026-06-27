import type { Request, Response } from 'express'
import ApiError from '../utils/errors/ApiError'
import { OrgRole, PrismaClient } from '@prisma/client';
import z from 'zod';

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
    const allOrgs = await prisma.organization.findMany({
        where: {
            ownerId: userId
        }, include: {
            memberships: true,
            workspaces: true
        }
    })
    res.json({
        status: 200,
        message: "Your Organizations",
        allOrgs

    })
}

export const getOrgById = async (req: Request, res: Response) => {
    const { orgId, membership, workspace } = req.query
    const includeMembership = membership == "true"
    const includeWorkspaces = workspace == "true"
    const org = await prisma.organization.findFirst({
        where: {
            id: orgId as string
        },
        include: {
            memberships: includeMembership,
            workspaces: includeWorkspaces

        }

    })
    res.json({
        status: 200,
        message: "Fetch Successfull",
        org
    })
}
