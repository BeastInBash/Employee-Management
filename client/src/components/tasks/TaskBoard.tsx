import { MarkdownView } from "@/components/tasks/MarkdownView";
import { TaskTags } from "@/components/tasks/TaskTags";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  defaultDropAnimationSideEffects,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type {
  Announcements,
  CollisionDetection,
  DragEndEvent,
  KeyboardCoordinateGetter,
  UniqueIdentifier,
} from "@dnd-kit/core";
import { isPast } from "date-fns";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
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
import { PendingMark } from "@/components/tasks/PendingMark";

/** Stops a press on a control inside a card (menu, link) from starting a drag. */
const keepClick = {
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation(),
};

/** The column under the pointer; with the keyboard (no pointer), the one the card overlaps. */
const columnCollision: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args);

/** Arrow keys move a picked-up card a whole column at a time (right/down = next, left/up = previous). */
const columnKeys: KeyboardCoordinateGetter = (event, { context: { active, over, droppableRects, collisionRect } }) => {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.code];
  if (!step || !collisionRect) return undefined;
  event.preventDefault();
  const from = (over?.id ?? active?.data.current?.status) as TaskStatus | undefined;
  const index = Math.min(STATUS_ORDER.length - 1, Math.max(0, STATUS_ORDER.indexOf(from ?? "todo") + step));
  const rect = droppableRects.get(STATUS_ORDER[index]!);
  if (!rect) return undefined;
  return { x: rect.left + rect.width / 2 - collisionRect.width / 2, y: rect.top + 40 };
};

/** The lift the dragged card gets, and how it lands. */
const DROP_MS = 240;
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

