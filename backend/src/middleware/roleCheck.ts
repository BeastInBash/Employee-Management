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
    if (!taskId) {
      res.status(400).json({ message: "Task ID is required" });
      return;
    }
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { member: true },
    });

    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    if (task.member.email !== req.user.email) {
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
    if (!userId) {
      res.status(400).json({ message: "User ID is required" });
      return;
    }
    const member = await prisma.member.findUnique({
      where: { userId },
    });

    if (!member) {
      res.status(404).json({ message: "Member not found" });
      return;
    }

    if (member.email !== req.user.email) {
      res.status(403).json({ message: "You can only view your own tasks" });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
}
