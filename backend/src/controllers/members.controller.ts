import { Request, Response } from "express";
import { PrismaClient, UserRole } from "@prisma/client";
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

        // Check if user account already exists for this email
        let memberUser = await prisma.user.findUnique({
            where: { email: validatedData.email },
        });

        // Create user account if it doesn't exist
        if (!memberUser) {
            const hashedPassword = await hashPassword(DEFAULT_PASSWORD);

            memberUser = await prisma.user.create({
                data: {
                    email: validatedData.email,
                    password: hashedPassword,
                    name: validatedData.name,
                    role: UserRole.member,
                    isPasswordReset: true, // Flag to indicate password needs to be changed
                },
            });

            // Send credentials email (optional)
            await sendMemberCredentials(
                validatedData.email,
                validatedData.name,
                DEFAULT_PASSWORD
            );
        }

        // Create member record
        const member = await prisma.member.create({
            data: {
                role: validatedData.role,
                email: validatedData.email,
                userId: memberUser.id,
                createdAt: new Date(),
                createdById: req.user.userId,
            },
        });
        const memberData = { ...member, name: memberUser.name };

        console.log("Member created :", member);
        res.status(201).json({
            memberData,
            message: `Member added successfully. Login credentials sent to ${validatedData.email}. Default password: ${DEFAULT_PASSWORD}`,
        });
    } catch (error: any) {
        console.error("Create member error:", error);
        if (error.name === "ZodError") {
            res.status(400).json({ message: "Invalid input", errors: error.errors });
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
            where: { id: memberId! }, // ✅ was: { id: memberId }
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

        const member = await prisma.member.findUnique({ where: { id: memberId } });
        if (!member) {
            res.status(404).json({ message: "Member not found" });
            return;
        }

        await prisma.member.delete({ where: { id: memberId } });

        res.json({ message: "Member deleted successfully", memberId });
    } catch (error) {
        console.error("Delete member error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}
