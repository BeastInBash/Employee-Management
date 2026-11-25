import type { Task } from "@/contexts/TaskContext";
import { api, ApiRequestError } from "@/lib/api";
import { parseTask } from "@/lib/tasks";
import type { RawTask } from "@/lib/tasks";

/**
 * The task outbox: every new task (and every edit to a task that hasn't reached
 * the server yet) is saved here first and sent in the background, so the list
 * updates the moment someone presses "Add". It covers a member's own tasks, an
 * admin assigning work on a member's page, and the project board.
 *
 * - **Durable:** the queue lives in localStorage per signed-in user, so it
 *   survives a refresh, a closed tab, going offline or signing out (it sends
 *   after the same person signs in again).
 * - **In order, one at a time:** an edit can never overtake the create it edits.
 * - **Safe to retry:** the task id is made here and the API treats a repeated id
 *   as "already have it", so a lost response can't create a duplicate.
 * - **One sender:** with several tabs open, a Web Lock lets only one send.
 * - **Never stuck:** a request that hasn't answered in 20s is abandoned and
 *   retried (safe, because of the id), so one hung call can't hold up the queue.
 *
 * Network failures, timeouts, 5xx, 408 and 429 retry after 2s, then 4s, 8s, and
 * every 15s after that, and right away when the browser comes back online or
 * the tab returns; a 401 pauses until the next sign-in. Any other refusal
 * (closed submission window, validation) drops the operation and every later
 * one for that task, and reports it so the page can take the task back off.
 *
 * Each op lists the **scopes** (lists) it shows on: "own" (the signer-in's own
 * tasks), "member:<userId>" (an admin's view of a member), "project:<id>".
 */

const PREFIX = "wz-outbox:v1:";
const FIRST_RETRY_MS = 2_000;
const MAX_BACKOFF_MS = 15_000;
const REQUEST_TIMEOUT_MS = 20_000;

/** The fields an edit can change, as the API takes them. */
export type TaskPatch = Partial<Pick<Task, "title" | "description" | "status" | "priority" | "dueDate" | "tags">>;

type Body = Record<string, unknown>;

type Op = {
  opId: string;
  kind: "create" | "update";
  /** The task's id (made on this device for creates). */
  id: string;
  /** Where a create is POSTed (updates always PATCH /tasks/:id). */
  path: string;
  /** The response wraps the task under this key (the project route answers `{ task }`). */
  unwrap?: "task";
  body: Body;
  /** The whole task, as the API would send it, once this op is applied: shown until it syncs. */
  snapshot: RawTask;
  /** The lists this task shows on while it's waiting. */
  scopes: string[];
};

export type OutboxEvent =
  | { type: "synced"; id: string; raw: RawTask; scopes: string[] }
  | { type: "failed"; id: string; title: string; kind: "create" | "update"; message: string; scopes: string[] }
  | { type: "changed" };

// ─── storage ────────────────────────────────────────────────────────────────

const keyFor = (userId: string) => `${PREFIX}${userId}`;

/**
 * Used instead of localStorage once a write to it fails (blocked, or full):
 * the queue keeps working for this tab, it just won't survive a reload.
 */
const memory = new Map<string, Op[]>();
let storageBroken = false;

/** Ops saved by the first version (members' own tasks only) lack path/scopes. */
const upgrade = (op: Partial<Op> & Pick<Op, "opId" | "kind" | "id" | "body" | "snapshot">): Op => ({
  ...op,
  path: op.path ?? "/tasks",
  scopes: op.scopes ?? ["own"],
});

