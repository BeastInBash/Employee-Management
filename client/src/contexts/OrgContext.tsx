import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "./AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_URL;

const getAuthToken = () => localStorage.getItem("authToken");

const ACTIVE_ORG_KEY = "activeOrgId";
const ACTIVE_WORKSPACE_KEY = "activeWorkspaceId";

// The per-workspace task submission window. Disabled means members can submit
// tasks at any time; times are "HH:mm" in IST (what <input type="time"> uses).
export type TaskWindow = {
  enabled: boolean;
  startTime: string;
  endTime: string;
};

export type Workspace = {
  id: string;
  name: string;
  orgId: string;
  createdAt: Date;
  taskWindow: TaskWindow;
};

export type Organization = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  workspaces: Workspace[];
};

type OrgContextType = {
  organizations: Organization[];
  activeOrg: Organization | null;
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isLoading: boolean;
  setActiveOrgId: (orgId: string) => void;
  setActiveWorkspaceId: (workspaceId: string) => void;
  refreshOrgs: () => Promise<void>;
  createOrganization: (name: string) => Promise<Organization | void>;
  createWorkspace: (name: string, orgId?: string) => Promise<Workspace | void>;
  updateTaskWindow: (workspaceId: string, window: TaskWindow) => Promise<TaskWindow | void>;
};

const OrgContext = createContext<OrgContextType | undefined>(undefined);

const DEFAULT_TASK_WINDOW: TaskWindow = {
  enabled: false,
  startTime: "09:00",
  endTime: "11:00",
};

// "09:00" from minutes-since-IST-midnight, which is how the workspace rows
// carry the window on the org listing endpoint.
const minutesToTime = (minutes: number): string => {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hh = String(Math.floor(normalized / 60)).padStart(2, "0");
  const mm = String(normalized % 60).padStart(2, "0");
  return `${hh}:${mm}`;
};

type TaskWindowSource =
  | {
      taskWindow?: Partial<TaskWindow> | null;
      taskWindowEnabled?: boolean;
      taskWindowStart?: number;
      taskWindowEnd?: number;
    }
  | null
  | undefined;

// Accepts either the raw workspace columns (GET /org/getMyOrgs) or the
// serialized `taskWindow` object (PATCH /workspace/:id/task-window).
const normalizeTaskWindow = (source: TaskWindowSource): TaskWindow => {
  if (source?.taskWindow) {
    return {
      enabled: !!source.taskWindow.enabled,
      startTime: source.taskWindow.startTime ?? DEFAULT_TASK_WINDOW.startTime,
      endTime: source.taskWindow.endTime ?? DEFAULT_TASK_WINDOW.endTime,
    };
  }
  if (typeof source?.taskWindowStart !== "number") return DEFAULT_TASK_WINDOW;
  return {
    enabled: !!source.taskWindowEnabled,
    startTime: minutesToTime(source.taskWindowStart),
    endTime: minutesToTime(source.taskWindowEnd ?? 660),
  };
};

// An org as GET /org/getMyOrgs sends it: dates as strings, the task window as raw columns.
type RawWorkspace = { id: string; name: string; orgId: string; createdAt: string } & NonNullable<TaskWindowSource>;
type RawOrg = { id: string; name: string; ownerId: string; createdAt: string; workspaces?: RawWorkspace[] };

// Normalizes the API org shape into our typed model (Date coercion + safe defaults).
const normalizeOrg = (o: RawOrg): Organization => ({
  id: o.id,
  name: o.name,
  ownerId: o.ownerId,
  createdAt: new Date(o.createdAt),
  workspaces: Array.isArray(o.workspaces)
    ? o.workspaces.map((w: RawWorkspace): Workspace => ({
        id: w.id,
        name: w.name,
        orgId: w.orgId,
        createdAt: new Date(w.createdAt),
        taskWindow: normalizeTaskWindow(w),
      }))
    : [],
});

