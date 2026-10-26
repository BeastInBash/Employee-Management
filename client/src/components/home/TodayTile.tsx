import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorSwatch } from "@/components/projects/shared";
import type { Task } from "@/contexts/TaskContext";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Tile, TileLink } from "./Tile";

type TodayStatus = "none" | "partial" | "present";

const statusCopy: Record<TodayStatus, { word: string; tone: string }> = {
  none: { word: "Nothing planned", tone: "bg-surface text-muted-foreground" },
  partial: { word: "Partial so far", tone: "bg-honey-soft text-honey" },
  present: { word: "Present", tone: "bg-sage text-sage-foreground" },
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
          {tasks.map((t) => {
            const checked = t.status === "completed";
            const busy = pending.has(t.id);
            return (
              <li key={t.id}>
                <button
                  onClick={() => onToggle(t)}
                  disabled={busy}
                  aria-pressed={checked}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-surface px-3.5 py-2.5 text-left ring-1 ring-border/70 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-70"
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200",
                      checked ? "border-sage bg-sage text-sage-foreground" : "border-input bg-card"
                    )}
                  >
                    {busy ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <motion.span initial={false} animate={{ opacity: checked ? 1 : 0, scale: checked ? 1 : 0.6 }} transition={{ duration: 0.15 }}>
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </motion.span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-sm transition-colors",
                        checked && "text-muted-foreground line-through decoration-muted-foreground/40"
                      )}
                    >
                      {t.title}
                    </span>
                    {t.project && (
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ColorSwatch color={t.project.color} className="h-2 w-2" />
                        <span className="truncate">{t.project.name}</span>
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Tile>
  );
};
