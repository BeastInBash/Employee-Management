import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate, useOutlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  CalendarCheck,
  Check,
  ChevronsUpDown,
  FolderKanban,
  KeyRound,
  LayoutGrid,
  ListChecks,
  LogOut,
  Menu,
  Moon,
  Sun,
  UsersRound,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { useTheme } from "@/components/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { Leaf } from "./Leaf";
import { VerifyEmailBanner } from "./VerifyEmailBanner";

type NavItem = { to: string; label: string; icon: typeof LayoutGrid; match?: (path: string) => boolean };

function useNavItems(): NavItem[] {
  const { user } = useAuth();
  if (!user) return [];
  const isAdmin = user.role === "admin";
  return [
    isAdmin
      ? { to: "/dashboard", label: "Members", icon: LayoutGrid, match: (p) => p === "/dashboard" || p.startsWith("/member/") || p.startsWith("/dashboard/") }
      : { to: `/todos/${user.id}`, label: "My tasks", icon: ListChecks, match: (p) => p.startsWith("/todos/") },
    { to: "/projects", label: "Projects", icon: FolderKanban, match: (p) => p.startsWith("/projects") },
    { to: "/teams", label: "Teams", icon: UsersRound, match: (p) => p.startsWith("/teams") },
    {
      to: isAdmin ? "/admin/attendance" : "/attendance",
      label: "Attendance",
      icon: CalendarCheck,
      match: (p) => p === "/attendance" || p === "/admin/attendance",
    },
    { to: "/reports", label: "Reports", icon: BarChart3, match: (p) => p.startsWith("/reports") },
  ];
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

/** Org → workspace switcher. Admins only; members belong to whatever they were added to. */
const WorkspaceSwitcher = () => {
  const { organizations, activeOrg, activeWorkspace, setActiveOrgId, setActiveWorkspaceId } = useOrg();
  if (organizations.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-sidebar-ring">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary/12 text-sm font-semibold text-sidebar-foreground ring-1 ring-sidebar-border">
          {initials(activeWorkspace?.name ?? activeOrg?.name ?? "?")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-white/95">{activeWorkspace?.name ?? "Choose a workspace"}</span>
          <span className="block truncate text-xs text-sidebar-foreground/60">{activeOrg?.name}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-foreground/50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {organizations.map((org, i) => (
          <div key={org.id}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{org.name}</DropdownMenuLabel>
            {org.workspaces.length === 0 && <div className="px-2 pb-2 text-xs text-muted-foreground">No workspaces yet</div>}
            {org.workspaces.map((ws) => (
              <DropdownMenuItem
                key={ws.id}
                onClick={() => {
                  setActiveOrgId(org.id);
                  setActiveWorkspaceId(ws.id);
                }}
              >
                <span className="flex-1 truncate">{ws.name}</span>
                {ws.id === activeWorkspace?.id && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const NavList = ({ onNavigate }: { onNavigate?: () => void }) => {
  const items = useNavItems();
  const { pathname } = useLocation();
  return (
    <nav className="space-y-0.5" aria-label="Main">
      {items.map(({ to, label, icon: Icon, match }) => {
        const active = match ? match(pathname) : pathname === to;
        return (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none transition-colors duration-150",
              "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              active ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/75 hover:text-white hover:bg-sidebar-accent"
            )}
          >
            {/* The signature motion: one indicator glides between items. */}
            {active && (
              <motion.span
                layoutId="nav-active"
                className="absolute inset-0 rounded-lg bg-sidebar-primary"
                transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
              />
            )}
            <Icon className="relative h-4 w-4 shrink-0" />
            <span className="relative font-medium">{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};

const AccountMenu = () => {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [pwOpen, setPwOpen] = useState(false);
  if (!user) return null;
  const isDark = theme === "dark";
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-sidebar-ring">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
            {initials(user.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-white/95">{user.name}</span>
            <span className="block truncate text-xs text-sidebar-foreground/60">{user.role === "admin" ? "Admin" : "Member"}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-foreground/50" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-60">
          <DropdownMenuLabel className="font-normal">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setTheme(isDark ? "light" : "dark")}>
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {isDark ? "Light theme" : "Dark theme"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPwOpen(true)}>
            <KeyRound className="h-4 w-4" />
            Change password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              logout();
              navigate("/");
            }}
          >
            <LogOut className="h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    </>
  );
};

const SidebarBody = ({ onNavigate }: { onNavigate?: () => void }) => {
  const { user } = useAuth();
  return (
    <div className="flex h-full flex-col gap-6 px-3 py-5">
      <div className="flex items-center gap-2 px-2.5">
        <Leaf className="h-5 w-5 text-sidebar-primary" />
        <span className="text-[17px] font-semibold tracking-tight text-white">Crewly</span>
      </div>
      {user?.role === "admin" && <WorkspaceSwitcher />}
      <NavList {...(onNavigate && { onNavigate })} />
      <div className="mt-auto">
        <AccountMenu />
      </div>
    </div>
  );
};

/**
 * Captures the route element on mount, so a page that is fading out keeps
 * showing itself instead of re-rendering as the page being navigated to.
 */
const FrozenOutlet = () => {
  const outlet = useOutlet();
  const [frozen] = useState(outlet);
  return frozen;
};

/**
 * The signed-in frame: a fixed forest sidebar on desktop, a top bar with a
 * slide-in drawer on smaller screens, and a short fade-and-lift between pages.
 */
export const AppShell = () => {
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Each page starts at the top.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  // Group sub-routes so switching tabs inside a page doesn't replay the transition.
  const pageKey = pathname.split("/").slice(0, 3).join("/");

  return (
    <div className="min-h-screen bg-background lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-sidebar lg:block">
        <SidebarBody />
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur-md lg:hidden">
        <button
          onClick={() => setDrawerOpen(true)}
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-sm hover:bg-accent"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="flex items-center gap-2 font-semibold tracking-tight">
          <Leaf className="h-4 w-4 text-primary" />
          Crewly
        </span>
      </header>
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="left"
          aria-describedby={undefined}
          className="w-72 border-none bg-sidebar p-0 [&>button]:text-sidebar-foreground"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBody onNavigate={() => setDrawerOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-8 sm:py-10">
        <VerifyEmailBanner />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pageKey}
            initial={{ opacity: 0, transform: "translateY(6px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)", transition: { duration: 0.22, ease: [0.23, 1, 0.32, 1] } }}
            exit={{ opacity: 0, transition: { duration: 0.1, ease: "easeOut" } }}
          >
            <FrozenOutlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};
