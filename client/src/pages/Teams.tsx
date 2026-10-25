import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, Loader2, Plus, UsersRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { useProjects } from "@/contexts/ProjectContext";
import type { TeamSummary } from "@/contexts/ProjectContext";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { AvatarStack, EmptyState, RoleBadge } from "@/components/projects/shared";
import { useWorkspacePeople } from "@/hooks/use-workspace-people";
import { TeamFormDialog } from "@/components/projects/TeamFormDialog";

const Teams = () => {
  const { user } = useAuth();
  const { activeWorkspace, isLoading: orgsLoading } = useOrg();
  const { teams, isLoading, createTeam, scopeWorkspaceId } = useProjects();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const { people } = useWorkspacePeople(isAdmin ? scopeWorkspaceId : undefined);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const noWorkspace = isAdmin && !orgsLoading && !activeWorkspace;
  // Admins see every team in the workspace; split "mine" first for members.
  const mine = teams.filter((t) => t.myRole === "lead" || t.myRole === "member");
  const others = teams.filter((t) => !mine.includes(t));

  return (
    <div className="min-h-screen bg-muted/40">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl">Teams</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isAdmin ? "Group people, appoint leads, and assign whole teams to projects." : "The teams you're part of."}
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setIsCreateOpen(true)} disabled={noWorkspace}>
              <Plus className="h-4 w-4" />
              New team
            </Button>
          )}
        </div>

        {(isLoading || (isAdmin && orgsLoading)) && teams.length === 0 ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : noWorkspace ? (
          <EmptyState
            title="No workspace selected"
            body="Create or pick a workspace on the Members page first — teams live inside a workspace."
            action={<Button onClick={() => navigate("/dashboard")}>Go to Members</Button>}
          />
        ) : teams.length === 0 ? (
          <EmptyState
            title="No teams yet"
            body={
              isAdmin
                ? "Create teams like Design or Sales, pick a lead for each, and assign them to projects."
                : "When you're added to a team, it will show up here."
            }
            action={
              isAdmin ? (
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New team
                </Button>
              ) : undefined
            }
          />
        ) : isAdmin ? (
          <TeamGrid teams={teams} onOpen={(id) => navigate(`/teams/${id}`)} />
        ) : (
          <div className="space-y-8">
            <TeamGrid teams={mine} onOpen={(id) => navigate(`/teams/${id}`)} />
            {others.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm uppercase tracking-wide text-muted-foreground">Other teams</h2>
                <TeamGrid teams={others} onOpen={(id) => navigate(`/teams/${id}`)} />
              </section>
            )}
          </div>
        )}
      </main>

      <TeamFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        people={people}
        onSubmit={async (values) => {
          const created = await createTeam({ ...values, description: values.description ?? undefined });
          return !!created;
        }}
      />
    </div>
  );
};

const TeamGrid = ({ teams, onOpen }: { teams: TeamSummary[]; onOpen: (id: string) => void }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
    {teams.map((t) => (
      <button
        key={t.id}
        onClick={() => onOpen(t.id)}
        className="group text-left bg-background border border-border hover:border-primary transition-colors"
        style={{ borderLeft: `4px solid ${t.color ?? "var(--border)"}` }}
      >
        <div className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base truncate group-hover:text-primary transition-colors">{t.name}</h3>
            <RoleBadge role={t.myRole === "lead" ? "lead" : null} />
          </div>
          {t.description && <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
        </div>
        <div className="border-t border-border px-4 py-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <AvatarStack people={t.leads} max={3} />
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <UsersRound className="h-3 w-3" />
              {t.memberCount}
            </span>
            <span className="flex items-center gap-1">
              <FolderKanban className="h-3 w-3" />
              {t.projectCount}
            </span>
          </span>
        </div>
      </button>
    ))}
  </div>
);

export default Teams;
