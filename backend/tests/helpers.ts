import { UserRole, TaskStatus, TaskPriority } from "@prisma/client";
import { generateToken } from "../src/utils/jwt";

// ─── token helpers ────────────────────────────────────────────────────────────

export const ADMIN = {
  userId: "admin-user-id",
  email: "admin@example.com",
  role: UserRole.admin,
};

export const MEMBER = {
  userId: "member-user-id",
  email: "member@example.com",
  role: UserRole.member,
};

export function tokenFor(payload: {
  userId: string;
  email: string;
  role: UserRole;
}): string {
  return generateToken(payload);
}

export function authHeader(payload: {
  userId: string;
  email: string;
  role: UserRole;
}): string {
  return `Bearer ${tokenFor(payload)}`;
}

export const adminAuth = () => authHeader(ADMIN);
export const memberAuth = () => authHeader(MEMBER);

// ─── fixture builders ──────────────────────────────────────────────────────────

export function makeUser(overrides: Partial<any> = {}) {
  return {
    id: "user-1",
    email: "user@example.com",
    password: "$2b$10$hashedhashedhashedhashedhashedhashedhashedhashedha",
    name: "Test User",
    role: UserRole.member,
    isPasswordReset: false,
    resetToken: null,
    resetTokenExpiry: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

export function makeMember(overrides: Partial<any> = {}) {
  return {
    id: "member-1",
    role: "Engineer",
    email: "member@example.com",
    userId: "member-user-id",
    createdById: "admin-user-id",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

export function makeTask(overrides: Partial<any> = {}) {
  return {
    id: "task-1",
    title: "A valid task title",
    description: "A valid description with enough characters",
    status: TaskStatus.todo,
    priority: TaskPriority.medium,
    dueDate: new Date("2026-12-31T00:00:00.000Z"),
    memberId: "member-1",
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    completedAt: null,
    ...overrides,
  };
}

export function makeAttendance(overrides: Partial<any> = {}) {
  return {
    id: "att-1",
    memberId: "member-1",
    date: new Date("2026-06-21T00:00:00.000Z"),
    status: "present",
    taskSubmittedAt: new Date("2026-06-21T09:30:00.000Z"),
    allTasksCompletedAt: new Date("2026-06-21T18:00:00.000Z"),
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    updatedAt: new Date("2026-06-21T00:00:00.000Z"),
    ...overrides,
  };
}
