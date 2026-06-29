import { useState } from "react";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useMembers } from "@/contexts/MemberContext";
import { useOrg } from "@/contexts/OrgContext";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import {
    PlusCircle,
    LogOut,
    Users,
    KeyRound,
    Trash2,
    Loader2,
    Building2,
    Layers,
    Plus,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-provider";
import { toast } from "@/components/ui/sonner";
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

// Subtle, once-only entrance motion (per the project's animation conventions).
const fadeUp: Variants = {
    hidden: { opacity: 0, y: 12 },
    show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
    },
};

const stagger: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.06 } },
};

const Dashboard = () => {
    const { user, logout, changePassword } = useAuth();
    const { getUserMembers, addMember, deleteMember } = useMembers();
    const {
        organizations,
        activeOrg,
        workspaces,
        activeWorkspace,
        isLoading: isOrgLoading,
        setActiveOrgId,
        setActiveWorkspaceId,
        createOrganization,
        createWorkspace,
    } = useOrg();
    const navigate = useNavigate();

    // Per-action loading state so buttons can show spinners and stay disabled
    // while a request is in flight.
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [isDeletingMember, setIsDeletingMember] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [isCreatingOrg, setIsCreatingOrg] = useState(false);
    const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
    const [isOrgDialogOpen, setIsOrgDialogOpen] = useState(false);
    const [isWorkspaceDialogOpen, setIsWorkspaceDialogOpen] = useState(false);

    const [memberName, setMemberName] = useState("");
    const [memberEmail, setMemberEmail] = useState("");
    const [memberRole, setMemberRole] = useState("");
    const [memberWorkspaceId, setMemberWorkspaceId] = useState("");

    const [orgName, setOrgName] = useState("");
    const [workspaceName, setWorkspaceName] = useState("");

    // delete dialog state
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [memberToDeleteId, setMemberToDeleteId] = useState<string | null>(null);
    const [memberToDeleteName, setMemberToDeleteName] = useState<string | null>(
        null
    );

    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const isAdmin = user?.role === "admin";

    // Members the current user can see, scoped to the active workspace for admins.
    const allUserMembers = user ? getUserMembers(user.id) : [];
    const userMembers =
        isAdmin && activeWorkspace
            ? allUserMembers.filter((m) => m.workspaceId === activeWorkspace.id)
            : allUserMembers;

    // Org/workspace onboarding gates (admin only).
    const needsOrg = isAdmin && !isOrgLoading && organizations.length === 0;
    const needsWorkspace =
        isAdmin && organizations.length > 0 && workspaces.length === 0;

    const handleAddMember = async () => {
        if (!user) return;

        const targetWorkspaceId = memberWorkspaceId || activeWorkspace?.id;
        if (!targetWorkspaceId) {
            toast.error("Create or select a workspace first");
            return;
        }

        setIsAddingMember(true);
        try {
            const created = await addMember({
                name: memberName,
                email: memberEmail,
                role: memberRole,
                workspaceId: targetWorkspaceId,
                createdById: user.id,
            });

            // addMember already inserts the new member into local state, so there's
            // no need for a full (slow) refetch — just close/reset the form.
            if (created) {
                setMemberName("");
                setMemberEmail("");
                setMemberRole("");
                setMemberWorkspaceId("");
                setIsDialogOpen(false);
            }
        } finally {
            setIsAddingMember(false);
        }
    };

    const handleCreateOrg = async () => {
        if (orgName.trim().length < 2) {
            toast.error("Organization name must be at least 2 characters");
            return;
        }
        setIsCreatingOrg(true);
        try {
            const created = await createOrganization(orgName.trim());
            if (created) {
                setOrgName("");
                setIsOrgDialogOpen(false);
            }
        } finally {
            setIsCreatingOrg(false);
        }
    };

    const handleCreateWorkspace = async () => {
        if (workspaceName.trim().length < 2) {
            toast.error("Workspace name must be at least 2 characters");
            return;
        }
        setIsCreatingWorkspace(true);
        try {
            const created = await createWorkspace(workspaceName.trim());
            if (created) {
                setWorkspaceName("");
                setIsWorkspaceDialogOpen(false);
            }
        } finally {
            setIsCreatingWorkspace(false);
        }
    };

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        if (newPassword.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }

        setIsChangingPassword(true);
        try {
            const success = await changePassword(oldPassword, newPassword);

            if (success) {
                setOldPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setIsPasswordDialogOpen(false);
            }
        } finally {
            setIsChangingPassword(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    if (!user) {
        navigate("/");
        return null;
    }

    return (
        <div className="min-h-screen bg-muted/40">
            <header className="bg-background border-b border-border sticky top-0 z-10">
                <div className="container mx-auto px-4 py-4 flex flex-wrap justify-between items-center gap-y-3 gap-x-4">
                    <div className="flex items-center gap-2">
                        <Users className="h-6 w-6 text-primary" />
                        <h1 className="text-xl sm:text-2xl font-bold text-primary">
                            Crewly
                        </h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                        {isAdmin && (
                            <Button
                                size="sm"
                                onClick={() => navigate("/admin/attendance")}
                            >
                                Attendance Panel
                            </Button>
                        )}
                        <ThemeToggle />
                        <span className="hidden sm:inline text-sm text-muted-foreground">
                            Hello, {user.name} ({user.role === "admin" ? "Admin" : "Member"})
                        </span>
                        {user.role === "member" && (
                            <Dialog
                                open={isPasswordDialogOpen}
                                onOpenChange={setIsPasswordDialogOpen}
                            >
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="gap-2">
                                        <KeyRound className="h-4 w-4" />
                                        Change Password
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Change Your Password</DialogTitle>
                                        <DialogDescription>
                                            Update your password to keep your account secure.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="oldPassword">Current Password</Label>
                                            <Input
                                                id="oldPassword"
                                                type="password"
                                                value={oldPassword}
                                                onChange={(e) => setOldPassword(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="newPassword">New Password</Label>
                                            <Input
                                                id="newPassword"
                                                type="password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="confirmPassword">
                                                Confirm New Password
                                            </Label>
                                            <Input
                                                id="confirmPassword"
                                                type="password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            variant="outline"
                                            onClick={() => setIsPasswordDialogOpen(false)}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={handleChangePassword}
                                            disabled={
                                                !oldPassword ||
                                                !newPassword ||
                                                !confirmPassword ||
                                                isChangingPassword
                                            }
                                        >
                                            {isChangingPassword && (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            )}
                                            Change Password
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}
                        <Button variant="ghost" size="icon" onClick={handleLogout}>
                            <LogOut className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </header>

            {/* Org / workspace toolbar (admin only, once at least one org exists) */}
            {isAdmin && organizations.length > 0 && (
                <div className="bg-background/60 border-b border-border">
                    <div className="container mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            <Select
                                value={activeOrg?.id ?? ""}
                                onValueChange={setActiveOrgId}
                            >
                                <SelectTrigger className="w-[160px] sm:w-[200px]">
                                    <SelectValue placeholder="Organization" />
                                </SelectTrigger>
                                <SelectContent>
                                    {organizations.map((org) => (
                                        <SelectItem key={org.id} value={org.id}>
                                            {org.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                            <Select
                                value={activeWorkspace?.id ?? ""}
                                onValueChange={setActiveWorkspaceId}
                                disabled={workspaces.length === 0}
                            >
                                <SelectTrigger className="w-[160px] sm:w-[200px]">
                                    <SelectValue placeholder="Workspace" />
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

                        <div className="flex items-center gap-2 sm:ml-auto">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => setIsWorkspaceDialogOpen(true)}
                            >
                                <Plus className="h-4 w-4" />
                                New Workspace
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => setIsOrgDialogOpen(true)}
                            >
                                <Building2 className="h-4 w-4" />
                                New Org
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <main className="container mx-auto px-4 py-8">
                {needsOrg ? (
                    <motion.div
                        variants={fadeUp}
                        initial="hidden"
                        animate="show"
                        className="text-center py-16"
                    >
                        <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-xl font-medium mb-2">
                            Create your first organization
                        </h3>
                        <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                            Organizations hold your workspaces. Create one to start adding
                            workspaces and team members.
                        </p>
                        <Button className="gap-2" onClick={() => setIsOrgDialogOpen(true)}>
                            <Building2 className="h-4 w-4" />
                            New Organization
                        </Button>
                    </motion.div>
                ) : needsWorkspace ? (
                    <motion.div
                        variants={fadeUp}
                        initial="hidden"
                        animate="show"
                        className="text-center py-16"
                    >
                        <Layers className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-xl font-medium mb-2">
                            Create your first workspace
                        </h3>
                        <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                            Workspaces in{" "}
                            <span className="font-medium text-foreground">
                                {activeOrg?.name}
                            </span>{" "}
                            group team members and their tasks. Create one to add members.
                        </p>
                        <Button
                            className="gap-2"
                            onClick={() => setIsWorkspaceDialogOpen(true)}
                        >
                            <Plus className="h-4 w-4" />
                            New Workspace
                        </Button>
                    </motion.div>
                ) : (
                    <>
                        <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-bold mb-1">
                                    Team Members
                                </h2>
                                <p className="text-muted-foreground">
                                    {isAdmin
                                        ? activeWorkspace
                                            ? `Members in ${activeWorkspace.name}`
                                            : "Manage team members and assign tasks"
                                        : "View your profile and manage your tasks"}
                                </p>
                            </div>

                            {isAdmin && (
                                <Dialog
                                    open={isDialogOpen}
                                    onOpenChange={(open) => {
                                        setIsDialogOpen(open);
                                        if (open)
                                            setMemberWorkspaceId(activeWorkspace?.id ?? "");
                                    }}
                                >
                                    <DialogTrigger asChild>
                                        <Button className="gap-2" disabled={!activeWorkspace}>
                                            <PlusCircle className="h-4 w-4" />
                                            Add Member
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Add a new team member</DialogTitle>
                                            <DialogDescription>
                                                Add the details of your new team member. They will
                                                receive login credentials via email with default
                                                password: 123456
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="name">Full Name</Label>
                                                <Input
                                                    id="name"
                                                    placeholder="Enter member name"
                                                    value={memberName}
                                                    onChange={(e) => setMemberName(e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="email">Email</Label>
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    placeholder="Enter email address"
                                                    value={memberEmail}
                                                    onChange={(e) => setMemberEmail(e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="role">Role</Label>
                                                <Input
                                                    id="role"
                                                    placeholder="e.g., Frontend Developer"
                                                    value={memberRole}
                                                    onChange={(e) => setMemberRole(e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="workspace">Workspace</Label>
                                                <Select
                                                    value={memberWorkspaceId}
                                                    onValueChange={setMemberWorkspaceId}
                                                >
                                                    <SelectTrigger id="workspace">
                                                        <SelectValue placeholder="Select a workspace" />
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
                                        </div>
                                        <DialogFooter>
                                            <Button
                                                variant="outline"
                                                onClick={() => setIsDialogOpen(false)}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                onClick={handleAddMember}
                                                disabled={
                                                    !memberName ||
                                                    !memberEmail ||
                                                    !memberRole ||
                                                    !(memberWorkspaceId || activeWorkspace?.id) ||
                                                    isAddingMember
                                                }
                                            >
                                                {isAddingMember && (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                )}
                                                {isAddingMember ? "Adding..." : "Add Member"}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>

                        {userMembers.length === 0 ? (
                            <div className="text-center py-12">
                                <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                                <h3 className="text-xl font-medium mb-2">
                                    No team members yet
                                </h3>
                                <p className="text-muted-foreground mb-4">
                                    {isAdmin
                                        ? "Add your first team member to get started"
                                        : "You have no members in this view"}
                                </p>
                                {isAdmin && (
                                    <Button
                                        disabled={!activeWorkspace}
                                        onClick={() => {
                                            setMemberWorkspaceId(activeWorkspace?.id ?? "");
                                            setIsDialogOpen(true);
                                        }}
                                    >
                                        Add Member
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <motion.div
                                variants={stagger}
                                initial="hidden"
                                animate="show"
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                            >
                                {userMembers.map((member) => (
                                    <motion.div key={member.id} variants={fadeUp}>
                                        <Card
                                            className="cursor-pointer hover:shadow-md transition-shadow h-full"
                                            onClick={() => navigate(`/member/${member.userId}`)}
                                        >
                                            <CardHeader>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <CardTitle>{member.user?.name}</CardTitle>
                                                        <CardDescription>{member.role}</CardDescription>
                                                    </div>
                                                    {isAdmin && (
                                                        <div className="flex justify-end mb-2">
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setMemberToDeleteId(member.id);
                                                                    setMemberToDeleteName(
                                                                        member.user?.name || member.email
                                                                    );
                                                                    setIsDeleteDialogOpen(true);
                                                                }}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                <p className="text-sm text-muted-foreground mb-2">
                                                    {member.email}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Added on {member.createdAt.toLocaleDateString()}
                                                </p>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                ))}
                            </motion.div>
                        )}
                    </>
                )}
            </main>

            {/* Create organization dialog */}
            <Dialog open={isOrgDialogOpen} onOpenChange={setIsOrgDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create organization</DialogTitle>
                        <DialogDescription>
                            An organization is the top-level container for your workspaces and
                            members.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="orgName">Organization name</Label>
                            <Input
                                id="orgName"
                                placeholder="e.g., Acme Inc."
                                value={orgName}
                                onChange={(e) => setOrgName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleCreateOrg();
                                }}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsOrgDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateOrg}
                            disabled={orgName.trim().length < 2 || isCreatingOrg}
                        >
                            {isCreatingOrg && (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            )}
                            {isCreatingOrg ? "Creating..." : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create workspace dialog */}
            <Dialog
                open={isWorkspaceDialogOpen}
                onOpenChange={setIsWorkspaceDialogOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create workspace</DialogTitle>
                        <DialogDescription>
                            Add a workspace to{" "}
                            <span className="font-medium text-foreground">
                                {activeOrg?.name ?? "your organization"}
                            </span>
                            . Members and their tasks live inside a workspace.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="workspaceName">Workspace name</Label>
                            <Input
                                id="workspaceName"
                                placeholder="e.g., Engineering"
                                value={workspaceName}
                                onChange={(e) => setWorkspaceName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleCreateWorkspace();
                                }}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsWorkspaceDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateWorkspace}
                            disabled={workspaceName.trim().length < 2 || isCreatingWorkspace}
                        >
                            {isCreatingWorkspace && (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            )}
                            {isCreatingWorkspace ? "Creating..." : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete member confirmation dialog */}
            <AlertDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the member {memberToDeleteName ?? ""}
                            . This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeletingMember}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={isDeletingMember}
                            onClick={async (e) => {
                                // Prevent Radix from auto-closing so we can show the
                                // spinner until the request actually resolves.
                                e.preventDefault();
                                if (!memberToDeleteId) return;
                                setIsDeletingMember(true);
                                try {
                                    // deleteMember removes the row from local state on
                                    // success, so no refetch is needed.
                                    const ok = await deleteMember(memberToDeleteId);
                                    if (ok) {
                                        setIsDeleteDialogOpen(false);
                                        setMemberToDeleteId(null);
                                        setMemberToDeleteName(null);
                                    }
                                } finally {
                                    setIsDeletingMember(false);
                                }
                            }}
                            className="bg-destructive"
                        >
                            {isDeletingMember && (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            )}
                            {isDeletingMember ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default Dashboard;
