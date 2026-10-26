import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { readCache, writeCache } from "@/lib/cache";

/**
 * `useState` that starts from the last cached value for `key` and caches every
 * change, so a page renders its previous data instantly after a refresh while
 * its loader fetches the current state and replaces it.
 *
 * - `key` should include the user's id and anything the data depends on (a
 *   project id, a date range). `null` turns caching off (e.g. signed out).
 * - When `key` changes, the state switches to that key's cached value.
 * - `revive` rebuilds values that JSON can't carry (Dates) from the cached copy.
 */
export function usePersistentState<T>(
  key: string | null,
  initial: T,
  revive?: (cached: unknown) => T,
): [T, Dispatch<SetStateAction<T>>] {
  const fromCache = (k: string | null): T => {
    if (!k) return initial;
    const cached = readCache<unknown>(k);
    if (cached === undefined) return initial;
    try {
      return revive ? revive(cached) : (cached as T);
    } catch {
      return initial; // an older shape we can no longer read
    }
  };

  // `cached` marks a value read from storage, which isn't written back (that
  // would reset its age on every visit and the entry would never expire).
  const [state, setState] = useState<{ key: string | null; value: T; cached: boolean }>(() => ({
    key,
    value: fromCache(key),
    cached: true,
  }));

  // A new key (another project, another month, another user): show its cached
  // value straight away, during this render, instead of the previous key's.
  let current = state;
  if (state.key !== key) {
    current = { key, value: fromCache(key), cached: true };
    setState(current);
  }

  useEffect(() => {
    if (current.cached || !current.key || current.value === null || current.value === undefined) return;
    writeCache(current.key, current.value);
  }, [current.key, current.value, current.cached]);

  // Stable like React's own setter, so it's safe in dependency arrays.
  const setValue: Dispatch<SetStateAction<T>> = useCallback(
    (update) =>
      setState((prev) => ({
        key: prev.key,
        value: typeof update === "function" ? (update as (p: T) => T)(prev.value) : update,
        cached: false,
      })),
    [],
  );

  return [current.value, setValue];
}
