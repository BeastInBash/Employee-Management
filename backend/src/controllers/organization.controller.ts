import type { Request, Response } from 'express'
import { OrgRole, PrismaClient } from '@prisma/client';
import z from 'zod';
import { getMyOrgQuerySchema, getOrgQueryschema } from '../validation/orgValidation';

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
    const allOrgs = await prisma.organization.findMany({
        where: {
            ownerId: userId
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
    res.json({
        status: 200,
        message: "Fetch Successfull",
        org
    })
}
