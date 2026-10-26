import { Request, Response } from "express";
import { PrismaClient, UserRole, TaskStatus, AttendanceStatus } from "@prisma/client";
import { createTaskSchema, updateTaskSchema } from "../validation/taskValidation";
import {
    getTodayISTDate,
    isWithinTaskWindow,
    serializeTaskWindow,
    taskWindowClosedMessage,
    toTaskWindow,
} from "../utils/attendance";
import { canLeadTaskProject, getProjectParticipantIds } from "../utils/access";

const prisma = new PrismaClient();

// Every member lookup that needs the submission rules pulls the workspace's
// window along with the member row.
const taskWindowSelect = {
    taskWindowEnabled: true,
    taskWindowStart: true,
    taskWindowEnd: true,
} as const;

export async function createTask(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Authentication required" });
            return;
        }

        const validatedData = createTaskSchema.parse(req.body);

        let memberId: string;

        // When the task belongs to a project, resolve the assignee's seat in
        // *that* project's workspace (a user may have seats in several).
        let projectWorkspaceId: string | undefined;
        if (validatedData.projectId) {
            const project = await prisma.project.findUnique({
                where: { id: validatedData.projectId },
                select: { workspaceId: true },
            });
            if (!project) {
                res.status(404).json({ message: "Project not found" });
                return;
            }
            projectWorkspaceId = project.workspaceId;
        }

        if (req.user.role === UserRole.member) {
            const member = await prisma.member.findFirst({
                where: {
                    userId: req.user.userId,
                    ...(projectWorkspaceId && { workspaceId: projectWorkspaceId }),
                },
                select: { id: true, workspace: { select: taskWindowSelect } },
            });

            if (!member) {
                res.status(404).json({ message: "Member not found" });
                return;
            }

            // The window lives on the member's workspace and is off by default,
            // so members can submit anytime unless an admin restricted it.
            const window = toTaskWindow(member.workspace);
            if (!isWithinTaskWindow(window)) {
                res.status(403).json({
                    message: taskWindowClosedMessage(window),
                    taskWindow: serializeTaskWindow(window),
                });
                return;
            }

            memberId = member.id;
        } else {
            if (!validatedData.userId) {
                res.status(400).json({ message: "userId is required for admin created tasks" });
                return;
            }

            const member = await prisma.member.findFirst({
                where: {
                    userId: validatedData.userId,
                    ...(projectWorkspaceId && { workspaceId: projectWorkspaceId }),
                },
                select: { id: true },
            });

            if (!member) {
                res.status(404).json({ message: "Member not found" });
                return;
            }

            memberId = member.id;
        }

        if (validatedData.projectId) {
            const participants = await getProjectParticipantIds(validatedData.projectId);
            if (!participants.has(memberId)) {
                res.status(400).json({ message: "The assignee must be on this project" });
                return;
            }
        }

        const task = await prisma.task.create({
            data: {
                title: validatedData.title,
                description: validatedData.description,
                status: validatedData.status ?? TaskStatus.todo,
                priority: validatedData.priority,
                dueDate: new Date(validatedData.dueDate),
                memberId,
                ...(validatedData.projectId && { projectId: validatedData.projectId }),
            },
            include: { project: { select: { id: true, name: true, color: true } } },
        });

        if (req.user.role === UserRole.member) {
            const today = getTodayISTDate();
            // Planned but not finished yet is partial, which is also what the day
            // settles to if it stays that way; finishing the list flips it to present.
            await prisma.dailyAttendance.upsert({
                where: { memberId_date: { memberId, date: today } },
                update: {},
                create: {
                    memberId,
                    date: today,
                    status: AttendanceStatus.partial,
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

/**
 * The submission window that applies to the caller. Members don't know their
 * workspace id, so the client asks here instead of hitting the workspace route.
 * Admins are never constrained, so they always get an open window.
 */
export async function getMyTaskWindow(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Authentication required" });
            return;
        }

        if (req.user.role === UserRole.admin) {
            res.json({ taskWindow: serializeTaskWindow({ ...toTaskWindow(null), enabled: false }) });
            return;
        }

        const member = await prisma.member.findFirst({
            where: { userId: req.user.userId },
            select: { workspaceId: true, workspace: { select: taskWindowSelect } },
        });

        if (!member) {
            res.status(404).json({ message: "Member not found" });
            return;
        }

        res.json({
            workspaceId: member.workspaceId,
            taskWindow: serializeTaskWindow(toTaskWindow(member.workspace)),
        });
    } catch (error) {
        console.error("Get task window error:", error);
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
            include: { project: { select: { id: true, name: true, color: true } } },
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
                projectId: true,
                member: { select: { id: true, userId: true } },
            },
        });

        if (!existingTask) {
            res.status(404).json({ message: "Task not found" });
            return;
        }

        // Match on the stable userId, not email (Member.email can drift from
        // User.email and would wrongly block a member from updating their task).
        if (
            req.user.role !== UserRole.admin &&
            existingTask.member.userId !== req.user.userId &&
            !(await canLeadTaskProject(req.user.userId, existingTask.projectId))
        ) {
            res.status(403).json({ message: "You can only update your own tasks" });
            return;
        }

        const isBeingCompleted =
            validatedData.status === TaskStatus.completed && existingTask.status !== TaskStatus.completed;

        const task = await prisma.task.update({
            where: { id: taskId },
            data: {
                ...(validatedData.title !== undefined && { title: validatedData.title }),
                ...(validatedData.description !== undefined && { description: validatedData.description }),
                ...(validatedData.status !== undefined && { status: validatedData.status }),
                ...(validatedData.priority !== undefined && { priority: validatedData.priority }),
                ...(validatedData.dueDate !== undefined && { dueDate: new Date(validatedData.dueDate) }),
                ...(isBeingCompleted && { completedAt: new Date() }),
                // Reopening a finished task clears its completion time.
                ...(validatedData.status !== undefined &&
                    validatedData.status !== TaskStatus.completed && { completedAt: null }),
            },
            include: { project: { select: { id: true, name: true, color: true } } },
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

        const taskId = req.params["taskId"];
        if (typeof taskId !== "string") {
            res.status(400).json({ message: "Task ID is required" });
            return;
        }

        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: { id: true, projectId: true },
        });

        if (!task) {
            res.status(404).json({ message: "Task not found" });
            return;
        }

        // Admins can delete anything; project leads can delete their project's tasks.
        if (req.user.role !== UserRole.admin && !(await canLeadTaskProject(req.user.userId, task.projectId))) {
            res.status(403).json({ message: "Only admins and project leads can delete tasks" });
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
    return typeof error === "object" && error !== null && (error as ZodError).name === "ZodError";
}
