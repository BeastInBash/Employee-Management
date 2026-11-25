import type { Task } from "@/contexts/TaskContext";
import { api, ApiRequestError } from "@/lib/api";
import { parseTask } from "@/lib/tasks";
import type { RawTask } from "@/lib/tasks";

/**
 * The task outbox: a member's new tasks (and edits to tasks that haven't
 * reached the server yet) are saved here first and sent in the background, so
 * the list updates the moment they press "Add".
 *
 * - **Durable:** the queue lives in localStorage per user, so it survives a
 *   refresh, a closed tab, going offline or signing out (it sends after the
 *   same person signs in again).
 * - **In order, one at a time:** an edit can never overtake the create it edits.
 * - **Safe to retry:** the task id is made here and the API treats a repeated id
 *   as "already have it", so a lost response can't create a duplicate.
 * - **One sender:** with several tabs open, a Web Lock lets only one send.
 *
 * Network failures, 5xx, 408 and 429 retry with backoff (1s → 30s) and right
 * away when the browser comes back online or the tab returns; a 401 pauses
 * until the next sign-in. Any other refusal (closed submission window,
 * validation) drops the operation and every later one for that task, and
 * reports it so the page can take the task back off the list.
 */

const PREFIX = "wz-outbox:v1:";
const MAX_BACKOFF_MS = 30_000;

/** The fields an edit can change, as the API takes them. */
export type TaskPatch = Partial<Pick<Task, "title" | "description" | "status" | "priority" | "dueDate">>;

type Body = Record<string, unknown>;

type Op = {
  opId: string;
  kind: "create" | "update";
  /** The task's id (made on this device for creates). */
  id: string;
  body: Body;
  /** The whole task as it should look once this op is applied, for showing it before it syncs. */
  snapshot: RawTask;
};

export type OutboxEvent =
  | { type: "synced"; task: Task }
  | { type: "failed"; id: string; title: string; kind: "create" | "update"; message: string }
  | { type: "changed" };

// ─── storage ────────────────────────────────────────────────────────────────

const keyFor = (userId: string) => `${PREFIX}${userId}`;

/**
 * Used instead of localStorage once a write to it fails (blocked, or full):
 * the queue keeps working for this tab, it just won't survive a reload.
 */
const memory = new Map<string, Op[]>();
let storageBroken = false;

function load(userId: string): Op[] {
  if (storageBroken) return [...(memory.get(userId) ?? [])];
  try {
    const raw = localStorage.getItem(keyFor(userId));
    return raw ? (JSON.parse(raw) as Op[]) : [];
  } catch {
    storageBroken = true;
    return [...(memory.get(userId) ?? [])];
  }
}

function write(userId: string, ops: Op[]): void {
  memory.set(userId, ops);
  if (storageBroken) return;
  try {
    if (ops.length) localStorage.setItem(keyFor(userId), JSON.stringify(ops));
    else localStorage.removeItem(keyFor(userId));
  } catch {
    storageBroken = true;
  }
}

// ─── events ─────────────────────────────────────────────────────────────────

const listeners = new Set<(e: OutboxEvent) => void>();

