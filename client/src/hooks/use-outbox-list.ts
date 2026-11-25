import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import { subscribeOutbox, withOutbox } from "@/lib/outbox";
import type { RawTask } from "@/lib/tasks";

/**
 * Keeps a page's task list in step with the outbox for one scope (see
 * lib/outbox): when a queued task reaches the server it takes the server's copy
 * (still showing any edits queued behind it); when the server refuses a new
 * one it leaves the list; a refused edit calls `onEditRefused` (e.g. reload).
 * Lay the queue over the list when it loads with `withOutbox` from lib/outbox.
 */
export function useOutboxList<T extends { id: string }>(
  userId: string | undefined,
  scope: string | null,
  setList: Dispatch<SetStateAction<T[]>>,
  fromRaw: (raw: RawTask) => T,
  onEditRefused?: () => void,
) {
  useEffect(() => {
    if (!userId || !scope) return;
    return subscribeOutbox((e) => {
      if (e.type === "changed" || !e.scopes.includes(scope)) return;
      if (e.type === "synced") {
        setList((prev) =>
          withOutbox(
            userId,
            prev.map((t) => (t.id === e.id ? fromRaw(e.raw) : t)),
            scope,
            fromRaw,
          ),
        );
      } else if (e.kind === "create") {
        setList((prev) => prev.filter((t) => t.id !== e.id));
      } else {
        onEditRefused?.();
      }
    });
    // fromRaw/onEditRefused are expected to be stable enough; re-subscribing per render is harmless but noisy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, scope, setList]);
}
