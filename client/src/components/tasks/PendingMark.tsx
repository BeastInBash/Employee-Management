import { CloudUpload } from "lucide-react";
import { cn } from "@/lib/utils";

/** Marks a task that is on the list but still on its way to the server (lib/outbox). */
export const PendingMark = ({ className }: { className?: string }) => (
  <span
    className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}
    title="Saved on this device. It reaches the server as soon as you're online."
  >
    <CloudUpload className="h-3.5 w-3.5 animate-pulse motion-reduce:animate-none" aria-hidden />
    Saving…
  </span>
);
