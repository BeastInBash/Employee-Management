import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  UserMinus,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectContext";
import type {
  Permissions,
  ProjectDetail as ProjectDetailData,
  ProjectPerson,
  ProjectStatus,
  ProjectTask,
  ScopeAccess,
  ScopeRole,
  TeamSummary,
} from "@/contexts/ProjectContext";
import type { TaskPriority, TaskStatus } from "@/contexts/TaskContext";
import { api, errorMessage } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { AttendanceDot, ColorSwatch, EmptyState, PeoplePicker, PersonAvatar, ProgressMeter, ProjectStatusBadge, RoleBadge } from "@/components/projects/shared";
import { formatDate, fromDueDateInput, priorityColors, priorityLabels, projectStatusLabels, taskStatusColors, taskStatusLabels } from "@/lib/projectMeta";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { AddPeopleDialog } from "@/components/projects/AddPeopleDialog";

const COLUMNS: TaskStatus[] = ["todo", "in_progress", "review", "completed"];

type DetailResponse = { project: ProjectDetailData; myRole: ScopeAccess; permissions: Permissions };

const ProjectDetail = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { updateProject, deleteProject } = useProjects();

  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const [d, t] = await Promise.all([
        api<DetailResponse>(`/projects/${projectId}`),
        api<{ tasks: ProjectTask[] }>(`/projects/${projectId}/tasks`),
      ]);
      setDetail(d);
      setTasks(t.tasks);
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  // Stats on the header are recomputed locally so task edits reflect instantly.
  const stats = useMemo(() => {
    const now = new Date();
    const completed = tasks.filter((t) => t.status === "completed").length;
    return {
      total: tasks.length,
      completed,
      inProgress: tasks.filter((t) => t.status === "in_progress" || t.status === "review").length,
      overdue: tasks.filter((t) => t.status !== "completed" && new Date(t.dueDate) < now).length,
      progress: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
    };
  }, [tasks]);

  if (loadError) {
    return (
      <div className="min-h-screen bg-muted/40">
        <AppHeader />
        <main className="container mx-auto px-4 py-8">
          <EmptyState
            title="Can't open this project"
            body={loadError}
            action={<Button onClick={() => navigate("/projects")}>Back to projects</Button>}
          />
        </main>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen bg-muted/40">
        <AppHeader />
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const { project, permissions } = detail;
  const me = project.people.find((p) => p.userId === user?.id);

  const setStatus = async (status: ProjectStatus) => {
    const updated = await updateProject(project.id, { status });
    if (updated) setDetail({ ...detail, project: { ...project, status: updated.status } });
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <AppHeader />
      <div className="h-1" style={{ backgroundColor: project.color ?? "var(--border)" }} />
      <main className="container mx-auto px-4 py-6 space-y-6">
        <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Projects
        </Link>

        <section className="bg-background border border-border">
          <div className="p-5 flex flex-col lg:flex-row lg:items-start gap-5">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl break-words">{project.name}</h1>
                {permissions.canManage ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center gap-1">
                      <ProjectStatusBadge status={project.status} />
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {(Object.keys(projectStatusLabels) as ProjectStatus[]).map((s) => (
                        <DropdownMenuItem key={s} onClick={() => setStatus(s)}>
                          {projectStatusLabels[s]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <ProjectStatusBadge status={project.status} />
                )}
                <RoleBadge role={detail.myRole} />
              </div>
              {project.description && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap max-w-3xl">{project.description}</p>
              )}
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground pt-1">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {formatDate(project.startDate, "No start date")} → {formatDate(project.dueDate, "No due date")}
                </span>
                <span>{project.people.length} people</span>
                {project.teams.length > 0 && <span>{project.teams.map((t) => t.name).join(", ")}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 lg:self-start">
              {(permissions.canManage || permissions.canDelete) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Project actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {permissions.canManage && (
                      <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
                        <Pencil className="h-4 w-4" />
                        Edit details
                      </DropdownMenuItem>
                    )}
                    {permissions.canManage && (
                      <DropdownMenuItem onClick={() => navigate(`/reports?scope=project:${project.id}`)}>
                        <BarChart3 className="h-4 w-4" />
                        View report
                      </DropdownMenuItem>
                    )}
                    {permissions.canDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setIsDeleteOpen(true)}>
                          <Trash2 className="h-4 w-4" />
                          Delete project
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          <div className="border-t border-border px-5 py-4">
            <ProgressMeter value={stats.progress} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-border divide-x divide-border [&>*:nth-child(3)]:border-l-0 sm:[&>*:nth-child(3)]:border-l">
            <HeaderStat label="Tasks" value={stats.total} />
            <HeaderStat label="Completed" value={stats.completed} />
            <HeaderStat label="In progress" value={stats.inProgress} />
            <HeaderStat label="Overdue" value={stats.overdue} warn={stats.overdue > 0} />
          </div>
        </section>

        <Tabs defaultValue="board">
          <TabsList>
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="people">People ({project.people.length})</TabsTrigger>
            <TabsTrigger value="teams">Teams ({project.teams.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="board" className="mt-4">
            <Board
              projectId={project.id}
              people={project.people}
              tasks={tasks}
              setTasks={setTasks}
              canManage={permissions.canManage}
              myMemberId={me?.id}
            />
          </TabsContent>
          <TabsContent value="people" className="mt-4">
            <PeoplePanel detail={detail} setDetail={setDetail} reload={load} />
          </TabsContent>
          <TabsContent value="teams" className="mt-4">
            <TeamsPanel detail={detail} reload={load} />
          </TabsContent>
        </Tabs>
      </main>

      <ProjectFormDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        initial={{
          name: project.name,
          description: project.description ?? "",
          status: project.status,
          color: project.color ?? undefined,
          startDate: project.startDate,
          dueDate: project.dueDate,
        }}
        onSubmit={async ({ name, description, status, color, startDate, dueDate }) => {
          const updated = await updateProject(project.id, {
            name,
            status,
            description: description ?? null,
            color: color ?? null,
            startDate: startDate ?? null,
            dueDate: dueDate ?? null,
          });
          if (updated) {
            setDetail({
              ...detail,
              project: {
                ...project,
                name: updated.name,
                status: updated.status,
                description: updated.description,
                color: updated.color,
                startDate: updated.startDate,
                dueDate: updated.dueDate,
              },
            });
          }
          return !!updated;
        }}
      />

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{project.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The project and its member list will be removed. Its {tasks.length} task{tasks.length === 1 ? "" : "s"} stay on
              each person's task list, just without a project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={async (e) => {
                e.preventDefault();
                setIsDeleting(true);
                const ok = await deleteProject(project.id);
                setIsDeleting(false);
                if (ok) navigate("/projects");
              }}
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const HeaderStat = ({ label, value, warn }: { label: string; value: number; warn?: boolean }) => (
  <div className="px-5 py-3">
    <div className={`font-display text-xl ${warn ? "text-destructive" : ""}`}>{value}</div>
    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
  </div>
);

// ─── board ──────────────────────────────────────────────────────────────────

const Board = ({
  projectId,
  people,
  tasks,
  setTasks,
  canManage,
  myMemberId,
}: {
  projectId: string;
  people: ProjectPerson[];
  tasks: ProjectTask[];
  setTasks: React.Dispatch<React.SetStateAction<ProjectTask[]>>;
  canManage: boolean;
  myMemberId: string | undefined;
}) => {
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<ProjectTask | null>(null);

  const visible = tasks.filter((t) =>
    assigneeFilter === "all" ? true : assigneeFilter === "me" ? t.memberId === myMemberId : t.memberId === assigneeFilter
  );

  const canEdit = (t: ProjectTask) => canManage || t.memberId === myMemberId;

  const changeStatus = async (task: ProjectTask, status: TaskStatus) => {
    setBusyTaskId(task.id);
    try {
      const updated = await api<Omit<ProjectTask, "assignee">>(`/tasks/${task.id}`, { method: "PATCH", body: { status } });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...updated, assignee: t.assignee } : t)));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyTaskId(null);
    }
  };

  const remove = async () => {
    if (!taskToDelete) return;
    setBusyTaskId(taskToDelete.id);
    try {
      await api(`/tasks/${taskToDelete.id}`, { method: "DELETE" });
      setTasks((prev) => prev.filter((t) => t.id !== taskToDelete.id));
      toast.success("Task deleted");
      setTaskToDelete(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyTaskId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            {myMemberId && <SelectItem value="me">Assigned to me</SelectItem>}
            {people.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(canManage || myMemberId) && (
          <Button className="ml-auto" onClick={() => setIsAddOpen(true)} disabled={people.length === 0}>
            <Plus className="h-4 w-4" />
            Add task
          </Button>
        )}
      </div>

      {people.length === 0 ? (
        <EmptyState
          title="No one is on this project yet"
          body="Add people or assign a team from the People and Teams tabs, then start assigning work."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((status) => {
            const column = visible.filter((t) => t.status === status);
            return (
              <div key={status} className="bg-background border border-border flex flex-col min-h-40">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="flex items-center gap-2 text-xs uppercase tracking-wide">
                    <span className={`h-2 w-2 inline-block ${taskStatusColors[status]}`} />
                    {taskStatusLabels[status]}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{column.length}</span>
                </div>
                <div className="p-2 space-y-2 flex-1">
                  {column.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Nothing here</p>}
                  {column.map((t) => (
                    <BoardCard
                      key={t.id}
                      task={t}
                      canEdit={canEdit(t)}
                      canDelete={canManage}
                      isBusy={busyTaskId === t.id}
                      onStatus={(s) => changeStatus(t, s)}
                      onDelete={() => setTaskToDelete(t)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddTaskDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        projectId={projectId}
        people={people}
        canAssignOthers={canManage}
        myMemberId={myMemberId}
        onCreated={(task) => setTasks((prev) => [task, ...prev])}
      />

      <AlertDialog open={!!taskToDelete} onOpenChange={(o) => !o && setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>“{taskToDelete?.title}” will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={!!busyTaskId}
              onClick={(e) => {
                e.preventDefault();
                remove();
              }}
            >
              {busyTaskId && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const BoardCard = ({
  task,
  canEdit,
  canDelete,
  isBusy,
  onStatus,
  onDelete,
}: {
  task: ProjectTask;
  canEdit: boolean;
  canDelete: boolean;
  isBusy: boolean;
  onStatus: (s: TaskStatus) => void;
  onDelete: () => void;
}) => {
  const overdue = task.status !== "completed" && new Date(task.dueDate) < new Date();
  return (
    <div className="border border-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm leading-snug ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
          {task.title}
        </p>
        {(canEdit || canDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" disabled={isBusy} aria-label="Task actions">
                {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <MoreHorizontal className="h-3 w-3" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit &&
                COLUMNS.filter((s) => s !== task.status).map((s) => (
                  <DropdownMenuItem key={s} onClick={() => onStatus(s)}>
                    <span className={`h-2 w-2 inline-block ${taskStatusColors[s]}`} />
                    Move to {taskStatusLabels[s]}
                  </DropdownMenuItem>
                ))}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {task.description && <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 min-w-0">
          <PersonAvatar person={task.assignee} className="h-6 w-6 text-[9px]" />
          <span className="text-xs truncate">{task.assignee.name}</span>
        </span>
        <Badge className={`${priorityColors[task.priority]} text-[10px]`}>{priorityLabels[task.priority]}</Badge>
      </div>
      <div className={`flex items-center gap-1 text-[11px] ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
        {overdue ? <AlertTriangle className="h-3 w-3" /> : <CalendarDays className="h-3 w-3" />}
        {overdue ? "Overdue · " : "Due "}
        {formatDate(task.dueDate)}
      </div>
    </div>
  );
};

const AddTaskDialog = ({
  open,
  onOpenChange,
  projectId,
  people,
  canAssignOthers,
  myMemberId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  people: ProjectPerson[];
  canAssignOthers: boolean;
  myMemberId: string | undefined;
  onCreated: (t: ProjectTask) => void;
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assignee, setAssignee] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
    setAssignee(myMemberId ? [myMemberId] : []);
  }, [open, myMemberId]);

  const assigneeId = canAssignOthers ? assignee[0] : myMemberId;
  const valid = title.trim().length >= 3 && description.trim().length >= 10 && !!dueDate && !!assigneeId;

  const submit = async () => {
    setIsSaving(true);
    try {
      const { task } = await api<{ task: ProjectTask }>(`/projects/${projectId}/tasks`, {
        method: "POST",
        body: {
          title: title.trim(),
          description: description.trim(),
          priority,
          dueDate: fromDueDateInput(dueDate),
          ...(assigneeId && { memberId: assigneeId }),
        },
      });
      onCreated(task);
      toast.success("Task added");
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add task</DialogTitle>
          <DialogDescription>
            {canAssignOthers ? "Assign work to anyone on this project." : "Add a task for yourself on this project."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="task-title">Title</Label>
            <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea id="task-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            {description.length > 0 && description.trim().length < 10 && (
              <p className="text-xs text-muted-foreground">At least 10 characters.</p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(priorityLabels) as TaskPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {priorityLabels[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-due">Due date</Label>
              <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          {canAssignOthers && (
            <div className="space-y-2">
              <Label>Assignee</Label>
              <PeoplePicker people={people} value={assignee} onChange={setAssignee} single placeholder="Choose someone" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            Add task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── people ─────────────────────────────────────────────────────────────────

const PeoplePanel = ({
  detail,
  setDetail,
  reload,
}: {
  detail: DetailResponse;
  setDetail: (d: DetailResponse) => void;
  reload: () => Promise<void>;
}) => {
  const { project, permissions } = detail;
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const setRole = async (person: ProjectPerson, role: ScopeRole) => {
    setBusyId(person.id);
    try {
      await api(`/projects/${project.id}/members/${person.id}`, { method: "PATCH", body: { role } });
      setDetail({
        ...detail,
        project: { ...project, people: project.people.map((p) => (p.id === person.id ? { ...p, projectRole: role } : p)) },
      });
      toast.success(role === "lead" ? `${person.name} now leads this project` : `${person.name} is no longer a lead`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (person: ProjectPerson) => {
    setBusyId(person.id);
    try {
      await api(`/projects/${project.id}/members/${person.id}`, { method: "DELETE" });
      // People who are also on an assigned team stay, just without a direct seat.
      setDetail({
        ...detail,
        project: {
          ...project,
          people: project.people.flatMap((p) =>
            p.id !== person.id ? [p] : p.viaTeams.length ? [{ ...p, projectRole: null }] : []
          ),
        },
      });
      toast.success(`${person.name} removed`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const sorted = [...project.people].sort((a, b) => {
    const rank = (p: ProjectPerson) => (p.projectRole === "lead" ? 0 : p.projectRole === "member" ? 1 : 2);
    return rank(a) - rank(b) || a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-4">
      {permissions.canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setIsAddOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Add people
          </Button>
        </div>
      )}
      {sorted.length === 0 ? (
        <EmptyState title="No one here yet" body="Add people directly, or assign a whole team from the Teams tab." />
      ) : (
        <div className="bg-background border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left font-normal px-4 py-2">Person</th>
                <th className="text-left font-normal px-4 py-2">Role</th>
                <th className="text-left font-normal px-4 py-2">Today</th>
                <th className="text-left font-normal px-4 py-2 min-w-40">Project tasks</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((p) => {
                const canRemove =
                  permissions.canManage && p.projectRole !== null && (p.projectRole !== "lead" || permissions.canAssignLeads);
                const showMenu = canRemove || (permissions.canAssignLeads && p.projectRole !== null);
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <PersonAvatar person={p} />
                        <div className="min-w-0">
                          <div className="truncate">{p.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{p.jobTitle}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {p.projectRole === "lead" ? (
                          <RoleBadge role="lead" />
                        ) : p.projectRole === "member" ? (
                          <span className="text-xs">Member</span>
                        ) : null}
                        {p.viaTeams.length > 0 && (
                          <span className="text-xs text-muted-foreground">via {p.viaTeams.join(", ")}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <AttendanceDot status={p.todayAttendance} showLabel />
                    </td>
                    <td className="px-4 py-3">
                      <ProgressMeter value={p.stats.progress} />
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {p.stats.completed}/{p.stats.total} done
                        {p.stats.overdue > 0 && <span className="text-destructive"> · {p.stats.overdue} overdue</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {showMenu && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={busyId === p.id} aria-label={`Manage ${p.name}`}>
                              {busyId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {permissions.canAssignLeads && p.projectRole === "member" && (
                              <DropdownMenuItem onClick={() => setRole(p, "lead")}>Make project lead</DropdownMenuItem>
                            )}
                            {permissions.canAssignLeads && p.projectRole === "lead" && (
                              <DropdownMenuItem onClick={() => setRole(p, "member")}>Remove lead role</DropdownMenuItem>
                            )}
                            {canRemove && (
                              <DropdownMenuItem className="text-destructive" onClick={() => remove(p)}>
                                <UserMinus className="h-4 w-4" />
                                Remove from project
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AddPeopleDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        projectId={project.id}
        workspaceId={project.workspaceId}
        existing={project.people.filter((p) => p.projectRole !== null).map((p) => p.id)}
        canAssignLeads={permissions.canAssignLeads}
        onDone={reload}
      />
    </div>
  );
};

// ─── teams ──────────────────────────────────────────────────────────────────

const TeamsPanel = ({ detail, reload }: { detail: DetailResponse; reload: () => Promise<void> }) => {
  const { project, permissions } = detail;
  const [available, setAvailable] = useState<TeamSummary[]>([]);
  const [pick, setPick] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!permissions.canManage) return;
    api<{ teams: TeamSummary[] }>("/teams", { query: { workspaceId: project.workspaceId } })
      .then((d) => setAvailable(d.teams))
      .catch(() => setAvailable([]));
  }, [permissions.canManage, project.workspaceId]);

  const assigned = new Set(project.teams.map((t) => t.id));
  const options = available.filter((t) => !assigned.has(t.id));

  const assign = async () => {
    if (!pick) return;
    setBusy(pick);
    try {
      await api(`/projects/${project.id}/teams`, { method: "POST", body: { teamId: pick } });
      toast.success("Team assigned");
      setPick("");
      await reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const unassign = async (teamId: string) => {
    setBusy(teamId);
    try {
      await api(`/projects/${project.id}/teams/${teamId}`, { method: "DELETE" });
      toast.success("Team unassigned");
      await reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {permissions.canManage && (
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <Select value={pick} onValueChange={setPick} disabled={options.length === 0}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder={options.length ? "Choose a team" : "No other teams"} />
            </SelectTrigger>
            <SelectContent>
              {options.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} ({t.memberCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={assign} disabled={!pick || !!busy}>
            {busy === pick && pick ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Assign team
          </Button>
        </div>
      )}
      {project.teams.length === 0 ? (
        <EmptyState
          title="No teams assigned"
          body="Assigning a team gives everyone on it access to this project and lets leads assign them work."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {project.teams.map((t) => (
            <div key={t.id} className="bg-background border border-border p-4 flex items-center gap-3">
              <ColorSwatch color={t.color} className="h-8 w-8" />
              <Link to={`/teams/${t.id}`} className="min-w-0 flex-1 hover:text-primary">
                <div className="truncate">{t.name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <UsersRound className="h-3 w-3" />
                  {t.memberCount} {t.memberCount === 1 ? "person" : "people"}
                </div>
              </Link>
              {permissions.canManage && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Unassign ${t.name}`}
                  disabled={busy === t.id}
                  onClick={() => unassign(t.id)}
                >
                  {busy === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;
