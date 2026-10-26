import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { isPast } from "date-fns";
import { AlertTriangle, CalendarDays, Check, ChevronDown, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import type { Task, TaskStatus } from "@/contexts/TaskContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  STATUS_ORDER,
  dueLabel,
  priorityColors,
  priorityLabels,
  taskStatusColors,
  taskStatusDots,
  taskStatusLabels,
} from "@/lib/projectMeta";
import { cn } from "@/lib/utils";

/**
 * A four-column task board (to do → done). Status changes from a card's pill
 * menu; the card then glides to its new column. Used by the admin's member
 * view and the member's own task page.
 */
export const TaskBoard = ({
  tasks,
  canManage,
  canDelete,
  onStatusChange,
  onEdit,
  onDelete,
  onAdd,
  addDisabled,
}: {
  tasks: Task[];
  canManage: (task: Task) => boolean;
  canDelete: boolean;
  onStatusChange: (task: Task, status: TaskStatus) => Promise<void>;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onAdd?: () => void;
  addDisabled?: boolean;
}) => {
  const [busyId, setBusyId] = useState<string | null>(null);

  const change = async (task: Task, status: TaskStatus) => {
    setBusyId(task.id);
    try {
      await onStatusChange(task, status);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <LayoutGroup>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STATUS_ORDER.map((status) => {
          const column = tasks.filter((t) => t.status === status);
          return (
            <div key={status} className="flex min-h-48 flex-col rounded-xl bg-surface p-2 ring-1 ring-border/70">
              <div className="flex items-center justify-between px-2 pb-2 pt-1">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className={cn("h-2 w-2 rounded-full", taskStatusDots[status])} />
                  {taskStatusLabels[status]}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">{column.length}</span>
              </div>
              <div className="flex-1 space-y-2">
                <AnimatePresence initial={false}>
                  {column.map((task) => (
                    <motion.div
                      key={task.id}
                      layoutId={task.id}
                      layout="position"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      transition={{ type: "spring", duration: 0.45, bounce: 0.12 }}
                    >
                      <TaskCard
                        task={task}
                        canManage={canManage(task)}
                        canDelete={canDelete}
                        isBusy={busyId === task.id}
                        onStatus={(s) => change(task, s)}
                        onEdit={() => onEdit(task)}
                        onDelete={() => onDelete(task)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {column.length === 0 &&
                  (status === "todo" && onAdd ? (
                    <button
                      onClick={onAdd}
                      disabled={addDisabled}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-6 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      Add a task
                    </button>
                  ) : (
                    <p className="py-8 text-center text-xs text-muted-foreground">Nothing here</p>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </LayoutGroup>
  );
};

const TaskCard = ({
  task,
  canManage,
  canDelete,
  isBusy,
  onStatus,
  onEdit,
  onDelete,
}: {
  task: Task;
  canManage: boolean;
  canDelete: boolean;
  isBusy: boolean;
  onStatus: (s: TaskStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const due = new Date(task.dueDate);
  const overdue = isPast(due) && task.status !== "completed";
  const done = task.status === "completed";

  return (
    <div className="space-y-2.5 rounded-lg border border-border/70 bg-card p-3 shadow-[0_1px_2px_rgb(78_34_15/0.04)]">
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-sm font-medium leading-snug", done && "text-muted-foreground line-through decoration-muted-foreground/50")}>
          {task.title}
        </p>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="-mr-1 -mt-1 h-7 w-7 shrink-0" aria-label={`Actions for ${task.title}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {task.description && <p className="line-clamp-2 text-xs text-muted-foreground">{task.description}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={isBusy}
              className="rounded-full focus-visible:outline-2 focus-visible:outline-ring"
              aria-label={`Status: ${taskStatusLabels[task.status]}. Change status`}
            >
              <Badge className={cn("gap-1 font-medium", taskStatusColors[task.status])}>
                {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : taskStatusLabels[task.status]}
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {STATUS_ORDER.map((s) => (
                <DropdownMenuItem key={s} onClick={() => s !== task.status && onStatus(s)}>
                  <span className={cn("h-2 w-2 rounded-full", taskStatusDots[s])} />
                  <span className="flex-1">{taskStatusLabels[s]}</span>
                  {s === task.status && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Badge className={cn("font-medium", taskStatusColors[task.status])}>{taskStatusLabels[task.status]}</Badge>
        )}
        <Badge className={cn("font-medium", priorityColors[task.priority])}>{priorityLabels[task.priority]}</Badge>
        {task.project && (
          <Link
            to={`/projects/${task.project.id}`}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-border transition-colors hover:text-foreground"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: task.project.color ?? "var(--primary)" }} />
            <span className="truncate">{task.project.name}</span>
          </Link>
        )}
      </div>
      <div className={cn("flex items-center gap-1.5 text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>
        {overdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <CalendarDays className="h-3.5 w-3.5" />}
        {overdue ? `Overdue, was due ${dueLabel(due)}` : `Due ${dueLabel(due)}`}
      </div>
    </div>
  );
};