export function subscribeOutbox(listener: (e: OutboxEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const emit = (e: OutboxEvent) => listeners.forEach((l) => l(e));

// ─── ids & serialising ──────────────────────────────────────────────────────

/** A v4 UUID (the API validates the id as one). `randomUUID` needs a secure context. */
export function newTaskId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const toWire = (patch: TaskPatch): Body => ({
  ...patch,
  ...(patch.dueDate !== undefined && { dueDate: new Date(patch.dueDate).toISOString() }),
});

/** Apply an edit to a stored task, keeping completedAt consistent with the status. */
function applyPatch(task: RawTask, patch: Body): RawTask {
  const next = { ...task, ...patch };
  if (patch.status !== undefined) {
    next.completedAt = patch.status === "completed" ? (task.completedAt ?? new Date().toISOString()) : null;
  }
  return next;
}

const toTask = (raw: RawTask): Task => ({ ...parseTask(raw), pending: true });

// ─── queueing ───────────────────────────────────────────────────────────────

/** Queue a new task. Returns it as it should show right now (marked pending). */
export function enqueueCreate(userId: string, task: Task): Task {
  const snapshot: RawTask = { ...task, pending: undefined };
  const body: Body = {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate.toISOString(),
    clientCreatedAt: task.createdAt.toISOString(),
  };
  write(userId, [...load(userId), { opId: newTaskId(), kind: "create", id: task.id, body, snapshot }]);
  emit({ type: "changed" });
  void flush(userId);
  return toTask(JSON.parse(JSON.stringify(snapshot)));
}

/** True while a task has anything still waiting to reach the server. */
export function isQueued(userId: string, id: string): boolean {
  return load(userId).some((op) => op.id === id);
}

/**
 * Queue an edit to a task that is still in the outbox. Folds into a waiting op
 * for the same task when it can (a tick on an unsent task just changes what the
 * create sends). Never folds into the op at the head of the queue, which may be
 * on the wire right now (in this tab or another).
 */
export function enqueueUpdate(userId: string, id: string, patch: TaskPatch): Task | null {
  const ops = load(userId);
  let lastIndex = -1;
  ops.forEach((op, i) => {
    if (op.id === id) lastIndex = i;
  });
  if (lastIndex === -1) return null;
  const wire = toWire(patch);
  const last = ops[lastIndex]!;
  const snapshot = applyPatch(last.snapshot, wire);

  if (lastIndex > 0) {
    ops[lastIndex] = { ...last, body: { ...last.body, ...wire }, snapshot };
  } else {
    ops.push({ opId: newTaskId(), kind: "update", id, body: wire, snapshot });
  }
  write(userId, ops);
  emit({ type: "changed" });
  void flush(userId);
  return toTask(snapshot);
}

/**
 * Lay the outbox over a list from the server: unsent tasks are added, unsent
 * edits applied, and everything still waiting is marked `pending`.
 */
export function withOutbox(userId: string, tasks: Task[]): Task[] {
  const latest = new Map<string, Op>();
  for (const op of load(userId)) latest.set(op.id, op);
  if (!latest.size) return tasks;

  const seen = new Set<string>();
  const merged = tasks.map((t) => {
    const op = latest.get(t.id);
    if (!op) return t;
    seen.add(t.id);
    return toTask(op.snapshot);
  });
  for (const [id, op] of latest) if (!seen.has(id)) merged.push(toTask(op.snapshot));
  return merged;
}

// ─── sending ────────────────────────────────────────────────────────────────

type Runner = { active: boolean; paused: boolean; attempt: number; timer: number | undefined };
const runners = new Map<string, Runner>();
const runnerFor = (userId: string): Runner => {
  let r = runners.get(userId);
  if (!r) runners.set(userId, (r = { active: false, paused: false, attempt: 0, timer: undefined }));
  return r;
};

const retryable = (e: unknown) =>
  !(e instanceof ApiRequestError) || e.status >= 500 || e.status === 408 || e.status === 429;

/** Only one tab sends; the others leave it (their ops are in the same storage). */
async function withLock(userId: string, task: () => Promise<void>): Promise<void> {
  if (!navigator.locks) return task();
  await navigator.locks.request(`${PREFIX}${userId}`, { ifAvailable: true }, async (lock) => {
    if (lock) await task();
  });
}

/** Send what's waiting, in order, until the queue is empty or something has to wait. */
export async function flush(userId: string): Promise<void> {
  const runner = runnerFor(userId);
  if (runner.active || runner.paused) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return; // "online" restarts it
  runner.active = true;
  window.clearTimeout(runner.timer);

  try {
    await withLock(userId, async () => {
      for (;;) {
        const op = load(userId)[0];
        if (!op) return;
        try {
          const raw =
            op.kind === "create"
              ? await api<RawTask>("/tasks", { method: "POST", body: op.body })
              : await api<RawTask>(`/tasks/${op.id}`, { method: "PATCH", body: op.body });
          write(
            userId,
            load(userId).filter((o) => o.opId !== op.opId),
          );
          runner.attempt = 0;
          emit({ type: "synced", task: parseTask(raw) });
        } catch (error) {
          if (error instanceof ApiRequestError && error.status === 401) {
            runner.paused = true; // resumes when startOutbox runs for the next sign-in
            return;
          }
          if (retryable(error)) {
            const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** runner.attempt++);
            runner.timer = window.setTimeout(() => void flush(userId), delay);
            return;
          }
          // Refused for good: drop this op and everything after it for the same task.
          write(
            userId,
            load(userId).filter((o) => o.opId !== op.opId && !(o.id === op.id && op.kind === "create")),
          );
          emit({
            type: "failed",
            id: op.id,
            title: String(op.snapshot.title ?? "Task"),
            kind: op.kind,
            message: error instanceof Error ? error.message : "Something went wrong",
          });
        }
      }
    });
  } finally {
    runner.active = false;
    emit({ type: "changed" });
  }
}

/**
 * Start sending for a signed-in user: now, whenever the browser comes back
 * online or the tab returns to the front. Returns a stop function.
 */
export function startOutbox(userId: string): () => void {
  const runner = runnerFor(userId);
  runner.paused = false;
  runner.attempt = 0;
  const now = () => {
    runner.attempt = 0;
    void flush(userId);
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") now();
  };
  window.addEventListener("online", now);
  document.addEventListener("visibilitychange", onVisible);
  void flush(userId);
  return () => {
    window.removeEventListener("online", now);
    document.removeEventListener("visibilitychange", onVisible);
    window.clearTimeout(runner.timer);
  };
}
