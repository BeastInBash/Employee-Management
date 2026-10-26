import { useCallback, useEffect, useRef, useState } from "react";
import type { SetStateAction } from "react";
import type { Task } from "@/contexts/TaskContext";
import { toast } from "@/components/ui/sonner";
import { api } from "@/lib/api";
import { readCache, writeCache } from "@/lib/cache";
import { parseTask } from "@/lib/tasks";
import type { RawTask } from "@/lib/tasks";

/** How often to check for new work while the tab is in front. */
const POLL_MS = 60_000;

/**
 * A member's task list that stays current without a page refresh: it reloads
 * when they come back to the tab or window (or back online), and checks once a
 * minute while the tab is visible. Tasks that appear from elsewhere — an admin
 * or lead assigning work — are announced with a toast.
 *
 * `tasks` is null until the first load. `setTasks` is for the page's own
 * optimistic updates; whatever it sets counts as already seen, so tasks the
 * member adds themselves are never announced.
 */
export function useLiveTasks(userId: string | undefined) {
  // The last list this browser saw, shown at once on load while the network
  // catches up (dates come back as strings, so they're parsed again).
  const cacheKey = userId ? `${userId}:tasks` : null;
  const readCached = useCallback(
    () => (cacheKey ? (readCache<RawTask[]>(cacheKey)?.map(parseTask) ?? null) : null),
    [cacheKey],
  );

  const [tasks, setTasksState] = useState<Task[] | null>(readCached);
  const known = useRef<Set<string> | null>(null);
  const loading = useRef(false);
  const showingCached = useRef(false);
  // Set by the page's own updates, so the effect below saves them.
  const changedLocally = useRef(false);

  const load = useCallback(
    async (background: boolean) => {
      if (!userId || loading.current) return;
      loading.current = true;
      try {
        const { tasks: raw = [] } = await api<{ tasks?: RawTask[] }>(`/tasks/${userId}`);
        const next = raw.map(parseTask);
        if (background && known.current) {
          const added = next.filter((t) => !known.current!.has(t.id));
          if (added.length === 1) toast.info(`New task on your list: ${added[0]!.title}`);
          else if (added.length > 1) toast.info(`${added.length} new tasks on your list`);
        }
        known.current = new Set(next.map((t) => t.id));
        setTasksState(next);
        showingCached.current = false;
        if (cacheKey) writeCache(cacheKey, next);
      } catch {
        // Background checks fail quietly (a cold start or a dropped connection
        // shouldn't nag). The first load only speaks up when there's nothing
        // saved to show instead.
        if (!background && !showingCached.current) {
          toast.error("Your tasks couldn't be loaded. Check your connection and refresh the page.");
          setTasksState((prev) => prev ?? []);
        }
      } finally {
        loading.current = false;
      }
    },
    [userId, cacheKey],
  );

  useEffect(() => {
    const cached = readCached();
    showingCached.current = cached !== null;
    // Cached tasks count as seen: only work that arrives after this counts as new.
    known.current = cached ? new Set(cached.map((t) => t.id)) : null;
    setTasksState(cached);
    load(false);
  }, [load, readCached]);

  useEffect(() => {
    if (!changedLocally.current || !cacheKey || !tasks) return;
    changedLocally.current = false;
    writeCache(cacheKey, tasks);
  }, [cacheKey, tasks]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") load(true);
    };
    const timer = window.setInterval(refreshIfVisible, POLL_MS);
    window.addEventListener("focus", refreshIfVisible);
    window.addEventListener("online", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshIfVisible);
      window.removeEventListener("online", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [load]);

  const setTasks = useCallback((update: SetStateAction<Task[]>) => {
    changedLocally.current = true;
    setTasksState((prev) => {
      const next = typeof update === "function" ? update(prev ?? []) : update;
      known.current = new Set(next.map((t) => t.id));
      return next;
    });
  }, []);

  return { tasks, setTasks, refresh: () => load(true) };
}
