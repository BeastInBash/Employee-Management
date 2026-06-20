import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
// import { useAuth } from "@/contexts/AuthContext";
import { useMembers } from "@/contexts/MemberContext";
// import { Skeleton } from "@/components/ui/skeleton";
import type { Task, TaskStatus, TaskPriority } from "@/contexts/MemberContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    ChevronLeft,
    PlusCircle,
    Edit,
    Trash2,
    Calendar,
    AlertCircle,
    Loader2,
    ChevronDown,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ThemeToggle } from "@/components/theme-provider";
import { format, isToday, isTomorrow, isPast } from "date-fns";

const statusColors = {
    todo: "bg-secondary text-secondary-foreground",
    in_progress: "bg-amber-500 text-white",
    review: "bg-blue-500 text-white",
    completed: "bg-accent text-accent-foreground",
};

const statusLabels = {
    todo: "To Do",
    in_progress: "In Progress",
    review: "Review",
    completed: "Completed",
};

const priorityColors = {
    low: "bg-slate-500 text-white",
    medium: "bg-blue-500 text-white",
    high: "bg-orange-500 text-white",
    urgent: "bg-red-500 text-white",
};

const priorityLabels = {
    low: "Low",
    medium: "Medium",
    high: "High",
    urgent: "Urgent",
};

