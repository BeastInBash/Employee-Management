import { Request, Response } from "express";
import { PrismaClient, UserRole, OrgRole, Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { createMemberSchema } from "../validation/memberValidation";
import { hashPassword, DEFAULT_PASSWORD } from "../utils/password";
import { sendMemberCredentials } from "../utils/email";

const prisma = new PrismaClient();

export async function createMember(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Authentication required" });
            return;
        }

        // Only admins can create members
        if (req.user.role !== UserRole.admin) {
            res.status(403).json({ message: "Only admins can add members" });
            return;
        }

        const validatedData = createMemberSchema.parse(req.body);
        const email = validatedData.email.trim().toLowerCase();

        // The target workspace must exist and the admin must own (or be an
        // owner/admin of) the org it belongs to — otherwise they can't add
        // members to it.
        const workspace = await prisma.workspace.findUnique({
            where: { id: validatedData.workspaceId },
            include: { org: { select: { id: true, ownerId: true } } },
        });

        if (!workspace) {
            res.status(404).json({ message: "Workspace not found" });
            return;
        }

        let authorized = workspace.org.ownerId === req.user.userId;
        if (!authorized) {
            const orgMembership = await prisma.orgMembership.findUnique({
                where: { userId_orgId: { userId: req.user.userId, orgId: workspace.org.id } },
            });
            authorized =
                !!orgMembership &&
                (orgMembership.role === OrgRole.owner || orgMembership.role === OrgRole.admin);
        }

        if (!authorized) {
            res.status(403).json({ message: "You don't have access to this workspace" });
            return;
        }

        // Check if a user account already exists for this email
        const existingUser = await prisma.user.findUnique({
            where: { email },
            include: { members: { select: { id: true, workspaceId: true } } },
        });

        // Don't let an existing admin account be repurposed as a member, and
        // don't silently no-op when the person is already a member of *this*
        // workspace (they may legitimately belong to other workspaces).
        if (existingUser) {
            if (existingUser.role === UserRole.admin) {
                res.status(409).json({
                    message: "This email belongs to an admin account and cannot be added as a member",
                });
                return;
            }
            if (existingUser.members.some((m) => m.workspaceId === validatedData.workspaceId)) {
                res.status(409).json({ message: "This person is already a member of this workspace" });
                return;
            }
        }

        let memberUser = existingUser;
        let credentialsEmailed = false;

        // Create the user account (with a default password) only if it's new.
        if (!memberUser) {
            const hashedPassword = await hashPassword(DEFAULT_PASSWORD);

            memberUser = await prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name: validatedData.name,
                    role: UserRole.member,
                    isPasswordReset: true, // Flag to indicate password needs to be changed
                },
                include: { members: { select: { id: true, workspaceId: true } } },
            });

            // Look up the admin so the credentials email is sent *from* them
            // (From/Reply-To), not the generic relay sender.
            const admin = await prisma.user.findUnique({
                where: { id: req.user.userId },
                select: { name: true, email: true },
            });

            // Email the credentials. sendMemberCredentials swallows its own
            // errors so a mail outage never blocks member creation.
            await sendMemberCredentials(
                email,
                validatedData.name,
                DEFAULT_PASSWORD,
                admin?.email ?? req.user.email,
                admin?.name
            );
            credentialsEmailed = true;
        }

        // Create the member record
        const member = await prisma.member.create({
            data: {
                role: validatedData.role,
                email,
                userId: memberUser.id,
                workspaceId: validatedData.workspaceId,
                createdById: req.user.userId,
            },
        });
        const memberData = { ...member, name: memberUser.name };

        res.status(201).json({
            memberData,
            message: credentialsEmailed
                ? `Member added successfully. Login credentials were emailed to ${email}.`
                : "Member added successfully.",
        });
    } catch (error: any) {
        console.error("Create member error:", error);
        if (error instanceof ZodError) {
            res.status(400).json({ message: "Invalid input", errors: error.issues });
            return;
        }
        // Unique-constraint race (e.g. the same member created twice concurrently)
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
        ) {
            res.status(409).json({ message: "This person is already a member" });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function getMembers(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Authentication required" });
            return;
        }

        let members;

        if (req.user.role === UserRole.admin) {
            members = await prisma.member.findMany({
                where: { createdById: req.user.userId },
                orderBy: { createdAt: "desc" },
                include: {
                    user: {
                        select: {
                            name: true,
                        },
                    },
                },
            });
        } else {
            members = await prisma.member.findMany({
                where: { userId: req.user.userId },
                orderBy: { createdAt: "desc" },
            });
        }

        res.json({ members });
    } catch (error) {
        console.error("Get members error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function getMember(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Authentication required" });
            return;
        }

        if (req.user.role !== UserRole.admin) {
            res.status(403).json({ message: "Access denied" });
            return;
        }
        console.log("Params", req.params)
        const { memberId } = req.params;

        const member = await prisma.member.findUnique({
            where: { id: memberId! as string}, // ✅ was: { id: memberId }
            include: { user: { select: { name: true } } },
        });
        console.log("Memeber data", member)
        if (!member) {
            res.status(404).json({ message: "Member not found" });
            return;
        }

        res.json({ member });
    } catch (error) {
        console.error("Get member error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function deleteMember(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Authentication required" });
            return;
        }

        // Only admins can delete members
        if (req.user.role !== UserRole.admin) {
            res.status(403).json({ message: "Only admins can delete members" });
            return;
        }

        const { memberId } = req.params;
        if (!memberId) {
            res.status(400).json({ message: "Member ID is required" });
            return;
        }

        const member = await prisma.member.findUnique({
            where: { id: memberId as string},
            include: { user: { select: { id: true, role: true } } },
        });
        if (!member) {
            res.status(404).json({ message: "Member not found" });
            return;
        }

        // Only the admin who created the member may delete them.
        if (member.createdById !== req.user.userId) {
            res.status(403).json({ message: "You can only delete members you created" });
            return;
        }

        // Remove the login as well so a deleted member can't authenticate into a
        // member-less account. Deleting the (member-role) user cascades to the
        // member row, its tasks and attendance. Guard against ever deleting an
        // admin user this way.
        if (member.user.role === UserRole.member) {
            await prisma.user.delete({ where: { id: member.user.id } });
        } else {
            await prisma.member.delete({ where: { id: memberId as string } });
        }

        res.json({ message: "Member deleted successfully", memberId });
    } catch (error) {
        console.error("Delete member error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}