export const OrgProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  // Start in the loading state when a token is present so the dashboard's
  // onboarding gates don't flash before the first fetch resolves.
  const [isLoading, setIsLoading] = useState(() => !!getAuthToken());
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(() => localStorage.getItem(ACTIVE_ORG_KEY));
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(() =>
    localStorage.getItem(ACTIVE_WORKSPACE_KEY),
  );

  const setActiveOrgId = (orgId: string) => {
    setActiveOrgIdState(orgId);
    localStorage.setItem(ACTIVE_ORG_KEY, orgId);
    // Reset the workspace selection; it'll be re-derived for the new org below.
    setActiveWorkspaceIdState(null);
    localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
  };

  const setActiveWorkspaceId = (workspaceId: string) => {
    setActiveWorkspaceIdState(workspaceId);
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
  };

  const fetchOrgs = async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/org/getMyOrgs?workspace=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const data = await response.json();
      const orgs: Organization[] = (data?.allOrgs ?? []).map(normalizeOrg);
      setOrganizations(orgs);
    } catch (error) {
      console.error("Failed to fetch organizations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchOrgs();
    else setOrganizations([]);
  }, [user]);

  // Keep the active org valid: fall back to the first org when the stored id is
  // gone (or nothing is selected yet).
  useEffect(() => {
    if (organizations.length === 0) return;
    const exists = organizations.some((o) => o.id === activeOrgId);
    if (!exists) {
      const first = organizations[0]!;
      setActiveOrgIdState(first.id);
      localStorage.setItem(ACTIVE_ORG_KEY, first.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizations]);

  const activeOrg = useMemo(
    () => organizations.find((o) => o.id === activeOrgId) ?? null,
    [organizations, activeOrgId],
  );

  const workspaces = useMemo(() => activeOrg?.workspaces ?? [], [activeOrg]);

  // Keep the active workspace valid within the active org.
  useEffect(() => {
    if (!activeOrg) return;
    const exists = activeOrg.workspaces.some((w) => w.id === activeWorkspaceId);
    if (!exists) {
      const first = activeOrg.workspaces[0];
      if (first) {
        setActiveWorkspaceIdState(first.id);
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, first.id);
      } else {
        setActiveWorkspaceIdState(null);
        localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrg]);

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId],
  );

  const createOrganization = async (name: string) => {
    const token = getAuthToken();
    if (!token) {
      toast.error("You must be logged in");
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/org/createOrganization`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        toast.error(error.message || "Failed to create organization");
        return;
      }
      const data = await response.json();
      const created = normalizeOrg({
        ...data.result.organization,
        workspaces: [],
      });
      setOrganizations((prev) => [...prev, created]);
      setActiveOrgId(created.id);
      toast.success("Organization created");
      return created;
    } catch (error) {
      console.error("Create organization error:", error);
      toast.error("An error occurred while creating the organization");
    }
  };

  const createWorkspace = async (name: string, orgId?: string) => {
    const token = getAuthToken();
    if (!token) {
      toast.error("You must be logged in");
      return;
    }
    const targetOrgId = orgId ?? activeOrgId;
    if (!targetOrgId) {
      toast.error("Select an organization first");
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/org/${targetOrgId}/workspaces`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ workspaceName: name }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        toast.error(error.message || "Failed to create workspace");
        return;
      }
      const data = await response.json();
      const created: Workspace = {
        id: data.result.workspace.id,
        name: data.result.workspace.name,
        orgId: data.result.workspace.orgId,
        createdAt: new Date(data.result.workspace.createdAt),
        taskWindow: normalizeTaskWindow(data.result.workspace),
      };
      // Insert the workspace into its org and select it.
      setOrganizations((prev) =>
        prev.map((o) => (o.id === targetOrgId ? { ...o, workspaces: [...o.workspaces, created] } : o)),
      );
      setActiveWorkspaceId(created.id);
      toast.success("Workspace created");
      return created;
    } catch (error) {
      console.error("Create workspace error:", error);
      toast.error("An error occurred while creating the workspace");
    }
  };

  // Admin-only: restrict (or lift the restriction on) when members of a
  // workspace may submit tasks. Updates local state so the toolbar reflects it
  // without a refetch, per the project's optimistic-mutation convention.
  const updateTaskWindow = async (workspaceId: string, window: TaskWindow) => {
    const token = getAuthToken();
    if (!token) {
      toast.error("You must be logged in");
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/workspace/${workspaceId}/task-window`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          enabled: window.enabled,
          startTime: window.startTime,
          endTime: window.endTime,
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        toast.error(error.message || "Failed to update the task window");
        return;
      }
      const data = await response.json();
      const saved = normalizeTaskWindow(data);
      setOrganizations((prev) =>
        prev.map((org) => ({
          ...org,
          workspaces: org.workspaces.map((ws) => (ws.id === workspaceId ? { ...ws, taskWindow: saved } : ws)),
        })),
      );
      toast.success(
        saved.enabled
          ? `Members can submit tasks ${saved.startTime}–${saved.endTime} IST`
          : "Members can now submit tasks anytime",
      );
      return saved;
    } catch (error) {
      console.error("Update task window error:", error);
      toast.error("An error occurred while updating the task window");
    }
  };

  return (
    <OrgContext.Provider
      value={{
        organizations,
        activeOrg,
        workspaces,
        activeWorkspace,
        isLoading,
        setActiveOrgId,
        setActiveWorkspaceId,
        refreshOrgs: fetchOrgs,
        createOrganization,
        createWorkspace,
        updateTaskWindow,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
};

export const useOrg = () => {
  const context = useContext(OrgContext);
  if (context === undefined) {
    throw new Error("useOrg must be used within an OrgProvider");
  }
  return context;
};
