import { Request, Response } from "express";
import { PrismaClient, UserRole, TaskStatus, AttendanceStatus } from "@prisma/client";
import { createTaskSchema, updateTaskSchema } from "../validation/taskValidation";
import { isWithinTaskSubmissionWindow, getTodayISTDate } from "../utils/attendance";

const prisma = new PrismaClient();

export async function createTask(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Authentication required" });
            return;
        }

        const validatedData = createTaskSchema.parse(req.body);

        let memberId: string;

        if (req.user.role === UserRole.member) {
            if (!isWithinTaskSubmissionWindow()) {
                res.status(403).json({
                    message: "Tasks can only be submitted between 9:00 AM and 11:00 AM IST",
                });
                return;
            }

            const member = await prisma.member.findFirst({
                where: { userId: req.user.userId },
                select: { id: true },
            });

            if (!member) {
                res.status(404).json({ message: "Member not found" });
                return;
            }

            memberId = member.id;
        } else {
            if (!validatedData.userId) {
                res.status(400).json({ message: "userId is required for admin created tasks" });
                return;
            }

            const member = await prisma.member.findFirst({
                where: { userId: validatedData.userId },
                select: { id: true },
            });

            if (!member) {
                res.status(404).json({ message: "Member not found" });
                return;
            }

            memberId = member.id;
        }

        const task = await prisma.task.create({
            data: {
                title: validatedData.title,
                description: validatedData.description,
                status: validatedData.status ?? TaskStatus.todo,
                priority: validatedData.priority,
                dueDate: new Date(validatedData.dueDate),
                memberId,
            },
        });

        if (req.user.role === UserRole.member) {
            const today = getTodayISTDate();
            await prisma.dailyAttendance.upsert({
                where: { memberId_date: { memberId, date: today } },
                update: {},
                create: {
                    memberId,
                    date: today,
                    status: AttendanceStatus.absent,
                    taskSubmittedAt: new Date(),
                },
            });
        }

        res.status(201).json(task);
    } catch (error: unknown) {
        console.error("Create task error:", error);
        if (isZodError(error)) {
            res.status(400).json({ message: "Invalid input", errors: error.errors });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function getMemberTasks(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Authentication required" });
            return;
        }

        const { userId } = req.params;
        if (typeof userId !== "string") {
            res.status(400).json({ message: "User ID is required" });
            return;
        }

        const member = await prisma.member.findFirst({
            where: { userId },
            select: { id: true },
        });

        if (!member) {
            res.status(404).json({ message: "Member not found" });
            return;
        }

        const tasks = await prisma.task.findMany({
            where: { memberId: member.id },
            orderBy: { createdAt: "desc" },
        });

        res.json({ tasks });
    } catch (error) {
        console.error("Get member tasks error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function updateTask(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Authentication required" });
            return;
        }

        const taskId = req.params["taskId"];
        if (typeof taskId !== "string") {
            res.status(400).json({ message: "Task ID is required" });
            return;
        }

        const validatedData = updateTaskSchema.parse(req.body);

        const existingTask = await prisma.task.findUnique({
            where: { id: taskId },
            select: {
                status: true,
                memberId: true,
                member: { select: { id: true, email: true } },
            },
        });

        if (!existingTask) {
            res.status(404).json({ message: "Task not found" });
            return;
        }

        if (
            req.user.role !== UserRole.admin &&
            existingTask.member.email !== req.user.email
        ) {
            res.status(403).json({ message: "You can only update your own tasks" });
            return;
        }

        const isBeingCompleted =
            validatedData.status === TaskStatus.completed &&
            existingTask.status !== TaskStatus.completed;

        const task = await prisma.task.update({
            where: { id: taskId },
            data: {
                ...(validatedData.title !== undefined && { title: validatedData.title }),
                ...(validatedData.description !== undefined && { description: validatedData.description }),
                ...(validatedData.status !== undefined && { status: validatedData.status }),
                ...(validatedData.priority !== undefined && { priority: validatedData.priority }),
                ...(validatedData.dueDate !== undefined && { dueDate: new Date(validatedData.dueDate) }),
                ...(isBeingCompleted && { completedAt: new Date() }),
            },
        });

        // ✅ Removed role check — always run for any completed task
        // The member.id is always valid here since it came from the task itself
        if (isBeingCompleted) {
            await checkAndMarkPresent(existingTask.memberId);
        }

        res.json(task);
    } catch (error: unknown) {
        console.error("Update task error:", error);
        if (isZodError(error)) {
            res.status(400).json({ message: "Invalid input", errors: error.errors });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function deleteTask(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Authentication required" });
            return;
        }

        if (req.user.role !== UserRole.admin) {
            res.status(403).json({ message: "Only admins can delete tasks" });
            return;
        }

        const taskId = req.params["taskId"];
        if (typeof taskId !== "string") {
            res.status(400).json({ message: "Task ID is required" });
            return;
        }

        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: { id: true },
        });

        if (!task) {
            res.status(404).json({ message: "Task not found" });
            return;
        }

        await prisma.task.delete({ where: { id: taskId } });

        res.json({ message: "Task deleted successfully" });
    } catch (error) {
        console.error("Delete task error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

// ─── helpers ────────────────────────────────────────────────────────────────

async function checkAndMarkPresent(memberId: string): Promise<void> {
    const today = getTodayISTDate();
    const tomorrow = new Date(today.getTime() + 86400000);

    console.log(`[attendance] checking member ${memberId} | range: ${today.toISOString()} → ${tomorrow.toISOString()}`);

    const todaysTasks = await prisma.task.findMany({
        where: { memberId, createdAt: { gte: today, lt: tomorrow } },
        select: { status: true, createdAt: true },
    });

    console.log(`[attendance] found ${todaysTasks.length} tasks:`, todaysTasks);

    if (todaysTasks.length === 0) {
        console.log("[attendance] no tasks in range — skipping");
        return;
    }

    const allCompleted = todaysTasks.every((t) => t.status === TaskStatus.completed);
    console.log(`[attendance] allCompleted: ${allCompleted}`);

    if (!allCompleted) return;

    const result = await prisma.dailyAttendance.upsert({
        where: { memberId_date: { memberId, date: today } },
        update: { status: AttendanceStatus.present, allTasksCompletedAt: new Date() },
        create: {
            memberId,
            date: today,
            status: AttendanceStatus.present,
            allTasksCompletedAt: new Date(),
        },
    });

    console.log(`[attendance] marked present:`, result.status, result.date);
}

interface ZodError {
    name: "ZodError";
    errors: unknown[];
}

function isZodError(error: unknown): error is ZodError {
    return (
        typeof error === "object" &&
        error !== null &&
        (error as ZodError).name === "ZodError"
    );
}
