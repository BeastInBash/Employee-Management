import { lazyPage } from "./lazy";

// Every route's page, split into its own chunk and loaded on first use. Keep
// this the only place pages are imported, so none of them end up in the main
// bundle by accident.
export const pages = {
  Landing: lazyPage(() => import("@/pages/Landing")),
  Login: lazyPage(() => import("@/pages/Login")),
  ForgotPassword: lazyPage(() => import("@/pages/ForgotPassword")),
  ResetPassword: lazyPage(() => import("@/pages/ResetPassword")),
  AuthCallback: lazyPage(() => import("@/pages/AuthCallback")),
  VerifyEmail: lazyPage(() => import("@/pages/VerifyEmail")),
  NotFound: lazyPage(() => import("@/pages/NotFound")),

  Home: lazyPage(() => import("@/pages/Home")),
  Dashboard: lazyPage(() => import("@/pages/Dashboard")),
  MemberDetail: lazyPage(() => import("@/pages/MemberDetail")),
  TaskDetails: lazyPage(() => import("@/pages/TaskDetails")),
  Attendance: lazyPage(() => import("@/pages/MembersDashboard")),
  AdminAttendance: lazyPage(() => import("@/pages/AdminPanel")),
  Projects: lazyPage(() => import("@/pages/Projects")),
  ProjectDetail: lazyPage(() => import("@/pages/ProjectDetail")),
  Teams: lazyPage(() => import("@/pages/Teams")),
  TeamDetail: lazyPage(() => import("@/pages/TeamDetail")),
  Reports: lazyPage(() => import("@/pages/Reports")),
};

// Which page a sidebar path opens, so hovering a link can fetch its code first.
const byPath: [test: (path: string) => boolean, page: keyof typeof pages][] = [
  [(p) => p === "/home", "Home"],
  [(p) => p === "/dashboard", "Dashboard"],
  [(p) => p.startsWith("/todos/"), "TaskDetails"],
  [(p) => p === "/attendance", "Attendance"],
  [(p) => p === "/admin/attendance", "AdminAttendance"],
  [(p) => p === "/projects", "Projects"],
  [(p) => p.startsWith("/projects/"), "ProjectDetail"],
  [(p) => p === "/teams", "Teams"],
  [(p) => p.startsWith("/teams/"), "TeamDetail"],
  [(p) => p === "/reports", "Reports"],
  [(p) => p.startsWith("/member/"), "MemberDetail"],
  [(p) => p === "/login", "Login"],
];

/** Start loading the code for whatever page `path` opens (no-op if unknown or already loaded). */
export function preloadPath(path: string): void {
  const match = byPath.find(([test]) => test(path));
  if (match) pages[match[1]].preload().catch(() => {});
}
