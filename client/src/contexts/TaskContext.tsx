import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "@/components/ui/sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL; 

import { useAuth } from "./AuthContext";


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
};

type TaskContextType = {
  tasks: Task[];
  getTasks: (memberId: string) => Promise<Task[]>;
  addTask: (task: Omit<Task, "id" | "createdAt" | "completedAt">) => void;
  updateTask: (id: string, updatedTask: Partial<Task>) => void;
  deleteTask: (id: string) => void;
};

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  console.log(isLoading)

  const addTask = async (
    task: Omit<Task, "id" | "createdAt" | "completedAt">
  ) => {
    const token = getAuthToken();
    if (!token) {
      toast.error("You must be logged in");
      return;
    }
    if (!user) {
      toast.error("You must be logged in");
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || "Failed to create task");
        return;
      }

      const data = await response.json();
      const newTask = {
        ...data,
        dueDate: new Date(data.dueDate),
        createdAt: new Date(data.createdAt),
        completedAt: data.completedAt ? new Date(data.completedAt) : null,
      };

      setTasks([...tasks, newTask]);
      toast.success("Task created successfully");
    } catch (error) {
      console.error("Add task error:", error);
      toast.error("An error occurred while creating task");
    }

    // MOCK IMPLEMENTATION (Remove when backend is ready)
    // const newTask = {
    //   ...task,
    //   id: `${tasks.length + 1}`,
    //   createdAt: new Date(),
    //   completedAt: null,
    // };

    // setTasks([...tasks, newTask]);
    // toast.success("Task created successfully");
  };

  const updateTask = async (id: string, updatedTask: Partial<Task>) => {
    const token = getAuthToken();
    if (!token) {
      toast.error("You must be logged in");
      return;
    }

    const task = tasks.find((t) => t.id === id);
    if (!task) return;

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
      toast.success("Task updated successfully");
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
    // toast.success("Task updated successfully");
  };

  const deleteTask = async (id: string) => {
    const token = getAuthToken();
    if (!token) {
      toast.error("You must be logged in");
      return;
    }

    const task = tasks.find((t) => t.id === id);
    if (!task) return;

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
        return;
      }

      setTasks(tasks.filter((task) => task.id !== id));
      toast.success("Task deleted successfully");
    } catch (error) {
      console.error("Delete task error:", error);
      toast.error("An error occurred while deleting task");
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
      
      const  data = await res.json();

      const parsed: Task[] = (data.tasks || []).map((d: any) => ({
        id: String(d.id),
        title: d.title,
        description: d.description,
        status: d.status,
        priority: d.priority,
        dueDate: d.dueDate ? new Date(d.dueDate) : new Date(),
        memberId: d.memberId || d.member_id || "",
        createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
        completedAt: d.completedAt ? new Date(d.completedAt) : null,
      }));

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