function load(userId: string): Op[] {
  if (storageBroken) return [...(memory.get(userId) ?? [])];
  try {
    const raw = localStorage.getItem(keyFor(userId));
    return raw ? (JSON.parse(raw) as Op[]).map(upgrade) : [];
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

/** JSON round trip: Dates become ISO strings, as they would from the API. */
const asRaw = <T>(value: T): RawTask => JSON.parse(JSON.stringify(value));

/** Apply an edit to a stored task, keeping completedAt consistent with the status. */
function applyPatch(task: RawTask, patch: Body): RawTask {
  const next = { ...task, ...patch };
  if (patch.status !== undefined) {
    next.completedAt = patch.status === "completed" ? (task.completedAt ?? new Date().toISOString()) : null;
  }
  return next;
}

const pending = (raw: RawTask): RawTask => ({ ...raw, pending: true });

// ─── queueing ───────────────────────────────────────────────────────────────

/**
 * Queue a new task. `snapshot` is the task as the API would return it (what the
 * lists show meanwhile), `body` what gets POSTed to `path` (its `id` and
 * `clientCreatedAt` are filled in from the snapshot). Returns the snapshot,
 * marked pending, to put on the list right away.
 */
export function enqueueCreate(
  userId: string,
  {
    snapshot,
    body,
    scopes,
    path = "/tasks",
    unwrap,
  }: {
    snapshot: Record<string, unknown> & { id: string };
    body: Body;
    scopes: string[];
    path?: string;
    unwrap?: "task";
  },
): RawTask {
  const raw = asRaw(snapshot);
  const op: Op = {
    opId: newTaskId(),
    kind: "create",
    id: snapshot.id,
    path,
    ...(unwrap && { unwrap }),
    body: { ...body, id: snapshot.id, clientCreatedAt: raw.createdAt ?? new Date().toISOString() },
    snapshot: raw,
    scopes,
  };
  write(userId, [...load(userId), op]);
  emit({ type: "changed" });
  void flush(userId);
  return pending(raw);
}

/** True while a task has anything still waiting to reach the server. */
export function isQueued(userId: string, id: string): boolean {
  return load(userId).some((op) => op.id === id);
}

/**
 * Queue an edit to a task that is still in the outbox. Folds into a waiting op
 * for the same task when it can (a tick on an unsent task just changes what the
 * create sends). Never folds into the op at the head of the queue, which may be
 * on the wire right now (in this tab or another). Returns the task as it should
 * now show (raw, pending), or null when the task isn't queued.
 */
export function enqueueUpdate(userId: string, id: string, patch: TaskPatch): RawTask | null {
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
    ops.push({
      opId: newTaskId(),
      kind: "update",
      id,
      path: `/tasks/${id}`,
      body: wire,
      snapshot,
      scopes: last.scopes,
    });
  }
  write(userId, ops);
  emit({ type: "changed" });
  void flush(userId);
  return pending(snapshot);
}

/**
 * Lay the outbox over a list from the server for one scope: unsent tasks are
 * added, unsent edits applied, and everything still waiting is marked pending.
 * `fromRaw` turns a stored task into the list's own item type.
 */
export function withOutbox<T extends { id: string }>(
  userId: string,
  list: T[],
  scope: string,
  fromRaw: (raw: RawTask) => T,
): T[] {
  const latest = new Map<string, Op>();
  for (const op of load(userId)) if (op.scopes.includes(scope)) latest.set(op.id, op);
  if (!latest.size) return list;

  const seen = new Set<string>();
  const merged = list.map((t) => {
    const op = latest.get(t.id);
    if (!op) return t;
    seen.add(t.id);
    return fromRaw(pending(op.snapshot));
  });
  for (const [id, op] of latest) if (!seen.has(id)) merged.push(fromRaw(pending(op.snapshot)));
  return merged;
}

// ─── task helpers (what the contexts use) ───────────────────────────────────

type NewTaskFields = Pick<Task, "title" | "description" | "priority" | "memberId"> &
  Partial<Pick<Task, "status" | "tags">> & { dueDate: Date | string };

/**
 * Queue a new task for POST /api/tasks and return it, pending, for the list.
 * `extraBody` adds request-only fields (an admin's `userId` for the assignee).
 */
export function queueTask(
  userId: string,
  fields: NewTaskFields,
  { scopes, extraBody = {} }: { scopes: string[]; extraBody?: Body },
): Task {
  const now = new Date();
  const status = fields.status ?? "todo";
  const dueDate = new Date(fields.dueDate);
  const tags = fields.tags ?? [];
  const raw = enqueueCreate(userId, {
    snapshot: {
      id: newTaskId(),
      title: fields.title,
      description: fields.description,
      status,
      priority: fields.priority,
      dueDate,
      memberId: fields.memberId,
      createdAt: now,
      completedAt: status === "completed" ? now : null,
      project: null,
      tags,
    },
    body: {
      title: fields.title,
      description: fields.description,
      status,
      priority: fields.priority,
      dueDate: dueDate.toISOString(),
      ...(tags.length && { tags }),
      ...extraBody,
    },
    scopes,
  });
  return parseTask(raw);
}

/** Queue an edit to a task that's still waiting; null when it isn't queued (send it normally then). */
export function queueTaskEdit(userId: string, id: string, edit: Partial<Task>): Task | null {
  if (!isQueued(userId, id)) return null;
  const { title, description, status, priority, dueDate, tags } = edit;
  const raw = enqueueUpdate(userId, id, {
    ...(title !== undefined && { title }),
    ...(description !== undefined && { description }),
    ...(status !== undefined && { status }),
    ...(priority !== undefined && { priority }),
    ...(dueDate !== undefined && { dueDate }),
    ...(tags !== undefined && { tags }),
  });
  return raw ? parseTask(raw) : null;
}

// ─── sending ────────────────────────────────────────────────────────────────

type Runner = { active: boolean; paused: boolean; attempt: number; timer: number | undefined };
const runners = new Map<string, Runner>();
const runnerFor = (userId: string): Runner => {
  let r = runners.get(userId);
  if (!r) runners.set(userId, (r = { active: false, paused: false, attempt: 0, timer: undefined }));
  return r;
};

/** Anything that isn't a definite answer from the server (incl. our own timeout) is worth retrying. */
const retryable = (e: unknown) =>
  !(e instanceof ApiRequestError) || e.status >= 500 || e.status === 408 || e.status === 429;

/** Only one tab sends; the others leave it (their ops are in the same storage). */
async function withLock(userId: string, task: () => Promise<void>): Promise<void> {
  if (!navigator.locks) return task();
  await navigator.locks.request(`${PREFIX}${userId}`, { ifAvailable: true }, async (lock) => {
    if (lock) await task();
  });
}

async function send(op: Op): Promise<RawTask> {
  const res =
    op.kind === "create"
      ? await api<RawTask>(op.path, { method: "POST", body: op.body, timeoutMs: REQUEST_TIMEOUT_MS })
      : await api<RawTask>(`/tasks/${op.id}`, { method: "PATCH", body: op.body, timeoutMs: REQUEST_TIMEOUT_MS });
  return op.unwrap ? (res[op.unwrap] as RawTask) : res;
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
          const raw = await send(op);
          write(
            userId,
            load(userId).filter((o) => o.opId !== op.opId),
          );
          runner.attempt = 0;
          emit({ type: "synced", id: op.id, raw, scopes: op.scopes });
        } catch (error) {
          if (error instanceof ApiRequestError && error.status === 401) {
            runner.paused = true; // resumes when startOutbox runs for the next sign-in
            return;
          }
          if (retryable(error)) {
            const delay = Math.min(MAX_BACKOFF_MS, FIRST_RETRY_MS * 2 ** runner.attempt++);
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
            scopes: op.scopes,
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
