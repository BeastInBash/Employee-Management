import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { format, isToday, isTomorrow } from "date-fns";
import { Check, ChevronDown, Clock, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorSwatch } from "@/components/projects/shared";
import type { Task } from "@/contexts/TaskContext";
import { EASE } from "@/lib/motion";
import { priorityColors, priorityLabels } from "@/lib/projectMeta";
import { cn } from "@/lib/utils";
import { Tile, TileLink } from "./Tile";

type TodayStatus = "none" | "partial" | "present";

const statusCopy: Record<TodayStatus, { word: string; tone: string }> = {
  none: { word: "Nothing planned", tone: "bg-surface text-muted-foreground" },
  partial: { word: "Partial so far", tone: "bg-honey-soft text-honey" },
  present: { word: "Present", tone: "bg-sage text-sage-foreground" },
};

/** "6:00 PM" today, "Tomorrow, 9:30 AM", otherwise "Wed 28 Oct": short enough for the row. */
const deadline = (due: Date) => {
  if (isToday(due)) return format(due, "h:mm a");
  if (isTomorrow(due)) return `Tomorrow, ${format(due, "h:mm a")}`;
  return format(due, "EEE d MMM");
};

/**
 * One task on today's list. The circle finishes it; the rest of the row opens
 * the details (description, full due date, priority) below, so reading a task
 * never ticks it by accident.
 */
const TodayTaskRow = ({ task, busy, onToggle }: { task: Task; busy: boolean; onToggle: () => void }) => {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const checked = task.status === "completed";
  const overdue = !checked && task.dueDate.getTime() < Date.now();
  const description = task.description?.trim();

  return (
    <li className="rounded-xl bg-surface ring-1 ring-border/70 transition-colors hover:bg-accent/60">
      <div className="flex min-h-12 items-center gap-1 pl-2 pr-1.5">
        <button
          onClick={onToggle}
          disabled={busy}
          aria-pressed={checked}
          aria-label={checked ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-70"
        >
          <span
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full border transition-colors duration-200",
              checked ? "border-sage bg-sage text-sage-foreground" : "border-input bg-card hover:border-sage",
            )}
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <motion.span
                initial={false}
                animate={{ opacity: checked ? 1 : 0, scale: checked ? 1 : 0.6 }}
                transition={{ duration: 0.15 }}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </motion.span>
            )}
          </span>
        </button>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={detailsId}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-2.5 pl-1 pr-1.5 text-left focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                // Up to two lines, so a long title isn't cut short by the deadline beside it;
                // the whole title once the row is open.
                "text-sm break-words transition-colors",
                !open && "line-clamp-2",
                checked && "text-muted-foreground line-through decoration-muted-foreground/40",
              )}
            >
              {task.title}
            </span>
            {task.project && (
              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <ColorSwatch color={task.project.color} className="h-2 w-2" />
                <span className="truncate">{task.project.name}</span>
              </span>
            )}
          </span>
          <span
            className={cn(
              "flex shrink-0 items-center gap-1 text-xs tabular",
              overdue ? "font-medium text-destructive" : "text-muted-foreground",
            )}
          >
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {overdue ? `Overdue, ${deadline(task.dueDate)}` : deadline(task.dueDate)}
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-[var(--ease-out)]",
              open && "rotate-180",
            )}
          />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={detailsId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="space-y-2.5 border-t border-border/70 px-4 pb-3.5 pl-[52px] pt-3">
              <p
                className={cn(
                  "whitespace-pre-line break-words text-sm leading-relaxed",
                  !description && "text-muted-foreground",
                )}
              >
                {description || "No description."}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className={cn("rounded-full px-2 py-0.5 font-medium", priorityColors[task.priority])}>
                  {priorityLabels[task.priority]} priority
                </span>
                <span className={cn(overdue && "text-destructive")}>
                  Due {format(task.dueDate, "EEEE d MMMM, h:mm a")}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
};

/**
 * Today's list, the dashboard's one bold cell: the status block takes the
 * colour of the attendance it adds up to, and ticking a task finishes it.
 */
export const TodayTile = ({
  tasks,
  loading,
  pending,
  onToggle,
  onAdd,
  addDisabled,
  boardHref,
  className,
}: {
  tasks: Task[];
  loading: boolean;
  pending: Set<string>;
  onToggle: (task: Task) => void;
  onAdd: () => void;
  addDisabled: boolean;
  boardHref: string;
  className?: string;
}) => {
  const done = tasks.filter((t) => t.status === "completed").length;
  const status: TodayStatus = tasks.length === 0 ? "none" : done === tasks.length ? "present" : "partial";
  const { word, tone } = statusCopy[status];

  return (
    <Tile title="Today" action={<TileLink to={boardHref}>Open board</TileLink>} className={className}>
      <div className={cn("rounded-xl px-4 py-4 transition-colors duration-300", tone)} aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={status}
            initial={{ opacity: 0, transform: "translateY(6px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transform: "translateY(-4px)", transition: { duration: 0.12 } }}
            transition={{ duration: 0.28, ease: EASE }}
            className="text-2xl font-semibold tracking-tight"
          >
            {loading ? "Loading…" : word}
          </motion.p>
        </AnimatePresence>
        <p className="mt-1 text-sm opacity-85">
          {status === "none"
            ? "Plan something to count today."
            : `${done} of ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} done`}
        </p>
        {tasks.length > 0 && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-current/15">
            <div
              className="h-full rounded-full bg-current transition-[width] duration-300 ease-[var(--ease-out)]"
              style={{ width: `${(done / tasks.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="mt-4 space-y-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="mt-4 flex flex-1 flex-col items-start justify-center gap-3 rounded-xl bg-surface px-4 py-6">
          <p className="text-sm text-muted-foreground">
            Write down what you'll get done today. Finish all of it and the day counts as present.
          </p>
          <Button size="sm" onClick={onAdd} disabled={addDisabled}>
            <Plus className="h-4 w-4" />
            Add task
          </Button>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {tasks.map((t) => (
            <TodayTaskRow key={t.id} task={t} busy={pending.has(t.id)} onToggle={() => onToggle(t)} />
          ))}
        </ul>
      )}
    </Tile>
  );
};
