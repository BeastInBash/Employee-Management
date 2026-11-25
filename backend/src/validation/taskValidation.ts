import { z } from "zod";
import { TaskStatus, TaskPriority } from "@prisma/client";
import { MAX_DESCRIPTION_LENGTH, tagsSchema } from "./tags";

export const createTaskSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters"),
    description: z
        .string()
        .min(10, "Description must be at least 10 characters")
        .max(MAX_DESCRIPTION_LENGTH, `Description can be at most ${MAX_DESCRIPTION_LENGTH} characters`),
    status: z.nativeEnum(TaskStatus).default(TaskStatus.todo),
    priority: z.nativeEnum(TaskPriority).default(TaskPriority.medium),
    dueDate: z.string().datetime("Invalid date format"),
    userId: z.string().optional(),
    // Optional project the task belongs to; the assignee must be on that project.
    projectId: z.string().uuid().optional(),
    // Set by the client's outbox: the task's id (so a retry can't create it twice)
    // and when it was added (it may be sent later, e.g. after being offline).
    id: z.string().uuid().optional(),
    clientCreatedAt: z.string().datetime().optional(),
    tags: tagsSchema.optional(),
});

export const updateTaskSchema = z.object({
    title: z.string().min(3).optional(),
    description: z.string().min(10).max(MAX_DESCRIPTION_LENGTH).optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    dueDate: z.string().datetime().optional(),
    tags: tagsSchema.optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
