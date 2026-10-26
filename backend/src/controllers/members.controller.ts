import { Request, Response } from "express";
import { PrismaClient, UserRole, OrgRole, Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { createMemberSchema } from "../validation/memberValidation";
import { sendMemberInvite } from "../utils/email";
import { INVITE_TOKEN_TTL_MS, issuePasswordToken } from "../utils/passwordToken";

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
        let invited = false;
        let inviteEmailed = false;

        // Create the user account only if it's new. It has no password at all:
        // a known starting password would let anyone who knows the address in
        // before its owner. They choose one from the invite link instead.
        if (!memberUser) {
            memberUser = await prisma.user.create({
                data: {
                    email,
                    password: null,
                    name: validatedData.name,
                    role: UserRole.member,
                    isPasswordReset: true, // still has to choose a password
                },
                include: { members: { select: { id: true, workspaceId: true } } },
            });

            // Look up the admin so the invite is sent *from* them
            // (From/Reply-To), not the generic relay sender.
            const admin = await prisma.user.findUnique({
                where: { id: req.user.userId },
                select: { name: true, email: true },
            });

            // Choosing a password from this link also confirms the address.
            // Sending never throws, so a mail outage can't block member
            // creation; it's reported back in the response message.
            invited = true;
            const inviteToken = await issuePasswordToken(memberUser.id, INVITE_TOKEN_TTL_MS);
            inviteEmailed = await sendMemberInvite(
                email,
                validatedData.name,
                inviteToken,
                INVITE_TOKEN_TTL_MS / 86_400_000,
                admin?.email ?? req.user.email,
                admin?.name
            );
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
            message: !invited
                ? "Member added successfully."
                : inviteEmailed
                  ? `Member added. We emailed ${email} a link to choose their password.`
                  : `Member added, but the invite email couldn't be sent. Ask them to use "Forgot password" on the sign-in page.`,
        });
    } catch (error) {
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