/**
 * A four-column task board (to do → done). Cards move between columns by
 * dragging (mouse, touch with a short press, or keyboard: focus a card, Space,
 * arrows, Space) or from the status pill's menu; either way the card glides to
 * its new column and its neighbours close the gap. A drop moves the card at
 * once and saves in the background; if the save fails it glides back. Used by
 * the admin's member view and the member's own task page.
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
  const reduceMotion = useReducedMotion();
  const [busyId, setBusyId] = useState<string | null>(null);
  // Where a dropped card shows until its save settles (then the parent's list agrees).
  const [moved, setMoved] = useState<Record<string, TaskStatus>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  // What the floating card shows. It outlives the drag by the landing, so it can
  // settle flat and already wear its new status while it flies into place.
  const [lifted, setLifted] = useState<Lift>(null);
  // The board keeps its height while cards rearrange, then eases to the new one,
  // so a column never snaps shorter under a card that's still gliding up.
  const boardRef = useRef<HTMLDivElement>(null);
  const [heldHeight, setHeldHeight] = useState<number | null>(null);
  const releaseTimer = useRef<number | undefined>(undefined);
  const landTimer = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      window.clearTimeout(releaseTimer.current);
      window.clearTimeout(landTimer.current);
    },
    [],
  );

  const holdHeight = () => {
    const height = boardRef.current?.offsetHeight;
    if (!height) return;
    setHeldHeight(height);
    window.clearTimeout(releaseTimer.current);
    releaseTimer.current = window.setTimeout(() => setHeldHeight(null), 520);
  };

  const land = (status?: TaskStatus) => {
    setLifted((l) => l && { ...l, status: status ?? l.status, dropping: true });
    window.clearTimeout(landTimer.current);
    landTimer.current = window.setTimeout(() => setLifted(null), DROP_MS + 80);
  };
  // The card that just landed: the drag overlay flies it in, so its own layout
  // animation stays off (or it would also glide from the old column).
  const [landingId, setLandingId] = useState<string | null>(null);

  const sensors = useSensors(
    // A small move before a drag starts, so clicks on the card still work.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // On touch, a short press: a plain swipe still scrolls the page.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeys }),
  );

  const statusOf = (task: Task) => moved[task.id] ?? task.status;

  const change = async (task: Task, status: TaskStatus) => {
    holdHeight();
    setBusyId(task.id);
    try {
      await onStatusChange(task, status);
    } finally {
      setBusyId(null);
    }
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    const task = tasks.find((t) => t.id === active.id);
    const status = over?.id as TaskStatus | undefined;
    if (!task || !status || status === statusOf(task)) {
      land(); // back to where it was
      return;
    }

    land(status);
    holdHeight();
    setMoved((m) => ({ ...m, [task.id]: status }));
    setLandingId(task.id);
    window.setTimeout(() => setLandingId((id) => (id === task.id ? null : id)), DROP_MS + 60);
    void change(task, status).finally(() =>
      setMoved((m) => {
        const rest = { ...m };
        delete rest[task.id];
        return rest;
      }),
    );
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${titleOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${titleOf(active.id)} is over ${columnName(over.id)}.` : `${titleOf(active.id)} is not over a column.`,
    onDragEnd: ({ active, over }) =>
      over ? `${titleOf(active.id)} moved to ${columnName(over.id)}.` : `${titleOf(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Cancelled. ${titleOf(active.id)} stays where it was.`,
  };
  function titleOf(id: UniqueIdentifier) {
    return tasks.find((t) => t.id === id)?.title ?? "Task";
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={columnCollision}
      onDragStart={({ active }) => {
        const task = tasks.find((t) => t.id === active.id);
        window.clearTimeout(landTimer.current);
        setActiveId(String(active.id));
        if (task) setLifted({ task, status: statusOf(task), dropping: false });
      }}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        land();
      }}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "To move a task, press Space, use the arrow keys to choose a column, then press Space again. Escape cancels.",
        },
      }}
    >
      <LayoutGroup>
        <div
          ref={boardRef}
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
          style={{
            minHeight: heldHeight ?? 0,
            transition: heldHeight === null ? "min-height 360ms cubic-bezier(0.23, 1, 0.32, 1)" : "none",
          }}
        >
          {STATUS_ORDER.map((status) => {
            const column = tasks.filter((t) => statusOf(t) === status);
            return (
              <Column key={status} status={status} count={column.length} dragging={!!activeId}>
                <AnimatePresence initial={false} mode="popLayout">
                  {column.map((task) => {
                    const landing = landingId === task.id;
                    return (
                      <motion.div
                        key={task.id}
                        {...(!landing && { layoutId: task.id })}
                        layout={landing ? false : "position"}
                        initial={landing ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.12 } }}
                        transition={{ type: "spring", duration: 0.45, bounce: 0.12 }}
                      >
                        <DraggableCard
                          id={task.id}
                          status={status}
                          disabled={!canManage(task)}
                          isActive={activeId === task.id}
                        >
                          <TaskCard
                            task={{ ...task, status }}
                            canManage={canManage(task)}
                            canDelete={canDelete}
                            isBusy={busyId === task.id}
                            onStatus={(s) => change(task, s)}
                            onEdit={() => onEdit(task)}
                            onDelete={() => onDelete(task)}
                          />
                        </DraggableCard>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {column.length === 0 &&
                  !activeId &&
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
              </Column>
            );
          })}
        </div>
      </LayoutGroup>

      {/* The card under the pointer. On drop it flies into the slot the card now
          has (dnd-kit measures the moved card), then hands over to it. dnd-kit
          freezes the overlay's props once dropped, so the landing state reaches
          it through context instead (context still flows through the portal).

          It's portalled to <body> because the overlay is position: fixed, and
          any transformed ancestor (AppShell's page transition keeps one) would
          make it fixed to that ancestor instead of the window, offsetting the
          card from the pointer by the sidebar's width. */}
      <LiftContext.Provider value={lifted}>
        {createPortal(
          <DragOverlay
            dropAnimation={
              reduceMotion
                ? null
                : {
                    duration: DROP_MS,
                    easing: EASE_OUT,
                    sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0" } } }),
                  }
            }
          >
            {lifted && <LiftedCard task={lifted.task} reduceMotion={!!reduceMotion} />}
          </DragOverlay>,
          document.body,
        )}
      </LiftContext.Provider>
    </DndContext>
  );
};

type Lift = { task: Task; status: TaskStatus; dropping: boolean } | null;
const LiftContext = createContext<Lift>(null);

