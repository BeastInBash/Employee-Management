import { lazy } from "react";
import type { ComponentType } from "react";

type Loader = () => Promise<{ default: ComponentType }>;

const RELOAD_KEY = "wz-chunk-reload";

/**
 * A route-level page loaded on first use, plus a `preload()` to fetch its code
 * early (on hover, or when the browser is idle) so the visit itself is instant.
 *
 * After a deploy, a tab that's been open a while can ask for a chunk that no
 * longer exists. Instead of breaking, it reloads once to pick up the new build;
 * a second failure in the same session is a real error and is thrown.
 */
export function lazyPage(load: Loader) {
  let promise: Promise<{ default: ComponentType }> | null = null;
  const preload = () => {
    promise ??= load().catch((error) => {
      promise = null; // let a later attempt retry
      throw error;
    });
    return promise;
  };

  const Component = lazy(async () => {
    try {
      const mod = await preload();
      sessionStorage.removeItem(RELOAD_KEY);
      return mod;
    } catch (error) {
      if (!sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, "1");
        window.location.reload();
        return new Promise<never>(() => {}); // the reload takes over
      }
      throw error;
    }
  });

  return { Component, preload };
}

/** Run `task` when the browser has a quiet moment (or after a short delay where unsupported). */
export function whenIdle(task: () => void): () => void {
  // Safari doesn't have requestIdleCallback (TypeScript's DOM types assume it does).
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(task, { timeout: 4000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(task, 1500);
  return () => window.clearTimeout(id);
}

/** True when the visitor asked to save data (Data Saver) or is on a very slow connection. */
export function shouldSaveData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection;
  return !!connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? "");
}
