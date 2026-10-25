import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Clock, Lock, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTasks } from "@/contexts/TaskContext";
import type { Task } from "@/contexts/TaskContext";
import { PageHeader } from "@/components/layout/Page";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

/** A member's own board ("/todos/:userId"). Admins are sent to their dashboard. */
const TaskDetails = () => {
    const { memberId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { getTasks, addTask, updateTask, taskWindow, refreshTaskWindow } = useTasks();

    const [tasks, setTasks] = useState<Task[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editing, setEditing] = useState<Task | null>(null);

    useEffect(() => {
        if (user && user.role !== "member") navigate("/dashboard", { replace: true });
    }, [user, navigate]);

    useEffect(() => {
        if (!memberId) return;
        getTasks(memberId)
            .then((result) => setTasks(result || []))
            .catch(() => setTasks([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [memberId]);

    if (!user) return null;

    // Submissions are open unless the workspace restricts them to set hours.
    const restricted = !!taskWindow?.enabled;
    const closed = restricted && !taskWindow.open;
    const isOwnBoard = String(user.id) === String(memberId);

    const openAdd = async () => {
        // Re-check first, so a window that closed while the page sat open
        // doesn't hand out a form that can only fail.
        const current = await refreshTaskWindow();
        if (current?.enabled && !current.open) {
            toast.error(`Task submissions are closed. They open ${current.label}.`);
            return;
        }
        setEditing(null);
        setIsFormOpen(true);
    };

    const open = tasks.filter((t) => t.status !== "completed").length;

    return (
        <>
            <PageHeader
                title={`${greeting()}, ${user.name.split(" ")[0]}`}
                description={
                    tasks.length === 0
                        ? "Add what you're working on today. Finishing all of today's tasks marks you present."
                        : open === 0
                          ? "Everything is done. Nice work."
                          : `${open} ${open === 1 ? "task" : "tasks"} still open. Finishing all of today's tasks marks you present.`
                }
                actions={
                    <>
                        {taskWindow && (
                            <span
                                className={cn(
                                    "inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm",
                                    closed ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground"
                                )}
                            >
                                {closed ? <Lock className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                                {restricted ? (closed ? `Opens ${taskWindow.label}` : `Open ${taskWindow.label}`) : "Add tasks anytime"}
                            </span>
                        )}
                        {isOwnBoard && (
                            <Button
                                onClick={openAdd}
                                disabled={closed}
                                title={closed ? `Your admin limited task submissions to ${taskWindow?.label}` : undefined}
                            >
                                <Plus className="h-4 w-4" />
                                Add task
                            </Button>
                        )}
                    </>
                }
            />

            <TaskBoard
                tasks={tasks}
                canManage={() => isOwnBoard}
                canDelete={false}
                onStatusChange={async (task, status) => {
                    const updated = await updateTask(task.id, { status });
                    if (updated) setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
                }}
                onEdit={(task) => {
                    setEditing(task);
                    setIsFormOpen(true);
                }}
                onDelete={() => {}}
                {...(isOwnBoard && { onAdd: openAdd })}
                addDisabled={closed}
            />

            <TaskFormDialog
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                task={editing}
                description={
                    editing ? undefined : restricted ? `Submissions for your workspace are open ${taskWindow?.label}.` : undefined
                }
                onSubmit={async (values) => {
                    if (editing) {
                        const updated = await updateTask(editing.id, values);
                        if (updated) setTasks((prev) => prev.map((t) => (t.id === editing.id ? updated : t)));
                        return !!updated;
                    }
                    if (!memberId) return false;
                    const created = await addTask({ ...values, memberId });
                    if (created) setTasks((prev) => [...prev, created]);
                    return !!created;
                }}
            />
        </>
    );
};

export default TaskDetails;