/** The floating copy of a dragged card: tilted and raised, then flat again as it lands. */
const LiftedCard = ({ task, reduceMotion }: { task: Task; reduceMotion: boolean }) => {
  const lift = useContext(LiftContext);
  const dropping = lift?.dropping ?? true;
  return (
    <motion.div
      initial={reduceMotion ? false : { scale: 1, rotate: 0 }}
      animate={
        reduceMotion
          ? {}
          : dropping
            ? { scale: 1, rotate: 0, transition: { duration: DROP_MS / 1000, ease: [0.23, 1, 0.32, 1] } }
            : { scale: 1.03, rotate: -1.5, transition: { duration: 0.18, ease: [0.23, 1, 0.32, 1] } }
      }
      className={cn(
        "rounded-lg transition-shadow ease-[var(--ease-out)]",
        dropping
          ? "shadow-[0_1px_2px_rgb(78_34_15/0.04)] duration-200"
          : "cursor-grabbing shadow-[0_12px_32px_-8px_rgb(78_34_15/0.35),0_2px_6px_rgb(78_34_15/0.12)] duration-150",
      )}
    >
      <TaskCard
        // Already wears its new status while it lands.
        task={{ ...task, status: lift?.status ?? task.status }}
        canManage={false}
        canDelete={false}
        isBusy={false}
        onStatus={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    </motion.div>
  );
};

const columnName = (id: UniqueIdentifier) => taskStatusLabels[id as TaskStatus] ?? "a column";

/** A status column, and the drop target for it. */
const Column = ({
  status,
  count,
  dragging,
  children,
}: {
  status: TaskStatus;
  count: number;
  dragging: boolean;
  children: ReactNode;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-48 flex-col rounded-xl bg-surface p-2 ring-1 ring-border/70",
        "transition-[box-shadow,background-color] duration-200 ease-[var(--ease-out)]",
        isOver && "bg-accent/60 ring-2 ring-primary/45",
      )}
    >
      <div className="flex items-center justify-between px-2 pb-2 pt-1">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className={cn("h-2 w-2 rounded-full", taskStatusDots[status])} />
          {taskStatusLabels[status]}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {children}
        {/* While dragging, an empty column shows where the card will land. */}
        {dragging && count === 0 && (
          <div
            className={cn(
              "flex flex-1 items-center justify-center rounded-lg border border-dashed py-8 text-xs transition-colors duration-200",
              isOver ? "border-primary/50 text-foreground" : "border-border text-muted-foreground",
            )}
          >
            Drop here
          </div>
        )}
      </div>
    </div>
  );
};

/** Makes a card draggable; while it's being dragged, its spot stays as a faint placeholder. */
const DraggableCard = ({
  id,
  status,
  disabled,
  isActive,
  children,
}: {
  id: string;
  status: TaskStatus;
  disabled: boolean;
  isActive: boolean;
  children: ReactNode;
}) => {
  const { setNodeRef, attributes, listeners } = useDraggable({ id, disabled, data: { status } });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      // dnd-kit's role="button" would hide the card's own controls from screen readers' sense of structure.
      role={disabled ? undefined : "group"}
      aria-roledescription={disabled ? undefined : "draggable task"}
      className={cn(
        "rounded-lg outline-none transition-opacity duration-150 focus-visible:ring-2 focus-visible:ring-ring",
        !disabled && "cursor-grab touch-manipulation active:cursor-grabbing",
        isActive && "opacity-35",
      )}
    >
      {children}
    </div>
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
        <p
          className={cn(
            "text-sm font-medium leading-snug",
            done && "text-muted-foreground line-through decoration-muted-foreground/50",
          )}
        >
          {task.title}
        </p>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                {...keepClick}
                variant="ghost"
                size="icon-sm"
                className="-mr-1 -mt-1 h-7 w-7 shrink-0"
                aria-label={`Actions for ${task.title}`}
              >
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
      {task.description && (
        // Enter on a link inside shouldn't pick the card up for a keyboard drag.
        <div onKeyDown={(e) => e.stopPropagation()}>
          <MarkdownView text={task.description} compact />
        </div>
      )}
      <TaskTags tags={task.tags} />
      {task.pending && <PendingMark />}
      <div className="flex flex-wrap items-center gap-1.5">
        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              {...keepClick}
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
            {...keepClick}
            to={`/projects/${task.project.id}`}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-border transition-colors hover:text-foreground"
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: task.project.color ?? "var(--primary)" }}
            />
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
