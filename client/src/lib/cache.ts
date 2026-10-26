// A small persistent cache for API data, so a refresh paints the last known
// state at once and the network only has to update it (stale-while-revalidate).
//
// Entries live in localStorage under one versioned prefix. Callers put the
// signed-in user's id in every key; signing out (or an expired session) clears
// all of them, so one person never sees another's data on a shared browser.

const PREFIX = "wz-cache:v1:";
/** Anything older is ignored: a week-old dashboard is more misleading than a spinner. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type Entry = { at: number; data: unknown };

/** The cached value for `key`, or undefined when missing, too old, or unreadable. */
export function readCache<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as Entry;
    if (Date.now() - entry.at > MAX_AGE_MS) {
      localStorage.removeItem(PREFIX + key);
      return undefined;
    }
    return entry.data as T;
  } catch {
    return undefined;
  }
}

/** Store `data` (JSON-serialisable; Dates become ISO strings) for `key`. */
export function writeCache(key: string, data: unknown): void {
  const value = JSON.stringify({ at: Date.now(), data } satisfies Entry);
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    // Storage full or blocked (private mode). Drop our own entries and try once
    // more; if that fails too, the app simply works uncached.
    clearCache();
    try {
      localStorage.setItem(PREFIX + key, value);
    } catch {
      /* uncached it is */
    }
  }
}

/** Remove every cached entry (on sign-out, or when storage runs out). */
export function clearCache(): void {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k);
  } catch {
    /* nothing to clear */
  }
}
