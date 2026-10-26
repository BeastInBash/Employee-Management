import type { Task } from "@/contexts/TaskContext";

/** A task as the API sends it (dates as ISO strings, a couple of legacy id spellings). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RawTask = Record<string, any>;

/** API task → client Task, with real Dates. */
export const parseTask = (d: RawTask): Task => ({
  id: String(d.id),
  title: d.title,
  description: d.description,
  status: d.status,
  priority: d.priority,
  dueDate: d.dueDate ? new Date(d.dueDate) : new Date(),
  memberId: d.memberId || d.member_id || "",
  createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
  completedAt: d.completedAt ? new Date(d.completedAt) : null,
  project: d.project ?? null,
});
