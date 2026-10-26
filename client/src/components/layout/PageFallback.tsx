import { useEffect, useState } from "react";
import { Feather } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/** Renders nothing for the first moments, so a fast load never flashes a placeholder. */
const useDelayed = (ms: number) => {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShown(true), ms);
    return () => window.clearTimeout(id);
  }, [ms]);
  return shown;
};

/**
 * Stand-in for a signed-in page whose code is still loading: the shape of a page
 * header and two panels, inside the app shell (the sidebar stays put).
 */
export const PageFallback = () => {
  const shown = useDelayed(200);
  if (!shown) return null;
  return (
    <div role="status" aria-label="Loading page" className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-4 w-96 max-w-full rounded-md" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </div>
  );
};

/** Stand-in for a public page (landing, sign-in) while its code loads. */
export const ScreenFallback = () => {
  const shown = useDelayed(200);
  return (
    <div role="status" aria-label="Loading" className="flex min-h-screen items-center justify-center bg-background">
      {shown && <Feather className="h-6 w-6 animate-pulse text-primary" aria-hidden />}
    </div>
  );
};
