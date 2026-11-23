import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Building2,
  Clock,
  Layers,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMembers } from "@/contexts/MemberContext";
import type { Member } from "@/contexts/MemberContext";
import { useOrg } from "@/contexts/OrgContext";
import { PageHeader } from "@/components/layout/Page";
import { EmptyState, PersonAvatar } from "@/components/projects/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const Dashboard = () => {
  const { user } = useAuth();
  const { getUserMembers, addMember, deleteMember } = useMembers();
  const {
    organizations,
    activeOrg,
    workspaces,
    activeWorkspace,
    isLoading: isOrgLoading,
    createOrganization,
    createWorkspace,
    updateTaskWindow,
  } = useOrg();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isOrgDialogOpen, setIsOrgDialogOpen] = useState(false);
  const [isWorkspaceDialogOpen, setIsWorkspaceDialogOpen] = useState(false);
  const [isTaskWindowDialogOpen, setIsTaskWindowDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [isDeletingMember, setIsDeletingMember] = useState(false);

  const isAdmin = user?.role === "admin";

  // Members the current user can see, scoped to the active workspace for admins.
  const allUserMembers = user ? getUserMembers(user.id) : [];
  const userMembers =
    isAdmin && activeWorkspace ? allUserMembers.filter((m) => m.workspaceId === activeWorkspace.id) : allUserMembers;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return userMembers;
    return userMembers.filter((m) => [m.user?.name, m.email, m.role].some((v) => v?.toLowerCase().includes(q)));
  }, [userMembers, query]);

  // Org/workspace onboarding gates (admin only).
  const needsOrg = isAdmin && !isOrgLoading && organizations.length === 0;
  const needsWorkspace = isAdmin && organizations.length > 0 && workspaces.length === 0;

  if (!user) {
    navigate("/");
    return null;
  }

  const taskWindow = activeWorkspace?.taskWindow;

  return (
    <>
      <PageHeader
        title="Members"
        description={
          isAdmin
            ? activeWorkspace
              ? `Everyone in ${activeWorkspace.name}. Select a person to see their tasks, or use the menu on their row for attendance.`
              : "Add the people on your team, then follow their work and attendance."
            : "Your profile and tasks."
        }
        actions={
          isAdmin &&
          !needsOrg &&
          !needsWorkspace && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Settings2 className="h-4 w-4" />
                    Settings
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem disabled={!activeWorkspace} onClick={() => setIsTaskWindowDialogOpen(true)}>
                    <Clock className="h-4 w-4" />
                    <span className="flex-1">When members can add tasks</span>
                    <span className="text-xs text-muted-foreground">
                      {taskWindow?.enabled ? `${taskWindow.startTime}–${taskWindow.endTime}` : "Anytime"}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsWorkspaceDialogOpen(true)}>
                    <Layers className="h-4 w-4" />
                    Add another workspace
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsOrgDialogOpen(true)}>
                    <Building2 className="h-4 w-4" />
                    Add another organization
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={() => setIsAddOpen(true)} disabled={!activeWorkspace}>
                <UserPlus className="h-4 w-4" />
                Add member
              </Button>
            </>
          )
        }
      />

      {isAdmin && isOrgLoading && organizations.length === 0 ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : needsOrg ? (
        <EmptyState
          icon={Building2}
          title="Create your organization"
          body="This is your company or business. Inside it you'll create a workspace for your team (one per office or department if you have several). Start by naming it."
          action={
            <Button onClick={() => setIsOrgDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Create organization
            </Button>
          }
        />
      ) : needsWorkspace ? (
        <EmptyState
          icon={Layers}
          title={`Add a workspace to ${activeOrg?.name ?? "your organization"}`}
          body="A workspace is where your people, projects and teams live. Most small businesses need just one, named after the team or location."
          action={
            <Button onClick={() => setIsWorkspaceDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Create workspace
            </Button>
          }
        />
      ) : userMembers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members yet"
          body={
            isAdmin
              ? "Add your first teammate. They'll get an email with a link to choose their password, or can sign in with Google."
              : "There's no one to show here yet."
          }
          action={
            isAdmin && (
              <Button onClick={() => setIsAddOpen(true)} disabled={!activeWorkspace}>
                <UserPlus className="h-4 w-4" />
                Add member
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, email or job title"
                className="bg-card pl-9"
              />
            </div>
            <span className="hidden text-sm text-muted-foreground sm:block">
              {userMembers.length} {userMembers.length === 1 ? "member" : "members"}
            </span>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-card/60 px-4 py-10 text-center text-sm text-muted-foreground">
              No one matches “{query}”.
            </p>
          ) : (
            <motion.ul
              className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/80 bg-card"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.03 } } }}
            >
              {visible.map((member) => (
                <motion.li
                  key={member.id}
                  variants={{
                    hidden: { opacity: 0 },
                    show: { opacity: 1, transition: { duration: 0.2 } },
                  }}
                  className="group relative flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-accent/50 sm:px-5"
                >
                  <PersonAvatar person={{ name: member.user?.name ?? member.email }} className="h-9 w-9 text-xs" />
                  <button
                    onClick={() => navigate(`/member/${member.userId}`)}
                    className="min-w-0 flex-1 text-left after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
                  >
                    <span className="block truncate text-[15px] font-medium">{member.user?.name ?? member.email}</span>
                    <span className="block truncate text-sm text-muted-foreground">{member.role}</span>
                  </button>
                  <span className="hidden min-w-0 flex-1 truncate text-sm text-muted-foreground md:block">
                    {member.email}
                  </span>
                  <span className="hidden w-32 shrink-0 text-right text-sm text-muted-foreground lg:block">
                    Added {member.createdAt.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                  </span>
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="relative z-10 shrink-0"
                          aria-label={`Actions for ${member.user?.name ?? member.email}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/member/${member.userId}`)}>
                          View tasks
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/dashboard/member/${member.userId}/attendance`)}>
                          View attendance
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setMemberToDelete(member)}>
                          <Trash2 className="h-4 w-4" />
                          Remove member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </motion.li>
              ))}
            </motion.ul>
          )}
        </>
      )}

      <AddMemberDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        defaultWorkspaceId={activeWorkspace?.id ?? ""}
        workspaces={workspaces}
        onSubmit={async (values) => !!(await addMember({ ...values, createdById: user.id }))}
      />

      <TaskWindowDialog
        key={`${activeWorkspace?.id}-${isTaskWindowDialogOpen}`}
        open={isTaskWindowDialogOpen}
        onOpenChange={setIsTaskWindowDialogOpen}
        workspaceName={activeWorkspace?.name ?? ""}
        initial={activeWorkspace?.taskWindow ?? { enabled: false, startTime: "09:00", endTime: "11:00" }}
        onSave={async (w) => (activeWorkspace ? !!(await updateTaskWindow(activeWorkspace.id, w)) : false)}
      />

      <NameDialog
        open={isOrgDialogOpen}
        onOpenChange={setIsOrgDialogOpen}
        title="Create organization"
        description="The top level of your account. It holds your workspaces."
        label="Organization name"
        placeholder="Acme Studio"
        submitLabel="Create organization"
        onSubmit={async (name) => !!(await createOrganization(name))}
      />

      <NameDialog
        open={isWorkspaceDialogOpen}
        onOpenChange={setIsWorkspaceDialogOpen}
        title="Create workspace"
        description={`A new workspace in ${activeOrg?.name ?? "your organization"}. People, projects and teams live inside it.`}
        label="Workspace name"
        placeholder="Design team"
        submitLabel="Create workspace"
        onSubmit={async (name) => !!(await createWorkspace(name))}
      />

      <AlertDialog open={!!memberToDelete} onOpenChange={(o) => !o && setMemberToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {memberToDelete?.user?.name ?? "this member"}?</AlertDialogTitle>
            <AlertDialogDescription>
              They'll lose access to {activeWorkspace?.name ?? "this workspace"}, and their tasks and attendance history
              here are deleted. This can't be undone. Their Workzen account itself stays, so you can add them again
              later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingMember}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingMember}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async (e) => {
                // Keep the dialog open until the request resolves.
                e.preventDefault();
                if (!memberToDelete) return;
                setIsDeletingMember(true);
                try {
                  if (await deleteMember(memberToDelete.id)) setMemberToDelete(null);
                } finally {
                  setIsDeletingMember(false);
                }
              }}
            >
              {isDeletingMember && <Loader2 className="h-4 w-4 animate-spin" />}
              Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// ─── dialogs ────────────────────────────────────────────────────────────────

const AddMemberDialog = ({
  open,
  onOpenChange,
  defaultWorkspaceId,
  workspaces,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultWorkspaceId: string;
  workspaces: { id: string; name: string }[];
  onSubmit: (v: { name: string; email: string; role: string; workspaceId: string }) => Promise<boolean>;
}) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const reset = (o: boolean) => {
    if (o) {
      setName("");
      setEmail("");
      setRole("");
      setWorkspaceId(defaultWorkspaceId);
    }
    onOpenChange(o);
  };

  const target = workspaceId || defaultWorkspaceId;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return void toast.error("Create or choose a workspace first");
    setIsSaving(true);
    try {
      if (await onSubmit({ name, email, role, workspaceId: target })) onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Add a member</DialogTitle>
            <DialogDescription>
              They'll appear in your list straight away, and we'll email them a link to choose their password (or they
              can sign in with Google using this email). After that, they plan their day in Workzen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="member-name">Full name</Label>
              <Input
                id="member-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Priya Shah"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-email">Work email</Label>
              <Input
                id="member-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="priya@company.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-role">Job title</Label>
              <Input
                id="member-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Designer"
                required
              />
            </div>
            {workspaces.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="member-workspace">Workspace</Label>
                <Select value={target} onValueChange={setWorkspaceId}>
                  <SelectTrigger id="member-workspace" className="w-full">
                    <SelectValue placeholder="Choose a workspace" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((ws) => (
                      <SelectItem key={ws.id} value={ws.id}>
                        {ws.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name || !email || role.trim().length < 2 || isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Add member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const TaskWindowDialog = ({
  open,
  onOpenChange,
  workspaceName,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  workspaceName: string;
  initial: { enabled: boolean; startTime: string; endTime: string };
  onSave: (w: { enabled: boolean; startTime: string; endTime: string }) => Promise<boolean>;
}) => {
  // Remounted (via key) each time it opens, so this seeds from what's saved.
  const [enabled, setEnabled] = useState(initial.enabled);
  const [start, setStart] = useState(initial.startTime);
  const [end, setEnd] = useState(initial.endTime);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    if (enabled && start === end) return void toast.error("Opening and closing times must differ");
    setIsSaving(true);
    try {
      if (await onSave({ enabled, startTime: start, endTime: end })) onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>When members can add tasks</DialogTitle>
          <DialogDescription>
            By default, people in {workspaceName} can add their own tasks at any time. You can limit that to set hours,
            for example to make sure plans are in by mid-morning. Times are India time (IST).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-4 rounded-lg bg-surface p-4 ring-1 ring-border/70">
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">Only during set hours</span>
              <span className="block text-xs text-muted-foreground">
                {enabled ? "Members can add tasks only inside the hours below." : "Members can add tasks anytime."}
              </span>
            </span>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="window-start">Opens</Label>
              <Input
                id="window-start"
                type="time"
                value={start}
                disabled={!enabled}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="window-end">Closes</Label>
              <Input
                id="window-end"
                type="time"
                value={end}
                disabled={!enabled}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          {enabled && end <= start && (
            <p className="text-xs text-muted-foreground">
              This runs past midnight: open from {start} until {end} the next day.
            </p>
          )}
          {enabled && (
            <p className="rounded-lg bg-honey-soft px-3 py-2 text-xs text-honey">
              Anyone who hasn't added their tasks by closing time can't add them that day, and a day with nothing
              planned counts as absent. Tell your team the hours before turning this on.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Tasks you or a project lead assign to someone are always allowed, whatever the hours.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save hours
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const NameDialog = ({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<boolean>;
}) => {
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return;
    setIsSaving(true);
    try {
      if (await onSubmit(name.trim())) {
        setName("");
        onOpenChange(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`${title}-name`}>{label}</Label>
            <Input
              id={`${title}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={placeholder}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={name.trim().length < 2 || isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default Dashboard;
