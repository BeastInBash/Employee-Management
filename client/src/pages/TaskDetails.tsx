import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import { useTasks } from "@/contexts/TaskContext";
// import { Skeleton } from "@/components/ui/skeleton";
import type { Task, TaskStatus, TaskPriority } from "@/contexts/TaskContext";
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
    PlusCircle,
    Edit,
    Trash2,
    Calendar,
    AlertCircle,
    Users,
    KeyRound,
    LogOut,
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
    review: "bg-blue-500 text-white dark:bg-orange-500",
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
    medium: "bg-blue-500 text-white dark:bg-amber-500",
    high: "bg-orange-500 text-white dark:bg-orange-600",
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
    const { user, changePassword, logout } = useAuth();
    const { getTasks, addTask, updateTask, deleteTask } = useTasks();

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [taskTitle, setTaskTitle] = useState("");
    const [taskDescription, setTaskDescription] = useState("");
    const [taskStatus, setTaskStatus] = useState<TaskStatus>("todo");
    const [taskPriority, setTaskPriority] = useState<TaskPriority>("medium");
    // Use a datetime-local friendly format (no timezone) so input[type=datetime-local]
    // can be prefilled. Format: yyyy-MM-dd'T'HH:mm
    const [taskDueDate, setTaskDueDate] = useState<string>(
        format(new Date(), "yyyy-MM-dd'T'HH:mm")
    );
    const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);

    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    // Fetch tasks for the current member and keep local copy so we don't call
    // getTasks() synchronously in render (it returns a Promise).
    const refreshTasks = async () => {
        if (!memberId) {
            setTasks([]);
            return;
        }

        try {
            const result = await getTasks(memberId);
            setTasks(result || []);
        } catch (err) {
            // getTasks already shows toast on error; ensure tasks cleared
            setTasks([]);
        }
    };
    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        if (newPassword.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }

        const success = await changePassword(oldPassword, newPassword);

        if (success) {
            setOldPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setIsPasswordDialogOpen(false);
        }
    };
    useEffect(() => {
        refreshTasks();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [memberId]);

    const tasksByStatus = {
        todo: tasks.filter((task) => task.status === "todo"),
        in_progress: tasks.filter((task) => task.status === "in_progress"),
        review: tasks.filter((task) => task.status === "review"),
        completed: tasks.filter((task) => task.status === "completed"),
    };

    useEffect(() => {
        if (!isAddDialogOpen && !isEditDialogOpen) {
            resetForm();
        }
    }, [isAddDialogOpen, isEditDialogOpen]);

    useEffect(() => {
        // Only allow users with role 'member' to access a member's Task details page.
        // Redirect admins or any other roles to the dashboard.
        if (!user) return;

        if (user.role !== "member") {
            navigate("/dashboard");
            return;
        }

        // Ensure the member belongs to the currently logged-in member user.
    }, [user, navigate]);
    const handleLogout = () => {
        logout();
        navigate("/");
    };

    if (!user) {
        navigate("/");
        return null;
    }
    const resetForm = () => {
        setTaskTitle("");
        setTaskDescription("");
        setTaskStatus("todo");
        setTaskPriority("medium");
        setTaskDueDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
        setCurrentTaskId(null);
    };

    const handleAddTask = () => {
        if (!memberId) return;

        // addTask({
        //   title: taskTitle,
        //   description: taskDescription,
        //   status: taskStatus,
        //   priority: taskPriority,
        //   dueDate: new Date(taskDueDate),
        //   memberId,
        // });
        // ensure UI refresh after async operation (addTask is async)
        Promise.resolve(
            addTask({
                title: taskTitle,
                description: taskDescription,
                status: taskStatus,
                priority: taskPriority,
                dueDate: new Date(taskDueDate),
                memberId,
            })
        ).then(() => refreshTasks());

        setIsAddDialogOpen(false);
    };

    const handleEditTask = (task: Task) => {
        setTaskTitle(task.title);
        setTaskDescription(task.description);
        setTaskStatus(task.status);
        setTaskPriority(task.priority);
        // Format existing task dueDate into a datetime-local compatible string
        setTaskDueDate(format(new Date(task.dueDate), "yyyy-MM-dd'T'HH:mm"));
        setCurrentTaskId(task.id);
        setIsEditDialogOpen(true);
    };

    const handleUpdateTask = () => {
        if (!currentTaskId) return;

        // refresh after update
        Promise.resolve(
            updateTask(currentTaskId, {
                title: taskTitle,
                description: taskDescription,
                status: taskStatus,
                priority: taskPriority,
                dueDate: new Date(taskDueDate),
            })
        ).then(() => refreshTasks());

        setIsEditDialogOpen(false);
    };

    // Inline status change straight from the card, so marking a task complete no
    // longer requires opening the three-dots menu and the edit dialog.
    const handleStatusChange = async (taskId: string, status: TaskStatus) => {
        const updated = await updateTask(taskId, { status });
        if (updated) {
            setTasks((prev) =>
                prev.map((t) => (t.id === taskId ? updated : t))
            );
        }
    };

    const confirmDeleteTask = (taskId: string) => {
        setCurrentTaskId(taskId);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteTask = () => {
        if (!currentTaskId) return;

        Promise.resolve(deleteTask(currentTaskId)).then(() => refreshTasks());
        setIsDeleteDialogOpen(false);
        setCurrentTaskId(null);
    };

    // Determine whether the current user can manage (edit/delete) the task.
    // A member can manage their own tasks. Adjust logic if admins should also manage.
    const canManageTask = (taskMemberId: string) => {
        console.log(taskMemberId)
        return String(user?.id) === String(memberId);
    };

    const getDueDateLabel = (dueDate: Date) => {
        if (isToday(dueDate)) return `Today · ${format(dueDate, "hh:mm a")}`;
        if (isTomorrow(dueDate)) return `Tomorrow · ${format(dueDate, "hh:mm a")}`;
        return format(dueDate, "MMM dd, yyyy · hh:mm a");
    };

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">User not found</h2>
                    <Button onClick={() => navigate("/")}>Back to Login</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-muted/40">
            <header className="bg-background border-b border-border sticky top-0 z-10">
                <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Users className="h-6 w-6 text-primary" />
                        <h1 className="text-2xl font-bold text-primary">Crewly</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <ThemeToggle />
                        <span className="text-sm text-muted-foreground">
                            Hello, {user.name} ({user.role === "admin" ? "Admin" : "Member"})
                        </span>
                        {user.role === "member" && (
                            <Dialog
                                open={isPasswordDialogOpen}
                                onOpenChange={setIsPasswordDialogOpen}
                            >
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="gap-2">
                                        <KeyRound className="h-4 w-4" />
                                        Change Password
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Change Your Password</DialogTitle>
                                        <DialogDescription>
                                            Update your password to keep your account secure.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="oldPassword">Current Password</Label>
                                            <Input
                                                id="oldPassword"
                                                type="password"
                                                value={oldPassword}
                                                onChange={(e) => setOldPassword(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="newPassword">New Password</Label>
                                            <Input
                                                id="newPassword"
                                                type="password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="confirmPassword">
                                                Confirm New Password
                                            </Label>
                                            <Input
                                                id="confirmPassword"
                                                type="password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            variant="outline"
                                            onClick={() => setIsPasswordDialogOpen(false)}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={handleChangePassword}
                                            disabled={
                                                !oldPassword || !newPassword || !confirmPassword
                                            }
                                        >
                                            Change Password
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}
                        <Button onClick={() => navigate('/attendance')}>Check Attendance</Button>
                        <Button variant="ghost" size="icon" onClick={handleLogout}>
                            <LogOut className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
                <div className="container mx-auto px-4 py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold">{user.name}</h1>
                            <p className="text-muted-foreground">
                                {user.role} • {user.email}
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
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
                                            Assign a new task to {user.name}.
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
                                        <Button onClick={handleAddTask} disabled={!taskTitle}>
                                            Add Task
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
                        <Button onClick={handleUpdateTask} disabled={!taskTitle}>
                            Update Task
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
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteTask}
                            className="bg-destructive"
                        >
                            Delete
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
            {status === "todo" && (

                <Button variant="outline" size="sm" onClick={onAddTask}>
                    Add Task
                </Button>
            )}
        </div>
    );
};

export default MemberDetail;
