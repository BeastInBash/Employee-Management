import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarDays, Loader2, Plus, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { useProjects } from "@/contexts/ProjectContext";
import type { ProjectStatus, ProjectSummary } from "@/contexts/ProjectContext";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AvatarStack, ColorSwatch, EmptyState, ProgressMeter, ProjectStatusBadge, RoleBadge } from "@/components/projects/shared";
import { formatDate } from "@/lib/projectMeta";
import { useWorkspacePeople } from "@/hooks/use-workspace-people";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";

type Filter = "open" | ProjectStatus | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "planning", label: "Planning" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
];

const isOpen = (p: ProjectSummary) => p.status === "active" || p.status === "planning" || p.status === "on_hold";

const Projects = () => {
  const { user } = useAuth();
  const { activeWorkspace, isLoading: orgsLoading } = useOrg();
  const { projects, teams, isLoading, createProject, scopeWorkspaceId } = useProjects();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const { people } = useWorkspacePeople(isAdmin ? scopeWorkspaceId : undefined);

  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects
      .filter((p) => (filter === "all" ? true : filter === "open" ? isOpen(p) : p.status === filter))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
  }, [projects, filter, query]);

  const totals = useMemo(() => {
    const open = projects.filter(isOpen);
    return {
      open: open.length,
      overdueTasks: projects.reduce((n, p) => n + p.stats.overdue, 0),
      progress: open.length ? Math.round(open.reduce((n, p) => n + p.stats.progress, 0) / open.length) : 0,
    };
  }, [projects]);

  const noWorkspace = isAdmin && !orgsLoading && !activeWorkspace;

  return (
    <div className="min-h-screen bg-muted/40">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl">Projects</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isAdmin
                ? `Everything running in ${activeWorkspace?.name ?? "your workspace"}.`
                : "Projects you lead or contribute to."}
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setIsCreateOpen(true)} disabled={noWorkspace}>
              <Plus className="h-4 w-4" />
              New project
            </Button>
          )}
        </div>

        {projects.length > 0 && (
          <div className="grid grid-cols-3 border border-border bg-background divide-x divide-border">
            <Stat label="Open projects" value={totals.open} />
            <Stat label="Avg. progress" value={`${totals.progress}%`} />
            <Stat label="Overdue tasks" value={totals.overdueTasks} tone={totals.overdueTasks ? "warn" : undefined} />
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="overflow-x-auto">
            <TabsList>
              {FILTERS.map((f) => (
                <TabsTrigger key={f.value} value={f.value}>
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative sm:ml-auto sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects" className="pl-9" />
          </div>
        </div>

        {(isLoading || (isAdmin && orgsLoading)) && projects.length === 0 ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : noWorkspace ? (
          <EmptyState
            title="No workspace selected"
            body="Create or pick a workspace on the Members page first — projects live inside a workspace."
            action={<Button onClick={() => navigate("/dashboard")}>Go to Members</Button>}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title={projects.length === 0 ? "No projects yet" : "Nothing matches"}
            body={
              projects.length === 0
                ? isAdmin
                  ? "Create a project, pick its leads, and assign people or whole teams to it."
                  : "When you're added to a project, it will show up here."
                : "Try a different filter or search."
            }
            action={
              isAdmin && projects.length === 0 ? (
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New project
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visible.map((p) => (
              <ProjectCard key={p.id} project={p} onOpen={() => navigate(`/projects/${p.id}`)} />
            ))}
          </div>
        )}
      </main>

      <ProjectFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        people={people}
        teams={teams}
        onSubmit={async (values) => {
          const created = await createProject({
            ...values,
            description: values.description ?? undefined,
            startDate: values.startDate ?? undefined,
            dueDate: values.dueDate ?? undefined,
          });
          if (created) navigate(`/projects/${created.id}`);
          return !!created;
        }}
      />
    </div>
  );
};

const Stat = ({ label, value, tone }: { label: string; value: string | number; tone?: "warn" }) => (
  <div className="px-4 py-3">
    <div className={`font-display text-xl sm:text-2xl ${tone === "warn" ? "text-destructive" : ""}`}>{value}</div>
    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
  </div>
);

const ProjectCard = ({ project: p, onOpen }: { project: ProjectSummary; onOpen: () => void }) => {
  const overdueProject = p.dueDate && new Date(p.dueDate) < new Date() && p.status !== "completed" && p.status !== "archived";
  return (
    <button
      onClick={onOpen}
      className="group text-left bg-background border border-border hover:border-primary transition-colors flex flex-col"
      style={{ borderTop: `3px solid ${p.color ?? "var(--border)"}` }}
    >
      <div className="p-4 space-y-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base truncate group-hover:text-primary transition-colors">{p.name}</h3>
            {p.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{p.description}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <RoleBadge role={p.myRole === "lead" ? "lead" : null} />
            <ProjectStatusBadge status={p.status} />
          </div>
        </div>
        <ProgressMeter value={p.stats.progress} />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {p.stats.completed}/{p.stats.total} tasks done
          </span>
          {p.stats.overdue > 0 && (
            <span className="flex items-center gap-1 text-destructive">
              <AlertTriangle className="h-3 w-3" />
              {p.stats.overdue} overdue
            </span>
          )}
        </div>
      </div>
      <div className="border-t border-border px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <AvatarStack people={p.leads} />
          <span className="text-xs text-muted-foreground truncate">
            {p.leads.length ? `Led by ${p.leads.map((l) => l.name.split(" ")[0]).join(", ")}` : "No lead yet"}
          </span>
        </div>
        <span className={`flex items-center gap-1 text-xs shrink-0 ${overdueProject ? "text-destructive" : "text-muted-foreground"}`}>
          <CalendarDays className="h-3 w-3" />
          {formatDate(p.dueDate, "No due date")}
        </span>
      </div>
      {p.teams.length > 0 && (
        <div className="border-t border-border px-4 py-2 flex flex-wrap gap-3">
          {p.teams.map((t) => (
            <span key={t.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ColorSwatch color={t.color} className="h-2 w-2" />
              {t.name}
            </span>
          ))}
        </div>
      )}
    </button>
  );
};

export default Projects;
