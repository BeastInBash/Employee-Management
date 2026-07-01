import { Request, Response, NextFunction } from "express";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  if (req.user.role !== UserRole.admin) {
    res.status(403).json({ message: "Admin access required" });
    return;
  }

  next();
}

export async function canManageTask(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    // Admin can manage all tasks
    if (req.user.role === UserRole.admin) {
      next();
      return;
    }

    // Members can only manage their own tasks
    const taskId = req.params.taskId;
    if (typeof taskId !== "string") {
      res.status(400).json({ message: "Task ID is required" });
      return;
    }
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { member: { select: { userId: true } } },
    });

    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    // Match on the stable userId rather than email: Member.email can drift from
    // User.email, which would wrongly 403 a member from managing their own task.
    if (task.member.userId !== req.user.userId) {
      res.status(403).json({ message: "You can only manage your own tasks" });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function canViewMemberTasks(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    // Admin can view all member tasks
    if (req.user.role === UserRole.admin) {
      next();
      return;
    }

    // Members can only view their own tasks. The route param is the member's
    // User id (matching getMemberTasks, which resolves the member via userId).
    const userId = req.params.userId;
    if (typeof userId !== "string") {
      res.status(400).json({ message: "User ID is required" });
      return;
    }
    const member = await prisma.member.findFirst({
      where: { userId },
      select: { userId: true },
    });

    if (!member) {
      res.status(404).json({ message: "Member not found" });
      return;
    }

    // The route param userId is the member's User id; a member may only view
    // their own tasks. Compare on userId (stable) rather than email.
    if (member.userId !== req.user.userId) {
      res.status(403).json({ message: "You can only view your own tasks" });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
}
