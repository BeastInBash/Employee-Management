import { useCallback, useEffect, useRef, useState } from "react";
import type { SetStateAction } from "react";
import type { Task } from "@/contexts/TaskContext";
import { toast } from "@/components/ui/sonner";
import { api } from "@/lib/api";
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
  const [tasks, setTasksState] = useState<Task[] | null>(null);
  const known = useRef<Set<string> | null>(null);
  const loading = useRef(false);

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
      } catch {
        // Background checks fail quietly (a cold start or a dropped connection
        // shouldn't nag); only the first load says something.
        if (!background) {
          toast.error("Your tasks couldn't be loaded. Check your connection and refresh the page.");
          setTasksState((prev) => prev ?? []);
        }
      } finally {
        loading.current = false;
      }
    },
    [userId]
  );

  useEffect(() => {
    known.current = null;
    setTasksState(null);
    load(false);
  }, [load]);

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
    setTasksState((prev) => {
      const next = typeof update === "function" ? update(prev ?? []) : update;
      known.current = new Set(next.map((t) => t.id));
      return next;
    });
  }, []);

  return { tasks, setTasks, refresh: () => load(true) };
}
