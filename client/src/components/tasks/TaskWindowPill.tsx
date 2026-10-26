import { Clock, Lock } from "lucide-react";
import type { TaskWindowInfo } from "@/contexts/TaskContext";
import { cn } from "@/lib/utils";

/** "Add tasks anytime" / "Open 9:00–11:00 AM" / "Opens 9:00 AM": the member's submission hours. */
export const TaskWindowPill = ({ taskWindow }: { taskWindow: TaskWindowInfo }) => {
  const restricted = taskWindow.enabled;
  const closed = restricted && !taskWindow.open;
  return (
    <span
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm",
        closed ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground"
      )}
    >
      {closed ? <Lock className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
      {restricted ? (closed ? `Opens ${taskWindow.label}` : `Open ${taskWindow.label}`) : "Add tasks anytime"}
    </span>
  );
};
