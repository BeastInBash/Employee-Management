import { NavLink, useNavigate } from "react-router-dom";
import { BarChart3, FolderKanban, LayoutGrid, ListChecks, LogOut, UsersRound, CalendarCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { ThemeToggle } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared top bar for the projects/teams area: wordmark, primary nav, workspace
 * name (admins), theme toggle and logout. The nav collapses to icons on phones.
 */
export const AppHeader = ({ actions }: { actions?: ReactNode }) => {
  const { user, logout } = useAuth();
  const { activeWorkspace } = useOrg();
  const navigate = useNavigate();
  if (!user) return null;

  const isAdmin = user.role === "admin";
  const links = [
    isAdmin
      ? { to: "/dashboard", label: "Members", icon: LayoutGrid }
      : { to: `/todos/${user.id}`, label: "My tasks", icon: ListChecks },
    { to: "/projects", label: "Projects", icon: FolderKanban },
    { to: "/teams", label: "Teams", icon: UsersRound },
    { to: isAdmin ? "/admin/attendance" : "/attendance", label: "Attendance", icon: CalendarCheck },
    { to: "/reports", label: "Reports", icon: BarChart3 },
  ];

  return (
    <header className="bg-background border-b border-border sticky top-0 z-20">
      <div className="container mx-auto px-4 h-14 flex items-center gap-4">
        <button onClick={() => navigate(links[0]!.to)} className="font-display text-lg text-primary shrink-0">
          Crewly
        </button>
        {isAdmin && activeWorkspace && (
          <span className="hidden md:inline text-xs text-muted-foreground border-l border-border pl-4 truncate max-w-40">
            {activeWorkspace.name}
          </span>
        )}
        <nav className="flex items-center gap-1 overflow-x-auto">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-2 sm:px-3 h-9 text-sm border-b-2 transition-colors",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )
              }
              title={label}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          {actions}
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Log out"
            onClick={() => {
              logout();
              navigate("/");
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};
