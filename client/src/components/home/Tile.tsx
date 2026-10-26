import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ColorSwatch } from "@/components/projects/shared";
import type { Task } from "@/contexts/TaskContext";
import { format, isToday, isTomorrow } from "date-fns";
import { taskStatusColors, taskStatusDots, taskStatusLabels } from "@/lib/projectMeta";
import { tileIn } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** One bento cell: a titled card with an optional link or action on the right. */
export const Tile = ({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <motion.section
    variants={tileIn}
    className={cn("flex min-w-0 flex-col rounded-2xl border border-border/80 bg-card p-5", className)}
  >
    {(title || action) && (
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {title && <h2 className="text-[15px]">{title}</h2>}
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
    )}
    {children}
  </motion.section>
);

export const TileLink = ({ to, children }: { to: string; children: ReactNode }) => (
  <Link
    to={to}
    className="shrink-0 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
  >
    {children}
  </Link>
);

/** A single number with its label, for the small cells of the grid. */
export const StatCell = ({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "warn";
}) => (
  <Tile className="justify-between">
    <p className="text-sm text-muted-foreground">{label}</p>
    <div>
      <p
        className={cn(
          "mt-3 text-[34px] font-semibold leading-none tracking-tight tabular",
          tone === "warn" && "text-destructive",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  </Tile>
);

/** "Today, 6:00 PM" / "Tomorrow, 9:30 AM" / "Wed 28 Oct": short enough for a narrow row. */
const shortDue = (due: Date) => {
  if (isToday(due)) return `Today, ${format(due, "h:mm a")}`;
  if (isTomorrow(due)) return `Tomorrow, ${format(due, "h:mm a")}`;
  return format(due, "EEE d MMM");
};

/**
 * A compact task line: status dot, title and project, and on the right either
 * the due date or (`show="status"`) the status, so two lists of the same tasks
 * can each say something different.
 */
export const TaskLine = ({
  task,
  overdue,
  show = "due",
}: {
  task: Task;
  overdue?: boolean;
  show?: "due" | "status";
}) => (
  <li className="flex items-start gap-3 py-2.5">
    <span
      className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", taskStatusDots[task.status])}
      title={taskStatusLabels[task.status]}
      aria-label={taskStatusLabels[task.status]}
    />
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm">{task.title}</p>
      {task.project && (
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <ColorSwatch color={task.project.color} className="h-2 w-2" />
          <span className="truncate">{task.project.name}</span>
        </p>
      )}
    </div>
    {show === "status" ? (
      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", taskStatusColors[task.status])}>
        {taskStatusLabels[task.status]}
      </span>
    ) : (
      <span
        className={cn(
          "shrink-0 pt-px text-xs tabular",
          overdue ? "font-medium text-destructive" : "text-muted-foreground",
        )}
      >
        {overdue ? "Overdue" : shortDue(task.dueDate)}
      </span>
    )}
  </li>
);

/** What a list cell says when there is nothing to show. */
export const TileEmpty = ({ children }: { children: ReactNode }) => (
  <p className="flex flex-1 items-center rounded-xl bg-surface px-4 py-6 text-sm text-muted-foreground">{children}</p>
);
