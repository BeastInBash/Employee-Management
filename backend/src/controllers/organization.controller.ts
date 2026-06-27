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

