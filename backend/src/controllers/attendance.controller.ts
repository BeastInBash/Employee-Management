import { Request, Response } from "express";
import { PrismaClient, AttendanceStatus } from "@prisma/client";
import {
    isWithinTaskSubmissionWindow,
    isAfterCompletionDeadline,
    formatDateOnly,
    getTodayISTDate,
} from "../utils/attendance";

const prisma = new PrismaClient();

export async function getMyAttendance(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Authentication required" });
            return;
        }

        const member = await prisma.member.findFirst({
            where: { userId: req.user.userId },
        });

        if (!member) {
            res.status(404).json({ message: "Member not found" });
            return;
        }

        const targetMonth = req.query.month ? parseInt(req.query.month as string, 10) - 1 : new Date().getMonth();
        const targetYear = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear();

        const startDate = new Date(targetYear, targetMonth, 1);
        const endDate = new Date(targetYear, targetMonth + 1, 0);

        const attendance = await prisma.dailyAttendance.findMany({
            where: {
                memberId: member.id,
                date: { gte: startDate, lte: endDate },
            },
            orderBy: { date: "asc" },
        });

        const summary = {
            present: attendance.filter((a) => a.status === AttendanceStatus.present).length,
            absent: attendance.filter((a) => a.status === AttendanceStatus.absent).length,
            partial: attendance.filter((a) => a.status === AttendanceStatus.partial).length,
            total: attendance.length,
        };

        res.json({ attendance, summary });
    } catch (error) {
        console.error("Get my attendance error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function getMemberAttendanceReport(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Authentication required" });
            return;
        }

        const { memberId } = req.params;
        if (typeof memberId !== "string") {
            res.status(400).json({ message: "Member ID is required" });
            return;
        }
        const member = await prisma.member.findFirst({
            where: {
                OR : [
                    {id: memberId },
                    {userId: memberId }
                ]
            },
            include: { user: { select: { name: true, email: true } } },
        });

        console.log("Memeber", member)
        if (!member) {
            res.status(404).json({ message: "Member not found" });
            return;
        }

        const dateFilter = buildDateFilter(req.query);

        const attendance = await prisma.dailyAttendance.findMany({
            where: { memberId: member.id, date: dateFilter },
            orderBy: { date: "asc" },
        });

        const presentCount = attendance.filter((a) => a.status === AttendanceStatus.present).length;

        res.json({
            member: { id: member.id, name: member.user.name, email: member.email },
            attendance,
            summary: {
                present: presentCount,
                absent: attendance.filter((a) => a.status === AttendanceStatus.absent).length,
                partial: attendance.filter((a) => a.status === AttendanceStatus.partial).length,
                total: attendance.length,
                attendancePercentage:
                    attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : 0,
            },
        });
    } catch (error) {
        console.error("Get member attendance report error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function getAllMembersAttendanceReport(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Authentication required" });
            return;
        }

        const dateFilter = buildDateFilter(req.query);

        const members = await prisma.member.findMany({
            where: { createdById: req.user.userId },
            include: {
                user: { select: { name: true } },
                attendance: {
                    where: { date: dateFilter },
                    orderBy: { date: "asc" },
                },
            },
        });

        const report = members.map((member) => {
            const { attendance } = member;
            const presentCount = attendance.filter((a) => a.status === AttendanceStatus.present).length;
            return {
                member: { id: member.id, name: member.user.name, email: member.email },
                summary: {
                    present: presentCount,
                    absent: attendance.filter((a) => a.status === AttendanceStatus.absent).length,
                    partial: attendance.filter((a) => a.status === AttendanceStatus.partial).length,
                    total: attendance.length,
                    attendancePercentage:
                        attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : 0,
                },
                attendance,
            };
        });

        res.json({ report, generatedAt: new Date() });
    } catch (error) {
        console.error("Get all members attendance report error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function getTodayAttendanceOverview(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Authentication required" });
            return;
        }

        const today = getTodayISTDate();

        const allMembers = await prisma.member.findMany({
            where: { createdById: req.user.userId },
            include: {
                user: { select: { name: true } },
                attendance: {
                    where: { date: today },
                },
            },
        });

        const overview = allMembers.map((member) => {
            const record = member.attendance[0] ?? null;
            return {
                member: { id: member.id, name: member.user.name, email: member.email },
                status: record?.status ?? AttendanceStatus.absent,
                taskSubmittedAt: record?.taskSubmittedAt ?? null,
                allTasksCompletedAt: record?.allTasksCompletedAt ?? null,
            };
        });

        res.json({
            date: formatDateOnly(new Date()),
            submissionWindowOpen: isWithinTaskSubmissionWindow(),
            completionDeadlinePassed: isAfterCompletionDeadline(),
            overview,
        });
    } catch (error) {
        console.error("Get today attendance overview error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function buildDateFilter(query: Request["query"]): { gte: Date; lte: Date } {
    if (query.startDate && query.endDate) {
        return {
            gte: new Date(query.startDate as string),
            lte: new Date(query.endDate as string),
        };
    }

    const targetMonth = query.month ? parseInt(query.month as string, 10) - 1 : new Date().getMonth();
    const targetYear = query.year ? parseInt(query.year as string, 10) : new Date().getFullYear();

    return {
        gte: new Date(targetYear, targetMonth, 1),
        lte: new Date(targetYear, targetMonth + 1, 0),
    };
}
