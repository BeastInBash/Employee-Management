import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, MoreHorizontal, Pencil, Trash2, UserMinus, UserPlus } from "lucide-react";
import { useProjects } from "@/contexts/ProjectContext";
import type { Permissions, ScopeAccess, ScopeRole, TeamDetail as TeamDetailData, TeamMemberRow } from "@/contexts/ProjectContext";
import { api, errorMessage } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { AttendanceDot, ColorSwatch, EmptyState, PersonAvatar, ProjectStatusBadge, RoleBadge } from "@/components/projects/shared";
import { formatDate } from "@/lib/projectMeta";
import { TeamFormDialog } from "@/components/projects/TeamFormDialog";
import { AddPeopleDialog } from "@/components/projects/AddPeopleDialog";

type DetailResponse = { team: TeamDetailData; myRole: ScopeAccess; permissions: Permissions };

const TeamDetail = () => {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { updateTeam, deleteTeam } = useProjects();
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!teamId) return;
    try {
      setDetail(await api<DetailResponse>(`/teams/${teamId}`));
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, [teamId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loadError) {
    return (
      <div className="min-h-screen bg-muted/40">
        <AppHeader />
        <main className="container mx-auto px-4 py-8">
          <EmptyState
            title="Can't open this team"
            body={loadError}
            action={<Button onClick={() => navigate("/teams")}>Back to teams</Button>}
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

  const { team, permissions } = detail;
  const present = team.members.filter((m) => m.todayAttendance === "present").length;
  const partial = team.members.filter((m) => m.todayAttendance === "partial").length;
  const openTasks = team.members.reduce((n, m) => n + (m.stats.total - m.stats.completed), 0);
  const overdue = team.members.reduce((n, m) => n + m.stats.overdue, 0);

  const setRole = async (m: TeamMemberRow, role: ScopeRole) => {
    setBusyId(m.id);
    try {
      await api(`/teams/${team.id}/members/${m.id}`, { method: "PATCH", body: { role } });
      setDetail({ ...detail, team: { ...team, members: team.members.map((x) => (x.id === m.id ? { ...x, teamRole: role } : x)) } });
      toast.success(role === "lead" ? `${m.name} now leads ${team.name}` : `${m.name} is no longer a lead`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (m: TeamMemberRow) => {
    setBusyId(m.id);
    try {
      await api(`/teams/${team.id}/members/${m.id}`, { method: "DELETE" });
      setDetail({ ...detail, team: { ...team, members: team.members.filter((x) => x.id !== m.id) } });
      toast.success(`${m.name} removed from ${team.name}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const sorted = [...team.members].sort(
    (a, b) => (a.teamRole === "lead" ? 0 : 1) - (b.teamRole === "lead" ? 0 : 1) || a.name.localeCompare(b.name)
  );

  return (
    <div className="min-h-screen bg-muted/40">
      <AppHeader />
      <div className="h-1" style={{ backgroundColor: team.color ?? "var(--border)" }} />
      <main className="container mx-auto px-4 py-6 space-y-6">
        <Link to="/teams" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Teams
        </Link>

        <section className="bg-background border border-border">
          <div className="p-5 flex flex-wrap items-start gap-4">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl break-words">{team.name}</h1>
                <RoleBadge role={detail.myRole} />
              </div>
              {team.description && <p className="text-sm text-muted-foreground max-w-3xl">{team.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              {permissions.canManage && (
                <Button onClick={() => setIsAddOpen(true)}>
                  <UserPlus className="h-4 w-4" />
                  Add people
                </Button>
              )}
              {permissions.canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Team actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
                      <Pencil className="h-4 w-4" />
                      Edit details
                    </DropdownMenuItem>
                    {permissions.canDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setIsDeleteOpen(true)}>
                          <Trash2 className="h-4 w-4" />
                          Delete team
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-border divide-x divide-border [&>*:nth-child(3)]:border-l-0 sm:[&>*:nth-child(3)]:border-l">
            <Stat label="People" value={team.members.length} />
            <Stat label="Present today" value={`${present}${partial ? ` +${partial}` : ""}`} />
            <Stat label="Open tasks" value={openTasks} />
            <Stat label="Overdue" value={overdue} warn={overdue > 0} />
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 space-y-3">
            <h2 className="text-sm uppercase tracking-wide text-muted-foreground">Roster</h2>
            {sorted.length === 0 ? (
              <EmptyState title="No one on this team yet" body="Add people from the workspace to get started." />
            ) : (
              <div className="bg-background border border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                    <tr>
                      <th className="text-left font-normal px-4 py-2">Person</th>
                      <th className="text-left font-normal px-4 py-2">Today</th>
                      <th className="text-left font-normal px-4 py-2">Tasks</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sorted.map((m) => {
                      const canRemove = permissions.canManage && (m.teamRole !== "lead" || permissions.canAssignLeads);
                      return (
                        <tr key={m.id}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <PersonAvatar person={m} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="truncate">{m.name}</span>
                                  <RoleBadge role={m.teamRole} />
                                </div>
                                <div className="text-xs text-muted-foreground truncate">{m.jobTitle}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <AttendanceDot status={m.todayAttendance} showLabel />
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <span className="tabular-nums">
                              {m.stats.completed}/{m.stats.total}
                            </span>{" "}
                            <span className="text-muted-foreground">done</span>
                            {m.stats.overdue > 0 && <span className="text-destructive"> · {m.stats.overdue} overdue</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {(canRemove || permissions.canAssignLeads) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" disabled={busyId === m.id} aria-label={`Manage ${m.name}`}>
                                    {busyId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {permissions.canAssignLeads && (
                                    <DropdownMenuItem onClick={() => setRole(m, m.teamRole === "lead" ? "member" : "lead")}>
                                      {m.teamRole === "lead" ? "Remove lead role" : "Make team lead"}
                                    </DropdownMenuItem>
                                  )}
                                  {canRemove && (
                                    <DropdownMenuItem className="text-destructive" onClick={() => remove(m)}>
                                      <UserMinus className="h-4 w-4" />
                                      Remove from team
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
          </section>

          <section className="space-y-3">
            <h2 className="text-sm uppercase tracking-wide text-muted-foreground">Projects</h2>
            {team.projects.length === 0 ? (
              <p className="text-sm text-muted-foreground border border-dashed border-border bg-background p-4">
                Not assigned to any project yet. Assign this team from a project's Teams tab.
              </p>
            ) : (
              <div className="bg-background border border-border divide-y divide-border">
                {team.projects.map((p) => (
                  <Link key={p.id} to={`/projects/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                    <ColorSwatch color={p.color} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{p.name}</div>
                      <div className="text-xs text-muted-foreground">Due {formatDate(p.dueDate, "—")}</div>
                    </div>
                    <ProjectStatusBadge status={p.status} />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      <TeamFormDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        initial={{ name: team.name, description: team.description ?? "", color: team.color ?? undefined }}
        onSubmit={async ({ name, description, color }) => {
          const updated = await updateTeam(team.id, { name, description: description ?? null, color: color ?? null });
          if (updated) {
            setDetail({
              ...detail,
              team: { ...team, name: updated.name, description: updated.description, color: updated.color },
            });
          }
          return !!updated;
        }}
      />

      <AddPeopleDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        teamId={team.id}
        workspaceId={team.workspaceId}
        existing={team.members.map((m) => m.id)}
        canAssignLeads={permissions.canAssignLeads}
        onDone={load}
      />

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{team.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The team is removed and unassigned from its projects. People keep their workspace seats, direct project
              seats and tasks.
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
                const ok = await deleteTeam(team.id);
                setIsDeleting(false);
                if (ok) navigate("/teams");
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

const Stat = ({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) => (
  <div className="px-5 py-3">
    <div className={`font-display text-xl ${warn ? "text-destructive" : ""}`}>{value}</div>
    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
  </div>
);

export default TeamDetail;
