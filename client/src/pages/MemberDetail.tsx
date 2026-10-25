import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarCheck, Loader2, Plus, UserX } from "lucide-react";
import { useMembers } from "@/contexts/MemberContext";
import type { Task } from "@/contexts/MemberContext";
import { PageHeader } from "@/components/layout/Page";
import { EmptyState, PersonAvatar } from "@/components/projects/shared";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** An admin's view of one member: their task board, with assign / edit / delete. */
const MemberDetail = () => {
    const { memberId } = useParams();
    const navigate = useNavigate();
    const { members, getMemberTasks, addTask, updateTask, deleteTask, canManageTask } = useMembers();

    const [tasks, setTasks] = useState<Task[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editing, setEditing] = useState<Task | null>(null);
    const [toDelete, setToDelete] = useState<Task | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // The route param is the member's User id.
    const member = members.find((m) => m.userId == memberId);

    useEffect(() => {
        if (!memberId) return;
        getMemberTasks(memberId)
            .then((result) => setTasks(result || []))
            .catch(() => setTasks([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [memberId]);

    if (!members.length) {
        return (
            <div className="flex justify-center py-24">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!member || !memberId) {
        return (
            <EmptyState
                icon={UserX}
                title="This member isn't in your workspace"
                body="They may have been removed, or the link is out of date."
                action={<Button onClick={() => navigate("/dashboard")}>Back to members</Button>}
            />
        );
    }

    const name = member.user?.name ?? member.name;
    const done = tasks.filter((t) => t.status === "completed").length;

    return (
        <>
            <PageHeader
                back={{ to: "/dashboard", label: "Members" }}
                title={
                    <span className="flex items-center gap-3">
                        <PersonAvatar person={{ name }} className="h-10 w-10 text-sm" />
                        {name}
                    </span>
                }
                description={
                    <>
                        {member.role}, {member.email}
                        {tasks.length > 0 && (
                            <span className="block sm:inline">
                                <span className="hidden sm:inline">. </span>
                                {done} of {tasks.length} tasks done.
                            </span>
                        )}
                    </>
                }
                actions={
                    <>
                        <Button variant="outline" onClick={() => navigate(`/dashboard/member/${memberId}/attendance`)}>
                            <CalendarCheck className="h-4 w-4" />
                            Attendance
                        </Button>
                        <Button
                            onClick={() => {
                                setEditing(null);
                                setIsFormOpen(true);
                            }}
                        >
                            <Plus className="h-4 w-4" />
                            Assign task
                        </Button>
                    </>
                }
            />

            <TaskBoard
                tasks={tasks}
                canManage={(t) => canManageTask(t.id)}
                canDelete
                onStatusChange={async (task, status) => {
                    const updated = await updateTask(task.id, { status });
                    if (updated) setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
                }}
                onEdit={(task) => {
                    setEditing(task);
                    setIsFormOpen(true);
                }}
                onDelete={setToDelete}
                onAdd={() => {
                    setEditing(null);
                    setIsFormOpen(true);
                }}
            />

            <TaskFormDialog
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                task={editing}
                description={editing ? undefined : `Assign a task to ${name}. Assigned tasks are never blocked by submission hours.`}
                onSubmit={async (values) => {
                    if (editing) {
                        const updated = await updateTask(editing.id, values);
                        if (updated) setTasks((prev) => prev.map((t) => (t.id === editing.id ? updated : t)));
                        return !!updated;
                    }
                    const created = await addTask({ ...values, memberId });
                    if (created) setTasks((prev) => [...prev, created]);
                    return !!created;
                }}
            />

            <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this task?</AlertDialogTitle>
                        <AlertDialogDescription>“{toDelete?.title}” will be removed for good.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={isDeleting}
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={async (e) => {
                                e.preventDefault();
                                if (!toDelete) return;
                                setIsDeleting(true);
                                try {
                                    if (await deleteTask(toDelete.id)) {
                                        setTasks((prev) => prev.filter((t) => t.id !== toDelete.id));
                                        setToDelete(null);
                                    }
                                } finally {
                                    setIsDeleting(false);
                                }
                            }}
                        >
                            {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                            Delete task
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default MemberDetail;
