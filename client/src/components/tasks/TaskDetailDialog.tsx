import { Link } from "react-router-dom";
import { format, isPast } from "date-fns";
import { motion } from "framer-motion";
import { AlertTriangle, CalendarClock, CalendarDays, CheckCircle2, Clock, Loader2, Pencil, Trash2 } from "lucide-react";
import type { TaskPriority, TaskStatus } from "@/contexts/TaskContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  STATUS_ORDER,
  priorityColors,
  priorityLabels,
  taskStatusColors,
  taskStatusDots,
  taskStatusLabels,
} from "@/lib/projectMeta";
import { cn } from "@/lib/utils";
import { MarkdownView } from "./MarkdownView";
import { PendingMark } from "./PendingMark";
import { TaskTags } from "./TaskTags";

/** What the dialog shows; both the member board's Task and a project board's task fit it. */
export type TaskDetail = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | string;
  createdAt: Date | string;
  completedAt: Date | string | null;
  tags?: string[];
  project?: { id: string; name: string; color: string | null } | null;
  assignee?: { name: string };
  pending?: boolean;
};

const when = (d: Date | string) => format(new Date(d), "EEE d MMM yyyy, h:mm a");

/**
 * Everything about one task: the full Markdown description, tags and dates,
 * with its status changeable in place (when allowed) and Edit / Delete when
 * the page offers them. Open it by passing a task; `null` closes it.
 */
export const TaskDetailDialog = ({
  task,
  onOpenChange,
  canChangeStatus = false,
  busy = false,
  onStatus,
  onEdit,
  onDelete,
}: {
  task: TaskDetail | null;
  onOpenChange: (open: boolean) => void;
  canChangeStatus?: boolean;
  busy?: boolean;
  onStatus?: (status: TaskStatus) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) => {
  const done = task?.status === "completed";
  const overdue = !!task && !done && isPast(new Date(task.dueDate));

  return (
    <Dialog open={!!task} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {task && (
          <>
            <DialogHeader className="space-y-2.5 border-b border-border/70 px-6 pb-4 pt-6 text-left">
              <div className="flex flex-wrap items-center gap-1.5 pr-8">
                <Badge className={cn("font-medium", taskStatusColors[task.status])}>
                  {taskStatusLabels[task.status]}
                </Badge>
                <Badge className={cn("font-medium", priorityColors[task.priority])}>
                  {priorityLabels[task.priority]} priority
                </Badge>
                {task.pending && <PendingMark className="ml-1" />}
              </div>
              <DialogTitle className="text-xl leading-snug">{task.title}</DialogTitle>
              <DialogDescription
                className={cn("flex items-center gap-1.5 text-sm", overdue ? "text-destructive" : undefined)}
              >
                {overdue ? <AlertTriangle className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
                {overdue ? `Overdue, was due ${when(task.dueDate)}` : `Due ${when(task.dueDate)}`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 px-6 py-5">
              <section aria-label="Description">
                {task.description.trim() ? (
                  <MarkdownView text={task.description} className="leading-relaxed" />
                ) : (
                  <p className="text-sm text-muted-foreground">No description.</p>
                )}
              </section>

              {!!task.tags?.length && <TaskTags tags={task.tags} />}

              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl bg-surface/70 p-4 text-sm ring-1 ring-border/70 sm:grid-cols-2">
                {task.assignee && <Fact label="Assignee">{task.assignee.name}</Fact>}
                {task.project && (
                  <Fact label="Project">
                    <Link
                      to={`/projects/${task.project.id}`}
                      onClick={() => onOpenChange(false)}
                      className="inline-flex items-center gap-1.5 hover:underline"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: task.project.color ?? "var(--primary)" }}
                      />
                      {task.project.name}
                    </Link>
                  </Fact>
                )}
                <Fact label="Created" icon={Clock}>
                  {when(task.createdAt)}
                </Fact>
                <Fact label="Due" icon={CalendarClock}>
                  <span className={overdue ? "text-destructive" : undefined}>{when(task.dueDate)}</span>
                </Fact>
                {task.completedAt && (
                  <Fact label="Completed" icon={CheckCircle2}>
                    {when(task.completedAt)}
                  </Fact>
                )}
              </dl>
            </div>

            {(canChangeStatus || onEdit || onDelete) && (
              <div className="flex flex-col gap-3 border-t border-border/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                {canChangeStatus && onStatus ? (
                  <div
                    role="radiogroup"
                    aria-label="Status"
                    className="relative flex rounded-lg bg-surface p-0.5 ring-1 ring-border/70"
                  >
                    {STATUS_ORDER.map((s) => {
                      const active = s === task.status;
                      return (
                        <button
                          key={s}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          disabled={busy}
                          onClick={() => !active && onStatus(s)}
                          className={cn(
                            "relative flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-70",
                            active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {active && (
                            <motion.span
                              layoutId={`detail-status-${task.id}`}
                              className="absolute inset-0 rounded-md bg-card shadow-xs ring-1 ring-border/70"
                              transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
                            />
                          )}
                          <span className="relative flex items-center gap-1.5">
                            {busy && active ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <span className={cn("h-1.5 w-1.5 rounded-full", taskStatusDots[s])} />
                            )}
                            {taskStatusLabels[s]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <span />
                )}
                <div className="flex justify-end gap-2">
                  {onDelete && (
                    <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  )}
                  {onEdit && (
                    <Button variant="outline" onClick={onEdit}>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

const Fact = ({ label, icon: Icon, children }: { label: string; icon?: typeof Clock; children: React.ReactNode }) => (
  <div className="min-w-0 space-y-0.5">
    <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </dt>
    <dd className="truncate">{children}</dd>
  </div>
);