const MemberDetail = () => {
    const { memberId } = useParams();
    const navigate = useNavigate();
    // const { user } = useAuth();
    const {
        members,
        getMemberTasks,
        addTask,
        updateTask,
        deleteTask,
        canManageTask,
    } = useMembers();

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [taskTitle, setTaskTitle] = useState("");
    // const [task, setTask] = useState<Task[]>([]);
    const [taskDescription, setTaskDescription] = useState("");
    const [taskStatus, setTaskStatus] = useState<TaskStatus>("todo");
    const [taskPriority, setTaskPriority] = useState<TaskPriority>("medium");
    // Use datetime-local format so users can pick date and time.
    const [taskDueDate, setTaskDueDate] = useState<string>(
        format(new Date(), "yyyy-MM-dd'T'HH:mm")
    );
    const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

    // Per-action loading state for button spinners.
    const [isAddingTask, setIsAddingTask] = useState(false);
    const [isUpdatingTask, setIsUpdatingTask] = useState(false);
    const [isDeletingTask, setIsDeletingTask] = useState(false);

    const member = members.find((m) => m.userId == memberId);
    const [memberTasks, setMemberTasks] = useState<Task[]>([]);

    const refreshTasks = async () => {
        if (!memberId) {
            setMemberTasks([]);
            return;
        }

        try {
            const result = await getMemberTasks(memberId);
            setMemberTasks(result || []);
        } catch (err) {
            console.error("Failed to load member tasks:", err);
            // getTasks already shows toast on error; ensure tasks cleared
            setMemberTasks([]);
        }
    };
    // useEffect(() => {
    //   let cancelled = false;
    //   if (!memberId) {
    //     setMemberTasks([]);
    //     return;
    //   }

    //   (async () => {
    //     try {
    //       const fetched = await getMemberTasks(memberId);
    //       if (!cancelled) setMemberTasks(fetched);
    //     } catch (err) {
    //       console.error("Failed to load member tasks:", err);
    //       if (!cancelled) setMemberTasks([]);
    //     }
    //   })();

    //   return () => {
    //     cancelled = true;
    //   };
    // }, [memberId]);
    useEffect(() => {
        refreshTasks();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [memberId]);

    const tasksByStatus = {
        todo: memberTasks.filter((task) => task.status === "todo"),
        in_progress: memberTasks.filter((task) => task.status === "in_progress"),
        review: memberTasks.filter((task) => task.status === "review"),
        completed: memberTasks.filter((task) => task.status === "completed"),
    };

    useEffect(() => {
        if (!isAddDialogOpen && !isEditDialogOpen) {
            resetForm();
        }
    }, [isAddDialogOpen, isEditDialogOpen]);

    const resetForm = () => {
        setTaskTitle("");
        setTaskDescription("");
        setTaskStatus("todo");
        setTaskPriority("medium");
        setTaskDueDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
        setCurrentTaskId(null);
    };

    const handleAddTask = async () => {
        if (!memberId) return;

        setIsAddingTask(true);
        try {
            const created = await addTask({
                title: taskTitle,
                description: taskDescription,
                status: taskStatus,
                priority: taskPriority,
                dueDate: new Date(taskDueDate),
                memberId,
            });

            // Optimistically reflect the new task locally instead of re-fetching
            // the whole list from the (slow) backend.
            if (created) {
                setMemberTasks((prev) => [...prev, created]);
                setIsAddDialogOpen(false);
            }
        } finally {
            setIsAddingTask(false);
        }
    };

    const handleEditTask = (task: Task) => {
        setTaskTitle(task.title);
        setTaskDescription(task.description);
        setTaskStatus(task.status);
        setTaskPriority(task.priority);
        setTaskDueDate(format(new Date(task.dueDate), "yyyy-MM-dd'T'HH:mm"));
        setCurrentTaskId(task.id);
        setIsEditDialogOpen(true);
    };

    const handleUpdateTask = async () => {
        if (!currentTaskId) return;

        setIsUpdatingTask(true);
        try {
            const updated = await updateTask(currentTaskId, {
                title: taskTitle,
                description: taskDescription,
                status: taskStatus,
                priority: taskPriority,
                dueDate: new Date(taskDueDate),
            });

            if (updated) {
                setMemberTasks((prev) =>
                    prev.map((t) => (t.id === currentTaskId ? updated : t))
                );
                setIsEditDialogOpen(false);
            }
        } finally {
            setIsUpdatingTask(false);
        }
    };

    // Inline status change straight from the card, so completing a task no longer
    // requires opening the edit dialog.
    const handleStatusChange = async (taskId: string, status: TaskStatus) => {
        const updated = await updateTask(taskId, { status });
        if (updated) {
            setMemberTasks((prev) =>
                prev.map((t) => (t.id === taskId ? updated : t))
            );
        }
    };

    const confirmDeleteTask = (taskId: string) => {
        setCurrentTaskId(taskId);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteTask = async () => {
        if (!currentTaskId) return;

        const idToDelete = currentTaskId;
        setIsDeletingTask(true);
        try {
            const ok = await deleteTask(idToDelete);
            if (ok) {
                setMemberTasks((prev) => prev.filter((t) => t.id !== idToDelete));
                setIsDeleteDialogOpen(false);
                setCurrentTaskId(null);
            }
        } finally {
            setIsDeletingTask(false);
        }
    };

    const getDueDateLabel = (dueDate: Date) => {
        if (isToday(dueDate)) return `Today · ${format(dueDate, "hh:mm a")}`;
        if (isTomorrow(dueDate)) return `Tomorrow · ${format(dueDate, "hh:mm a")}`;
        return format(dueDate, "MMM dd, yyyy · hh:mm a");
    };
    if (!members.length) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white">
                <p>Loading member details...</p>
            </div>
        );
    }

    if (!member) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">Member not found</h2>
                    <Button onClick={() => navigate("/dashboard")}>
                        Back to Dashboard
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-muted/40">
            <header className="bg-background border-b border-border sticky top-0 z-10">
                <div className="container mx-auto px-4 py-4">
                    <Button
                        variant="ghost"
                        className="mb-2 pl-1"
                        onClick={() => navigate("/dashboard")}
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Back to Dashboard
                    </Button>
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold">{member.name}</h1>
                            <p className="text-muted-foreground">
                                {member.role} • {member.email}
                            </p>

                        </div>
                        <div>
                            <Button onClick={() => navigate(`/dashboard/member/${memberId}/attendance`)}>
                                Check Attendance
                            </Button>
                        </div>
                        <div className="flex items-center gap-4">
                            <ThemeToggle />
                            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="gap-2">
                                        <PlusCircle className="h-4 w-4" />
                                        Add Task
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Add new task</DialogTitle>
                                        <DialogDescription>
                                            Assign a new task to {member.name}.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="title">Task Title</Label>
                                            <Input
                                                id="title"
                                                placeholder="Enter task title"
                                                value={taskTitle}
                                                onChange={(e) => setTaskTitle(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="description">Description</Label>
                                            <Textarea
                                                id="description"
                                                placeholder="Describe the task"
                                                className="min-h-[100px]"
                                                value={taskDescription}
                                                onChange={(e) => setTaskDescription(e.target.value)}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="status">Status</Label>
                                                <Select
                                                    value={taskStatus}
                                                    onValueChange={(value) =>
                                                        setTaskStatus(value as TaskStatus)
                                                    }
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectGroup>
                                                            <SelectItem value="todo">To Do</SelectItem>
                                                            <SelectItem value="in_progress">
                                                                In Progress
                                                            </SelectItem>
                                                            <SelectItem value="review">Review</SelectItem>
                                                            <SelectItem value="completed">
                                                                Completed
                                                            </SelectItem>
                                                        </SelectGroup>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="priority">Priority</Label>
                                                <Select
                                                    value={taskPriority}
                                                    onValueChange={(value) =>
                                                        setTaskPriority(value as TaskPriority)
                                                    }
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectGroup>
                                                            <SelectItem value="low">Low</SelectItem>
                                                            <SelectItem value="medium">Medium</SelectItem>
                                                            <SelectItem value="high">High</SelectItem>
                                                            <SelectItem value="urgent">Urgent</SelectItem>
                                                        </SelectGroup>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="dueDate">Due Date & time</Label>
                                            <Input
                                                id="dueDate"
                                                type="datetime-local"
                                                value={taskDueDate}
                                                onChange={(e) => setTaskDueDate(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            variant="outline"
                                            onClick={() => setIsAddDialogOpen(false)}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={handleAddTask}
                                            disabled={!taskTitle || isAddingTask}
                                        >
                                            {isAddingTask && (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            )}
                                            {isAddingTask ? "Adding..." : "Add Task"}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-4">
                        <div className="flex items-center">
                            <h2 className="text-lg font-medium">To Do</h2>
                            <Badge variant="outline" className="ml-2">
                                {tasksByStatus["todo"].length}
                            </Badge>
                        </div>
                        <div className="space-y-3">
                            {tasksByStatus["todo"].map((task) => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    onEdit={() => handleEditTask(task)}
                                    onDelete={() => confirmDeleteTask(task.id)}
                                    onStatusChange={(status) =>
                                        handleStatusChange(task.id, status)
                                    }
                                    getDueDateLabel={getDueDateLabel}
                                    canManage={canManageTask(task.id)}
                                />
                            ))}
                            {tasksByStatus["todo"].length === 0 && (
                                <EmptyState
                                    status="todo"
                                    onAddTask={() => setIsAddDialogOpen(true)}
                                />
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center">
                            <h2 className="text-lg font-medium">In Progress</h2>
                            <Badge variant="outline" className="ml-2">
                                {tasksByStatus["in_progress"].length}
                            </Badge>
                        </div>
                        <div className="space-y-3">
                            {tasksByStatus["in_progress"].map((task) => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    onEdit={() => handleEditTask(task)}
                                    onDelete={() => confirmDeleteTask(task.id)}
                                    onStatusChange={(status) =>
                                        handleStatusChange(task.id, status)
                                    }
                                    getDueDateLabel={getDueDateLabel}
                                    canManage={canManageTask(task.id)}
                                />
                            ))}
                            {tasksByStatus["in_progress"].length === 0 && (
                                <EmptyState
                                    status="in_progress"
                                    onAddTask={() => setIsAddDialogOpen(true)}
                                />
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center">
                            <h2 className="text-lg font-medium">Review</h2>
                            <Badge variant="outline" className="ml-2">
                                {tasksByStatus["review"].length}
                            </Badge>
                        </div>
                        <div className="space-y-3">
                            {tasksByStatus["review"].map((task) => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    onEdit={() => handleEditTask(task)}
                                    onDelete={() => confirmDeleteTask(task.id)}
                                    onStatusChange={(status) =>
                                        handleStatusChange(task.id, status)
                                    }
                                    getDueDateLabel={getDueDateLabel}
                                    canManage={canManageTask(task.id)}
                                />
                            ))}
                            {tasksByStatus["review"].length === 0 && (
                                <EmptyState
                                    status="review"
                                    onAddTask={() => setIsAddDialogOpen(true)}
                                />
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center">
                            <h2 className="text-lg font-medium">Completed</h2>
                            <Badge variant="outline" className="ml-2">
                                {tasksByStatus["completed"].length}
                            </Badge>
                        </div>
                        <div className="space-y-3">
                            {tasksByStatus["completed"].map((task) => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    onEdit={() => handleEditTask(task)}
                                    onDelete={() => confirmDeleteTask(task.id)}
                                    onStatusChange={(status) =>
                                        handleStatusChange(task.id, status)
                                    }
                                    getDueDateLabel={getDueDateLabel}
                                    canManage={canManageTask(task.id)}
                                />
                            ))}
                            {tasksByStatus["completed"].length === 0 && (
                                <EmptyState
                                    status="completed"
                                    onAddTask={() => setIsAddDialogOpen(true)}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </main>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit task</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-title">Task Title</Label>
                            <Input
                                id="edit-title"
                                placeholder="Enter task title"
                                value={taskTitle}
                                onChange={(e) => setTaskTitle(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-description">Description</Label>
                            <Textarea
                                id="edit-description"
                                placeholder="Describe the task"
                                className="min-h-[100px]"
                                value={taskDescription}
                                onChange={(e) => setTaskDescription(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-status">Status</Label>
                                <Select
                                    value={taskStatus}
                                    onValueChange={(value) => setTaskStatus(value as TaskStatus)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectItem value="todo">To Do</SelectItem>
                                            <SelectItem value="in_progress">In Progress</SelectItem>
                                            <SelectItem value="review">Review</SelectItem>
                                            <SelectItem value="completed">Completed</SelectItem>
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-priority">Priority</Label>
                                <Select
                                    value={taskPriority}
                                    onValueChange={(value) =>
                                        setTaskPriority(value as TaskPriority)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectItem value="low">Low</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                            <SelectItem value="urgent">Urgent</SelectItem>
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-dueDate">Due Date & time</Label>
                            <Input
                                id="edit-dueDate"
                                type="datetime-local"
                                value={taskDueDate}
                                onChange={(e) => setTaskDueDate(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsEditDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUpdateTask}
                            disabled={!taskTitle || isUpdatingTask}
                        >
                            {isUpdatingTask && (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            )}
                            {isUpdatingTask ? "Updating..." : "Update Task"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the
                            task.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeletingTask}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={isDeletingTask}
                            onClick={(e) => {
                                // Keep the dialog open until the request resolves so
                                // the spinner is visible.
                                e.preventDefault();
                                handleDeleteTask();
                            }}
                            className="bg-destructive"
                        >
                            {isDeletingTask && (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            )}
                            {isDeletingTask ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

const statusOrder: TaskStatus[] = [
    "todo",
    "in_progress",
    "review",
    "completed",
];

const TaskCard = ({
    task,
    onEdit,
    onDelete,
    onStatusChange,
    getDueDateLabel,
    canManage,
}: {
    task: Task;
    onEdit: () => void;
    onDelete: () => void;
    onStatusChange: (status: TaskStatus) => void;
    getDueDateLabel: (date: Date) => string;
    canManage: boolean;
}) => {
    const isOverdue =
        isPast(new Date(task.dueDate)) && task.status !== "completed";

    return (
        <Card className="shadow-sm">
            <CardHeader className="py-3 px-4 flex flex-row items-start justify-between space-y-0">
                <CardTitle className="text-base font-medium pr-2">
                    {task.title}
                </CardTitle>
                {canManage && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 flex shrink-0"
                            >
                                <span className="sr-only">Open menu</span>
                                <svg
                                    width="15"
                                    height="15"
                                    viewBox="0 0 15 15"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4"
                                >
                                    <path
                                        d="M3.625 7.5C3.625 8.12132 3.12132 8.625 2.5 8.625C1.87868 8.625 1.375 8.12132 1.375 7.5C1.375 6.87868 1.87868 6.375 2.5 6.375C3.12132 6.375 3.625 6.87868 3.625 7.5ZM8.625 7.5C8.625 8.12132 8.12132 8.625 7.5 8.625C6.87868 8.625 6.375 8.12132 6.375 7.5C6.375 6.87868 6.87868 6.375 7.5 6.375C8.12132 6.375 8.625 6.87868 8.625 7.5ZM13.625 7.5C13.625 8.12132 13.1213 8.625 12.5 8.625C11.8787 8.625 11.375 8.12132 11.375 7.5C11.375 6.87868 11.8787 6.375 12.5 6.375C13.1213 6.375 13.625 6.87868 13.625 7.5Z"
                                        fill="currentColor"
                                        fillRule="evenodd"
                                        clipRule="evenodd"
                                    ></path>
                                </svg>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={onEdit}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </CardHeader>
            <CardContent className="py-3 px-4">
                <p className="text-sm text-muted-foreground mb-3">
                    {task.description}
                </p>
                <div className="space-y-2">
                    <div className="flex gap-2">
                        {canManage ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        className="focus:outline-none"
                                        aria-label="Change status"
                                    >
                                        <Badge
                                            className={`${statusColors[task.status]} cursor-pointer gap-1`}
                                        >
                                            {statusLabels[task.status]}
                                            <ChevronDown className="h-3 w-3" />
                                        </Badge>
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                    {statusOrder.map((status) => (
                                        <DropdownMenuItem
                                            key={status}
                                            disabled={status === task.status}
                                            onClick={() => onStatusChange(status)}
                                        >
                                            <span
                                                className={`mr-2 inline-block h-2 w-2 ${statusColors[status]}`}
                                            />
                                            {statusLabels[status]}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <Badge className={statusColors[task.status]}>
                                {statusLabels[task.status]}
                            </Badge>
                        )}
                        <Badge className={priorityColors[task.priority]}>
                            {priorityLabels[task.priority]}
                        </Badge>
                    </div>
                    <div
                        className={`flex items-center gap-1 text-xs ${isOverdue
                                ? "text-destructive font-medium"
                                : "text-muted-foreground"
                            }`}
                    >
                        {isOverdue ? (
                            <AlertCircle className="h-3 w-3" />
                        ) : (
                            <Calendar className="h-3 w-3" />
                        )}
                        {getDueDateLabel(new Date(task.dueDate))}
                        {isOverdue && " (Overdue)"}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

const EmptyState = ({
    status,
    onAddTask,
}: {
    status: TaskStatus;
    onAddTask: () => void;
}) => {
    return (
        <div className="border border-dashed border-muted-foreground/20 rounded-lg p-4 text-center">
            <p className="text-muted-foreground text-sm mb-2">
                No tasks in {statusLabels[status]}
            </p>
            <Button variant="outline" size="sm" onClick={onAddTask}>
                Add Task
            </Button>
        </div>
    );
};

export default MemberDetail;
