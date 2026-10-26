import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import type { Task, TaskPriority, TaskStatus } from "@/contexts/TaskContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { STATUS_ORDER, priorityLabels, taskStatusLabels } from "@/lib/projectMeta";

export type TaskFormValues = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date;
};

const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

/** Add a task, or edit one when `task` is set. Mirrors the API's rules (title ≥ 3, description ≥ 10). */
export const TaskFormDialog = ({
  open,
  onOpenChange,
  task,
  description,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task?: Task | null;
  description?: string;
  onSubmit: (values: TaskFormValues) => Promise<boolean>;
}) => {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [due, setDue] = useState(toLocalInput(new Date()));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDetails(task?.description ?? "");
    setStatus(task?.status ?? "todo");
    setPriority(task?.priority ?? "medium");
    // New tasks default to the end of today.
    const end = new Date();
    end.setHours(18, 0, 0, 0);
    setDue(toLocalInput(task ? new Date(task.dueDate) : end));
  }, [open, task]);

  const titleOk = title.trim().length >= 3;
  const detailsOk = details.trim().length >= 10;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleOk || !detailsOk) return;
    setIsSaving(true);
    try {
      const ok = await onSubmit({
        title: title.trim(),
        description: details.trim(),
        status,
        priority,
        dueDate: new Date(due),
      });
      if (ok) onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{task ? "Edit task" : "Add a task"}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Draft the homepage copy"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-details">Details</Label>
              <Textarea
                id="task-details"
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="What does done look like?"
              />
              {details.length > 0 && !detailsOk && (
                <p className="text-xs text-muted-foreground">A little more detail, at least 10 characters.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_ORDER.map((s) => (
                      <SelectItem key={s} value={s}>
                        {taskStatusLabels[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(priorityLabels) as TaskPriority[]).map((p) => (
                      <SelectItem key={p} value={p}>
                        {priorityLabels[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-due">Due</Label>
              <Input id="task-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!titleOk || !detailsOk || isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {task ? "Save changes" : "Add task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
