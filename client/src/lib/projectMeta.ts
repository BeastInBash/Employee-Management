import { format, isToday, isTomorrow } from "date-fns";
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

export const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "review", "completed"];

/** "Today, 6:00 PM" / "Tomorrow, 9:30 AM" / "3 Nov 2026, 6:00 PM". */
export const dueLabel = (due: Date) => {
  if (isToday(due)) return `Today, ${format(due, "h:mm a")}`;
  if (isTomorrow(due)) return `Tomorrow, ${format(due, "h:mm a")}`;
  return format(due, "d MMM yyyy, h:mm a");
};

export const taskStatusLabels: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  review: "In review",
  completed: "Done",
};

// Soft tinted pills: a pale fill with a deeper ink of the same hue.
export const taskStatusColors: Record<TaskStatus, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-honey-soft text-honey",
  review: "bg-[#e3ebe6] text-[#3e5f58] dark:bg-[#1f2b28] dark:text-[#a3c4bb]",
  completed: "bg-secondary text-primary",
};

/** Solid dot colour per status (for column headers and legends). */
export const taskStatusDots: Record<TaskStatus, string> = {
  todo: "bg-muted-foreground/50",
  in_progress: "bg-honey",
  review: "bg-[#5f8a80]",
  completed: "bg-primary",
};

export const priorityLabels: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const priorityColors: Record<TaskPriority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-secondary text-secondary-foreground",
  high: "bg-[#f5ead2] text-[#7f5410] dark:bg-[#33291a] dark:text-[#e3b764]",
  urgent: "bg-[#f6e1da] text-[#953720] dark:bg-[#3a221c] dark:text-[#ef9a82]",
};

/** Calm swatches for projects and teams, drawn from the warm olive/earth palette. */
export const COLOR_CHOICES = ["#4f5b2e", "#8f9a5c", "#c8923a", "#b4553c", "#a8744f", "#5f8a80", "#7a6a8f", "#6b6656"];

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
