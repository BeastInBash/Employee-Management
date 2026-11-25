import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "@/components/ui/sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL;

import { useAuth } from "./AuthContext";
import { parseTask } from "@/lib/tasks";
import { enqueueCreate, enqueueUpdate, isQueued, newTaskId, startOutbox, subscribeOutbox } from "@/lib/outbox";

const getAuthToken = () => localStorage.getItem("authToken");

export type TaskStatus = "todo" | "in_progress" | "review" | "completed";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type Task = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date;
  memberId: string;
  createdAt: Date;
  completedAt: Date | null;
  /** Set when the task belongs to a project. */
  project?: { id: string; name: string; color: string | null } | null;
  /** Free-form labels (normalised like the API: lib/tags). */
  tags?: string[];
  /** Still in the outbox: shown already, not on the server yet (see lib/outbox). */
  pending?: boolean;
};

// The submission window that applies to the signed-in member, as reported by
// GET /tasks/task-window. `enabled: false` means "submit anytime".
export type TaskWindowInfo = {
  enabled: boolean;
  startTime: string;
  endTime: string;
  label: string;
  open: boolean;
  currentTimeIST: string;
};

type TaskContextType = {
  tasks: Task[];
  taskWindow: TaskWindowInfo | null;
  refreshTaskWindow: () => Promise<TaskWindowInfo | null>;
  getTasks: (memberId: string) => Promise<Task[]>;
  addTask: (task: Omit<Task, "id" | "createdAt" | "completedAt">) => Promise<Task | void>;
  updateTask: (id: string, updatedTask: Partial<Task>) => Promise<Task | void>;
  deleteTask: (id: string) => Promise<boolean>;
};

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskWindow, setTaskWindow] = useState<TaskWindowInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  console.log(isLoading);

  const refreshTaskWindow = async (): Promise<TaskWindowInfo | null> => {
    const token = getAuthToken();
    if (!token) return null;
    try {
      const response = await fetch(`${API_BASE_URL}/tasks/task-window`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return null;
      const data = await response.json();
      const window: TaskWindowInfo | null = data?.taskWindow ?? null;
      setTaskWindow(window);
      return window;
    } catch (error) {
      console.error("Get task window error:", error);
      return null;
    }
  };

  // Load the window once a user is present so pages can gate their "Add task"
  // affordance without each of them fetching it.
  useEffect(() => {
    if (user) refreshTaskWindow();
    else setTaskWindow(null);
  }, [user]);

  // Send whatever this user's outbox holds (also what was left from an earlier
  // visit), and say so when the server turns something down. Lists update
  // themselves through useLiveTasks.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    const stop = startOutbox(userId);
    const unsubscribe = subscribeOutbox((e) => {
      if (e.type !== "failed") return;
      toast.error(
        e.kind === "create" ? `Couldn't save "${e.title}": ${e.message}` : `Couldn't update "${e.title}": ${e.message}`,
      );
      // The usual refusal is a submission window that closed; show the current one.
      void refreshTaskWindow();
    });
    return () => {
      stop();
      unsubscribe();
    };
  }, [userId]);

  const addTask = async (task: Omit<Task, "id" | "createdAt" | "completedAt">) => {
    const token = getAuthToken();
    if (!token) {
      toast.error("You must be logged in");
      return;
    }
    if (!user) {
      toast.error("You must be logged in");
      return;
    }
    // Cheap client-side guard; the backend is still the authority (and returns
    // the current window on a 403 so we can correct a stale local copy).
    if (taskWindow && taskWindow.enabled && !taskWindow.open) {
      toast.error(`Tasks can only be submitted between ${taskWindow.startTime} and ${taskWindow.endTime} IST`);
      return;
    }
    // Shown at once and sent in the background (lib/outbox): the id is made
    // here, so retries can't duplicate it and later edits can refer to it.
    const now = new Date();
    const status = task.status ?? "todo";
    const created = enqueueCreate(user.id, {
      id: newTaskId(),
      title: task.title,
      description: task.description,
      status,
      priority: task.priority,
      dueDate: new Date(task.dueDate),
      memberId: task.memberId,
      createdAt: now,
      completedAt: status === "completed" ? now : null,
      project: null,
      tags: task.tags ?? [],
    });
    setTasks((prev) => [...prev, created]);
    toast.success("Task added");
    return created;
  };

  const updateTask = async (id: string, updatedTask: Partial<Task>) => {
    const token = getAuthToken();
    if (!token) {
      toast.error("You must be logged in");
      return;
    }

    // A task that hasn't reached the server yet: queue the edit behind it.
    if (user && isQueued(user.id, id)) {
      const { title, description, status, priority, dueDate, tags } = updatedTask;
      const queued = enqueueUpdate(user.id, id, {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
        ...(dueDate !== undefined && { dueDate }),
        ...(tags !== undefined && { tags }),
      });
      if (queued) {
        setTasks((prev) => prev.map((t) => (t.id === id ? queued : t)));
        toast.success("Task updated");
        return queued;
      }
    }

    try {
      const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatedTask),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || "Failed to update task");
        return;
      }

      const data = await response.json();
      const updated = {
        ...data,
        dueDate: new Date(data.dueDate),
        createdAt: new Date(data.createdAt),
        completedAt: data.completedAt ? new Date(data.completedAt) : null,
      };

      setTasks(tasks.map((t) => (t.id === id ? updated : t)));
      toast.success("Task updated");
      return updated as Task;
    } catch (error) {
      console.error("Update task error:", error);
      toast.error("An error occurred while updating task");
    }

    // MOCK IMPLEMENTATION (Remove when backend is ready)
    // setTasks(
    //   tasks.map((task) => {
    //     if (task.id === id) {
    //       const completedAt =
    //         updatedTask.status === "completed" && task.status !== "completed"
    //           ? new Date()
    //           : task.completedAt;

    //       return { ...task, ...updatedTask, completedAt };
    //     }
    //     return task;
    //   })
    // );
    // toast.success("Task updated");
  };

  const deleteTask = async (id: string) => {
    const token = getAuthToken();
    if (!token) {
      toast.error("You must be logged in");
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || "Failed to delete task");
        return false;
      }

      setTasks(tasks.filter((task) => task.id !== id));
      toast.success("Task deleted");
      return true;
    } catch (error) {
      console.error("Delete task error:", error);
      toast.error("An error occurred while deleting task");
      return false;
    }

    // MOCK IMPLEMENTATION (Remove when backend is ready)
    // setTasks(tasks.filter((task) => task.id !== id));
    // toast.success("Task deleted successfully");
  };

  const getTasks = async (userId: string) => {
    const token = getAuthToken();
    if (!token) {
      toast.error("You must be logged in");
      return [] as Task[];
    }

    setIsLoading(true);
    try {
      // Primary endpoint - matches update/delete routes
      const res = await fetch(`${API_BASE_URL}/tasks/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Fallback to older route if server uses /tasks/:memberId

      const data = await res.json();

      const parsed: Task[] = (data.tasks || []).map(parseTask);

      setTasks(parsed);
      return parsed;
    } catch (error) {
      console.error("Get tasks error:", error);
      toast.error("An error occurred while fetching tasks");
      return [] as Task[];
    } finally {
      setIsLoading(false);
    }
  };

  // Helper functions

  return (
    <TaskContext.Provider
      value={{
        tasks,
        taskWindow,
        refreshTaskWindow,
        getTasks,
        addTask,
        updateTask,
        deleteTask,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
};

export const useTasks = () => {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error("useTasks must be used within a TaskProvider");
  }
  return context;
};
