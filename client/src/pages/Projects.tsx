import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarDays, Loader2, Plus, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { useProjects } from "@/contexts/ProjectContext";
import type { ProjectStatus, ProjectSummary } from "@/contexts/ProjectContext";
import { PageHeader } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AvatarStack, EmptyState, ProgressMeter, ProjectStatusBadge, RoleBadge } from "@/components/projects/shared";
import { formatDate } from "@/lib/projectMeta";
import { useWorkspacePeople } from "@/hooks/use-workspace-people";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { cn } from "@/lib/utils";

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
    <>
      <PageHeader
        title="Projects"
        description={
          isAdmin
            ? `Everything in motion at ${activeWorkspace?.name ?? "your workspace"}, who leads it, and how far along it is.`
            : "The projects you lead or contribute to."
        }
        actions={
          isAdmin && (
            <Button onClick={() => setIsCreateOpen(true)} disabled={noWorkspace}>
              <Plus className="h-4 w-4" />
              New project
            </Button>
          )
        }
      />

      {projects.length > 0 && (
        <dl className="mb-8 grid grid-cols-3 gap-3 sm:max-w-xl">
          <Stat label="Open projects" value={totals.open} />
          <Stat label="Average progress" value={`${totals.progress}%`} />
          <Stat label="Overdue tasks" value={totals.overdueTasks} warn={totals.overdueTasks > 0} />
        </dl>
      )}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="max-w-full overflow-x-auto">
          <TabsList>
            {FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects" className="bg-card pl-9" />
        </div>
      </div>

      {(isLoading || (isAdmin && orgsLoading)) && projects.length === 0 ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : noWorkspace ? (
        <EmptyState
          title="Choose a workspace first"
          body="Projects live inside a workspace. Create one on the Members page, or pick one from the switcher in the sidebar."
          action={<Button onClick={() => navigate("/dashboard")}>Go to Members</Button>}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title={projects.length === 0 ? "No projects yet" : "Nothing matches"}
          body={
            projects.length === 0
              ? isAdmin
                ? "Start a project, choose who leads it, and bring in people or whole teams."
                : "Projects you're added to will appear here."
              : "Try another filter or a different search."
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
        <motion.div
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.04 } } }}
        >
          {visible.map((p) => (
            <motion.div
              key={p.id}
              variants={{
                hidden: { opacity: 0, transform: "translateY(6px)" },
                show: { opacity: 1, transform: "translateY(0px)", transition: { duration: 0.25, ease: [0.23, 1, 0.32, 1] } },
              }}
            >
              <ProjectCard project={p} onOpen={() => navigate(`/projects/${p.id}`)} />
            </motion.div>
          ))}
        </motion.div>
      )}

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
    </>
  );
};

const Stat = ({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) => (
  <div className="rounded-lg bg-card px-4 py-3 ring-1 ring-border/70">
    <dd className={cn("text-xl font-semibold tracking-tight", warn && "text-destructive")}>{value}</dd>
    <dt className="text-xs text-muted-foreground">{label}</dt>
  </div>
);

const ProjectCard = ({ project: p, onOpen }: { project: ProjectSummary; onOpen: () => void }) => {
  const late = !!p.dueDate && new Date(p.dueDate) < new Date() && p.status !== "completed" && p.status !== "archived";
  return (
    <button
      onClick={onOpen}
      className="group flex h-full w-full flex-col rounded-xl border border-border/80 bg-card p-5 text-left transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-[0_8px_24px_-16px_rgb(78_34_15/0.35)] focus-visible:outline-2 focus-visible:outline-ring active:scale-[0.99]"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color ?? "var(--primary)" }} />
          <h3 className="truncate text-[15px]">{p.name}</h3>
        </div>
        <ProjectStatusBadge status={p.status} />
      </div>
      <p className="mb-5 line-clamp-2 min-h-10 text-sm text-muted-foreground">{p.description || "No description yet."}</p>
      <ProgressMeter value={p.stats.progress} className="mb-2" />
      <p className="text-xs text-muted-foreground">
        {p.stats.completed} of {p.stats.total} tasks done
        {p.stats.overdue > 0 && <span className="text-destructive">, {p.stats.overdue} overdue</span>}
      </p>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <AvatarStack people={p.leads} max={3} />
          {p.myRole === "lead" && <RoleBadge role="lead" />}
          {p.teams.length > 0 && (
            <span className="truncate text-xs text-muted-foreground">{p.teams.map((t) => t.name).join(", ")}</span>
          )}
        </div>
        <span className={cn("flex shrink-0 items-center gap-1 text-xs", late ? "text-destructive" : "text-muted-foreground")}>
          <CalendarDays className="h-3.5 w-3.5" />
          {formatDate(p.dueDate, "No due date")}
        </span>
      </div>
    </button>
  );
};

export default Projects;
