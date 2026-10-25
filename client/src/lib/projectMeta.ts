import type { ProjectStatus } from "@/contexts/ProjectContext";
import type { TaskPriority, TaskStatus } from "@/contexts/TaskContext";

// Labels, colours and date helpers shared by the projects/teams pages.

export const projectStatusLabels: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  archived: "Archived",
};

export const taskStatusLabels: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  completed: "Completed",
};

export const taskStatusColors: Record<TaskStatus, string> = {
  todo: "bg-secondary text-secondary-foreground",
  in_progress: "bg-amber-500 text-white",
  review: "bg-blue-500 text-white dark:bg-orange-500",
  completed: "bg-accent text-accent-foreground",
};

export const priorityLabels: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const priorityColors: Record<TaskPriority, string> = {
  low: "bg-slate-500 text-white",
  medium: "bg-blue-500 text-white dark:bg-amber-500",
  high: "bg-orange-500 text-white dark:bg-orange-600",
  urgent: "bg-red-500 text-white",
};

export const COLOR_CHOICES = ["#f97316", "#f59e0b", "#10b981", "#06b6d4", "#8b5cf6", "#ec4899", "#ef4444", "#64748b"];

/** "Due 12 Mar" / "No due date" — dates come from the API as ISO strings. */
export const formatDate = (iso: string | null, empty = "—") =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : empty;

/** ISO string → value for <input type="date"> (local date). */
export const toDateInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** <input type="date"> value → ISO string at local midnight (or undefined when empty). */
export const fromDateInput = (v: string) => (v ? new Date(`${v}T00:00:00`).toISOString() : undefined);

/** Task due dates mean "by the end of that day", so a task due today isn't overdue yet. */
export const fromDueDateInput = (v: string) => (v ? new Date(`${v}T23:59:59.999`).toISOString() : undefined);
