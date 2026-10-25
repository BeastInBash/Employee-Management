import { z } from "zod";
import { ProjectStatus, ScopeRole, TaskPriority, TaskStatus } from "@prisma/client";

const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex value like #f97316");

const isoDate = z.string().datetime("Invalid date format");

export const listScopeQuerySchema = z.object({
  workspaceId: z.string().uuid("workspaceId must be a valid UUID").optional(),
});

export const createProjectSchema = z
  .object({
    workspaceId: z.string().uuid("workspaceId must be a valid UUID"),
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
    description: z.string().trim().max(2000).optional(),
    status: z.nativeEnum(ProjectStatus).default(ProjectStatus.active),
    color: color.optional(),
    startDate: isoDate.optional(),
    dueDate: isoDate.optional(),
    leadIds: z.array(z.string().uuid()).default([]),
    memberIds: z.array(z.string().uuid()).default([]),
    teamIds: z.array(z.string().uuid()).default([]),
  })
  .refine((d) => !d.startDate || !d.dueDate || new Date(d.startDate) <= new Date(d.dueDate), {
    message: "dueDate must be on or after startDate",
    path: ["dueDate"],
  });

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    status: z.nativeEnum(ProjectStatus).optional(),
    color: color.nullable().optional(),
    startDate: isoDate.nullable().optional(),
    dueDate: isoDate.nullable().optional(),
  })
  .refine((d) => !d.startDate || !d.dueDate || new Date(d.startDate) <= new Date(d.dueDate), {
    message: "dueDate must be on or after startDate",
    path: ["dueDate"],
  });

export const createTeamSchema = z.object({
  workspaceId: z.string().uuid("workspaceId must be a valid UUID"),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
  description: z.string().trim().max(1000).optional(),
  color: color.optional(),
  leadIds: z.array(z.string().uuid()).default([]),
  memberIds: z.array(z.string().uuid()).default([]),
});

export const updateTeamSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  color: color.nullable().optional(),
});

/** Add a Member seat (by Member id) to a project or team. */
export const addSeatSchema = z.object({
  memberId: z.string().uuid("memberId must be a valid UUID"),
  role: z.nativeEnum(ScopeRole).default(ScopeRole.member),
});

export const updateSeatSchema = z.object({
  role: z.nativeEnum(ScopeRole),
});

export const assignTeamSchema = z.object({
  teamId: z.string().uuid("teamId must be a valid UUID"),
});

export const createProjectTaskSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.todo),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.medium),
  dueDate: isoDate,
  /** Assignee's Member id. Omit to assign the task to yourself. */
  memberId: z.string().uuid().optional(),
});

export const projectTasksQuerySchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  memberId: z.string().uuid().optional(),
});
