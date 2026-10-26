import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, Loader2, Plus, UsersRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { useProjects } from "@/contexts/ProjectContext";
import type { TeamSummary } from "@/contexts/ProjectContext";
import { PageHeader, Section } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { AvatarStack, EmptyState, RoleBadge } from "@/components/projects/shared";
import { useWorkspacePeople } from "@/hooks/use-workspace-people";
import { TeamFormDialog } from "@/components/projects/TeamFormDialog";
import { Reveal } from "@/components/layout/Reveal";

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
    <>
      <PageHeader
        title="Teams"
        description={
          isAdmin
            ? "Group the people who work together, give each group a lead, and assign whole teams to projects."
            : "The teams you're part of."
        }
        actions={
          isAdmin && (
            <Button onClick={() => setIsCreateOpen(true)} disabled={noWorkspace}>
              <Plus className="h-4 w-4" />
              New team
            </Button>
          )
        }
      />

      {(isLoading || (isAdmin && orgsLoading)) && teams.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : noWorkspace ? (
        <EmptyState
          title="Choose a workspace first"
          body="Teams live inside a workspace. Create one on the Members page, or pick one from the switcher in the sidebar."
          action={<Button onClick={() => navigate("/dashboard")}>Go to Members</Button>}
        />
      ) : teams.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No teams yet"
          body={
            isAdmin
              ? "Start with the groups you already have, like Design or Sales, and choose who leads each one."
              : "Teams you're added to will appear here."
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
            <Section title="Other teams in your workspace">
              <TeamGrid teams={others} onOpen={(id) => navigate(`/teams/${id}`)} />
            </Section>
          )}
        </div>
      )}

      <TeamFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        people={people}
        onSubmit={async (values) => {
          const created = await createTeam({ ...values, description: values.description ?? undefined });
          return !!created;
        }}
      />
    </>
  );
};

const TeamGrid = ({ teams, onOpen }: { teams: TeamSummary[]; onOpen: (id: string) => void }) => (
  <Reveal className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {teams.map((t) => (
      <button
        key={t.id}
        onClick={() => onOpen(t.id)}
        className="group flex flex-col rounded-xl border border-border/80 bg-card p-5 text-left transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-[0_8px_24px_-16px_rgb(78_34_15/0.35)] focus-visible:outline-2 focus-visible:outline-ring active:scale-[0.99]"
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: t.color ?? "var(--primary)" }}
            />
            <h3 className="truncate text-[15px]">{t.name}</h3>
          </span>
          <RoleBadge role={t.myRole === "lead" ? "lead" : null} />
        </div>
        <p className="mb-5 line-clamp-2 min-h-10 text-sm text-muted-foreground">
          {t.description || "No description yet."}
        </p>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/70 pt-4 text-xs text-muted-foreground">
          <AvatarStack people={t.leads} max={3} />
          <span className="flex items-center gap-4">
            <span className="flex items-center gap-1.5" title="People">
              <UsersRound className="h-3.5 w-3.5" />
              {t.memberCount} {t.memberCount === 1 ? "person" : "people"}
            </span>
            <span className="flex items-center gap-1.5" title="Projects">
              <FolderKanban className="h-3.5 w-3.5" />
              {t.projectCount} {t.projectCount === 1 ? "project" : "projects"}
            </span>
          </span>
        </div>
      </button>
    ))}
  </Reveal>
);

export default Teams;
