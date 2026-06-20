import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "@/components/ui/sonner";

// const API_BASE_URL = "http://localhost:3000/api"; // Update with your backend URL
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

export type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  userId?: string;
  createdAt: Date;
  createdById: string;
  user?: {
    name: string;
  };
};

type MemberContextType = {
  members: Member[];
  tasks: Task[];
  addMember: (
    member: Omit<Member, "id" | "createdAt">
  ) => Promise<Member | void>;
  addTask: (
    task: Omit<Task, "id" | "createdAt" | "completedAt">
  ) => Promise<Task | void>;
  updateTask: (id: string, updatedTask: Partial<Task>) => Promise<Task | void>;
  deleteTask: (id: string) => Promise<boolean>;
  deleteMember: (id: string) => Promise<boolean>;
  // getMemberTasks: (memberId: string) => Task[];
  getMemberTasks: (memberId: string) => Promise<Task[]>;
  getUserMembers: (userId: string) => Member[];
  canManageTask: (taskId: string) => boolean;
  refreshMembers: () =>Promise< void>;
  refreshMemberTask: (memberId:string)=>Promise< void>;
};

const MemberContext = createContext<MemberContextType | undefined>(undefined);

export const MemberProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  console.log(isLoading);
  // Fetch members on mount (when backend is ready)
  const fetchMembers = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/members`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMembers(
          data && data?.members?.map((m: any) => ({
            ...m,
            createdAt: new Date(m.createdAt),
          }))
        );
      }
    } catch (error) {
      console.error("Failed to fetch members:", error);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    if (user) fetchMembers();
  }, [user]);

  const addMember = async (member: Omit<Member, "id" | "createdAt">) => {
    if (user?.role !== "admin") {
      toast.error("Only admins can add members");
      return;
    }
    const token = getAuthToken();
    if (!token) {
      toast.error("You must be logged in");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(member),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || "Failed to add member");
        return;
      }

      const data = await response.json();

      // The backend returns the created row under `memberData` (older shapes used
      // `member`). Normalize so we pick up the real id/createdAt from the server.
      const payload = data.memberData ?? data.member ?? data;

      // Some backends may still omit createdAt; fall back to now only if missing.
      const createdAtValue = payload.createdAt ?? new Date().toISOString();
      const newMember: Member = {
        ...payload,
        createdAt: new Date(createdAtValue),
        // The list/card reads `member.user?.name`, but the create response only
        // carries a flat `name`. Mirror it so the optimistic card renders the
        // name immediately without waiting on a refetch.
        user: { name: payload.name ?? member.name },
      };

      setMembers((prev) => [...prev, newMember]);
      toast.success("Member added successfully");

      // Return the created member so callers can await and react to result
      return newMember;
    } catch (error) {
      console.error("Add member error:", error);
      toast.error("An error occurred while adding member");
    }
  };

  // Task functions
  const addTask = async (
    task: Omit<Task, "id" | "createdAt" | "completedAt">
  ) => {
    const token = getAuthToken();
    if (!token) {
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
          userId: task.memberId,
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
      return newTask as Task;
    } catch (error) {
      console.error("Add task error:", error);
      toast.error("An error occurred while creating task");
    }
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
      return updated as Task;
    } catch (error) {
      console.error("Update task error:", error);
      toast.error("An error occurred while updating task");
    }
  };

  const deleteTask = async (id: string) => {
    const token = getAuthToken();
    if (!token) {
      toast.error("You must be logged in");
      return false;
    }

    const task = tasks.find((t) => t.id === id);
    if (!task) return false;

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
      toast.success("Task deleted successfully");
      return true;
    } catch (error) {
      console.error("Delete task error:", error);
      toast.error("An error occurred while deleting task");
      return false;
    }
  };

  const deleteMember = async (id: string) => {
    if (user?.role !== "admin") {
      toast.error("Only admins can delete members");
      return false;
    }

    const token = getAuthToken();
    if (!token) {
      toast.error("You must be logged in");
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/members/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || "Failed to delete member");
        return false;
      }

      // Remove locally
      setMembers((prev) => prev.filter((m) => m.id !== id));
      toast.success("Member deleted successfully");
      return true;
    } catch (error) {
      console.error("Delete member error:", error);
      toast.error("An error occurred while deleting member");
      return false;
    }
  };

  
  const getMemberTasks = async (memberId: string) => {
    const token = getAuthToken();
    if (!token) {
      toast.error("You must be logged in");
      return [];
    }

    try {
      const response = await fetch(`${API_BASE_URL}/tasks/member/${memberId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || "Failed to fetch tasks");
        return [];
      }

      const data = await response.json();

      // Convert date strings to Date objects for frontend use
      const fetchedTasks: Task[] = data.tasks.map((t: Task) => ({
        ...t,
        dueDate: new Date(t.dueDate),
        createdAt: new Date(t.createdAt),
        completedAt: t.completedAt ? new Date(t.completedAt) : null,
      }));

      // Optionally, store them in local state
      setTasks((prev) => {
        // Avoid duplicates or old tasks
        const otherTasks = prev.filter((task) => task.memberId !== memberId);
        return [...otherTasks, ...fetchedTasks];
      });

      console.log("Fetched tasks for member:", memberId, fetchedTasks);
      return fetchedTasks;
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
      toast.error("An error occurred while fetching tasks");
      return [];
    }
  };

  const refreshMemberTask = async (memberId:string)=>{
    await getMemberTasks(memberId);

  }

  const getUserMembers = (userId: string) => {
    // Admin can see all members
    if (user?.role === "admin") {
      return members;
    }
    // Regular members only see their own added members
    return members.filter((member) => member.userId === userId);
  };

  const canManageTask = (taskId: string): boolean => {
    if (!user) return false;

    // Admin can manage all tasks
    if (user.role === "admin") return true;

    // Member can only manage their own tasks
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return false;

    const member = members.find((m) => m.id === task.memberId);
    return member?.email === user.email;
  };

  return (
    <MemberContext.Provider
      value={{
        members,
        tasks,
        addMember,
          deleteMember,
        addTask,
        updateTask,
        deleteTask,
        getMemberTasks,
        getUserMembers,
        canManageTask,
        refreshMembers: fetchMembers,
        refreshMemberTask,
      }}
    >
      {children}
    </MemberContext.Provider>
  );
};

export const useMembers = () => {
  const context = useContext(MemberContext);
  if (context === undefined) {
    throw new Error("useMembers must be used within a MemberProvider");
  }
  return context;
};
