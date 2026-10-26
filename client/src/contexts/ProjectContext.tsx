import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "@/components/ui/sonner";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "./AuthContext";
import { useOrg } from "./OrgContext";
import type { TaskPriority, TaskStatus } from "./TaskContext";

// ─── domain types (mirror backend projects/teams controllers) ────────────────

export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "archived";
export type ScopeRole = "lead" | "member";
/** The caller's standing on a project/team. `null` = not on it. */
export type ScopeAccess = "admin" | "lead" | "member" | null;
export type AttendanceStatus = "present" | "partial" | "absent";

/** A Member seat (ids are **Member** ids, not User ids). */
export type Person = {
  id: string;
  userId: string;
  name: string;
  email: string;
  jobTitle: string;
};

export type TaskStats = {
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
  progress: number;
};

export type TeamRef = { id: string; name: string; color: string | null };

export type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  color: string | null;
  startDate: string | null;
  dueDate: string | null;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  leads: Person[];
  memberCount: number;
  teams: TeamRef[];
  stats: TaskStats;
  myRole: ScopeAccess;
};

export type ProjectPerson = Person & {
  projectRole: ScopeRole | null;
  viaTeams: string[];
  stats: TaskStats;
  todayAttendance: AttendanceStatus;
};

export type Permissions = { canManage: boolean; canAssignLeads: boolean; canDelete: boolean };

export type ProjectDetail = Omit<ProjectSummary, "leads" | "memberCount" | "teams" | "myRole"> & {
  teams: (TeamRef & { memberCount: number })[];
  people: ProjectPerson[];
};

export type ProjectTask = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  memberId: string;
  projectId: string | null;
  createdAt: string;
  completedAt: string | null;
  assignee: Person;
};

export type TeamSummary = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  leads: Person[];
  memberCount: number;
  projectCount: number;
  myRole: ScopeAccess;
};

export type TeamMemberRow = Person & {
  teamRole: ScopeRole;
  joinedAt: string;
  stats: { total: number; completed: number; overdue: number };
  todayAttendance: AttendanceStatus;
};

export type TeamDetail = Omit<TeamSummary, "leads" | "memberCount" | "projectCount" | "myRole"> & {
  members: TeamMemberRow[];
  projects: { id: string; name: string; color: string | null; status: ProjectStatus; dueDate: string | null }[];
};

export type WorkspacePerson = Person & { teams: (TeamRef & { role: ScopeRole })[] };

export type ProjectInput = {
  name: string;
  description?: string;
  status?: ProjectStatus;
  color?: string;
  startDate?: string;
  dueDate?: string;
  leadIds?: string[];
  memberIds?: string[];
  teamIds?: string[];
};

export type TeamInput = {
  name: string;
  description?: string;
  color?: string;
  leadIds?: string[];
  memberIds?: string[];
};

/** PATCH body: `null` clears an optional field. */
export type ProjectPatch = {
  name?: string;
  status?: ProjectStatus;
  description?: string | null;
  color?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
};

type ProjectContextType = {
  projects: ProjectSummary[];
  teams: TeamSummary[];
  isLoading: boolean;
  /** Admins browse the active workspace; members see what they're on everywhere. */
  scopeWorkspaceId: string | undefined;
  refresh: () => Promise<void>;
  createProject: (input: ProjectInput) => Promise<ProjectSummary | void>;
  updateProject: (id: string, patch: ProjectPatch) => Promise<ProjectSummary | void>;
  deleteProject: (id: string) => Promise<boolean>;
  createTeam: (input: TeamInput) => Promise<TeamSummary | void>;
  updateTeam: (
    id: string,
    patch: { name?: string; description?: string | null; color?: string | null },
  ) => Promise<TeamSummary | void>;
  deleteTeam: (id: string) => Promise<boolean>;
};

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { activeWorkspace } = useOrg();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const scopeWorkspaceId = user?.role === "admin" ? activeWorkspace?.id : undefined;

  const refresh = useCallback(async () => {
    if (!user) return;
    // An admin with no workspace yet has nothing to list.
    if (user.role === "admin" && !scopeWorkspaceId) {
      setProjects([]);
      setTeams([]);
      return;
    }
    setIsLoading(true);
    try {
      const query = { workspaceId: scopeWorkspaceId };
      const [p, t] = await Promise.all([
        api<{ projects: ProjectSummary[] }>("/projects", { query }),
        api<{ teams: TeamSummary[] }>("/teams", { query }),
      ]);
      setProjects(p.projects);
      setTeams(t.teams);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }, [user, scopeWorkspaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createProject: ProjectContextType["createProject"] = async (input) => {
    if (!scopeWorkspaceId) return void toast.error("Select a workspace first");
    try {
      const { project } = await api<{ project: ProjectSummary }>("/projects", {
        method: "POST",
        body: { ...input, workspaceId: scopeWorkspaceId },
      });
      setProjects((prev) => [project, ...prev]);
      // Seeded teams now count one more project.
      if (input.teamIds?.length) {
        setTeams((prev) =>
          prev.map((t) => (input.teamIds!.includes(t.id) ? { ...t, projectCount: t.projectCount + 1 } : t)),
        );
      }
      toast.success("Project created");
      return project;
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const updateProject: ProjectContextType["updateProject"] = async (id, patch) => {
    try {
      const { project } = await api<{ project: ProjectSummary }>(`/projects/${id}`, { method: "PATCH", body: patch });
      setProjects((prev) => prev.map((p) => (p.id === id ? project : p)));
      return project;
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const deleteProject = async (id: string) => {
    try {
      await api(`/projects/${id}`, { method: "DELETE" });
      setProjects((prev) => prev.filter((p) => p.id !== id));
      toast.success("Project deleted");
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    }
  };

  const createTeam: ProjectContextType["createTeam"] = async (input) => {
    if (!scopeWorkspaceId) return void toast.error("Select a workspace first");
    try {
      const { team } = await api<{ team: TeamSummary }>("/teams", {
        method: "POST",
        body: { ...input, workspaceId: scopeWorkspaceId },
      });
      setTeams((prev) => [...prev, team].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success("Team created");
      return team;
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const updateTeam: ProjectContextType["updateTeam"] = async (id, patch) => {
    try {
      const { team } = await api<{ team: TeamSummary }>(`/teams/${id}`, { method: "PATCH", body: patch });
      setTeams((prev) => prev.map((t) => (t.id === id ? team : t)));
      return team;
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const deleteTeam = async (id: string) => {
    try {
      await api(`/teams/${id}`, { method: "DELETE" });
      setTeams((prev) => prev.filter((t) => t.id !== id));
      toast.success("Team deleted");
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    }
  };

  return (
    <ProjectContext.Provider
      value={{
        projects,
        teams,
        isLoading,
        scopeWorkspaceId,
        refresh,
        createProject,
        updateProject,
        deleteProject,
        createTeam,
        updateTeam,
        deleteTeam,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProjects = () => {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProjects must be used within a ProjectProvider");
  return ctx;
};
