# CLAUDE.md

Guidance for working in this repository (the **client** of the Workzen app).

## What this app is

**Workzen** (formerly "Task Tracker", then "Crewly" — the UI was rebranded; the repo/dirs are still
`todo-app`, and the backend still calls itself Task Tracker) is a team task & attendance
management web app. Two roles:

- **Admin** — manages organizations & workspaces, adds team members into a workspace,
  assigns and tracks tasks, and reviews attendance across the team.
- **Member** — views/updates their own tasks and their own attendance, and can change their password.

The backend is a separate service reached over REST at `import.meta.env.VITE_API_URL`. This repo is the frontend only.

## Stack

- **React 19** + **TypeScript** + **Vite 7** (`@vitejs/plugin-react`).
- **Tailwind CSS v4** via `@tailwindcss/vite` (no `tailwind.config.js` — theme lives in `src/index.css` under `@theme inline` and CSS variables). `tw-animate-css` for animations.
- **shadcn/ui** (`style: new-york`, `baseColor: neutral`, CSS variables) — components in `src/components/ui/`. Icon library is **lucide-react**.
- **react-router-dom v7** for routing.
- **framer-motion** for animation (subtle entrances / scroll reveals).
- State via **React Context** (no Redux / React Query — note the commented-out `@tanstack/react-query` in `App.tsx`).
- Forms: `react-hook-form` + `zod` + `@hookform/resolvers` are available; most current pages use plain controlled inputs.
- Toasts: **sonner** (`@/components/ui/sonner`) is the one in active use; a legacy radix `Toaster` is also mounted.
- **Package manager: Bun** (`bun.lock`). Use `bun install` / `bun run <script>`.

## Commands

```bash
bun install         # install deps
bun run dev         # start Vite dev server
bun run build       # tsc -b && vite build
bun run preview     # preview the production build
bun run lint        # eslint
```

## Project layout

```
src/
  main.tsx                  # entry; mounts <App/> in StrictMode
  App.tsx                   # providers + all routes
  index.css                 # Tailwind v4 import + theme tokens (light + .dark)
  pages/
    Landing.tsx             # public page ("/"), aimed at startups & small businesses: photo
                            #   hero, made-for marquee, before/after, how it works (the demo),
                            #   a day in Workzen (pinned), team board, features bento, setup
                            #   steps, FAQ, closing band, footer with a rising wordmark
    Login.tsx               # sign in / sign up switch (sliding pill, `?tab=signup` kept in
                            #   the URL), Google on both, panels slide on switch  ->  "/login"
    ForgotPassword.tsx / ResetPassword.tsx / AuthCallback.tsx
    VerifyEmail.tsx         # link target from confirmation emails ("/verify-email?token&next")
    Dashboard.tsx           # "Members": searchable member list for the active workspace,
                            #   add/remove member, Workspace menu (submission hours,
                            #   new workspace / organization), onboarding empty states
    Home.tsx                # a member's dashboard ("/home", where members land): bento grid of
                            #   Today (tick to finish; status = the attendance it adds up to),
                            #   month attendance calendar, done this week, overdue, coming up,
                            #   project tasks, your projects, weekly attendance + throughput
                            #   charts — from their tasks + GET /reports?scope=me
    MemberDetail.tsx        # admin view of one member: TaskBoard + assign/edit/delete
    TaskDetails.tsx         # a member's own board ("/todos/:userId") + submission-hours pill
    MembersDashboard.tsx    # monthly attendance calendar ("/attendance", or admin per-member)
    AdminPanel.tsx          # team attendance: Today + By month ("/admin/attendance")
    Projects.tsx            # project grid + filters + "New project"   ("/projects")
    ProjectDetail.tsx       # board by status, People + Teams tabs    ("/projects/:projectId")
    Teams.tsx / TeamDetail.tsx  # team cards; roster w/ today's attendance ("/teams[/:teamId]")
    Reports.tsx             # KPIs, throughput + attendance charts, people table, CSV ("/reports")
    NotFound.tsx
    Index.tsx               # legacy redirect-to-"/" helper (not routed)
  contexts/
    AuthContext.tsx         # login/signup/changePassword/logout; user in localStorage
    OrgContext.tsx          # organizations + workspaces (each carries its taskWindow);
                            #   updateTaskWindow() restricts member submissions;
                            #   tracks the active org/workspace
                            #   (persisted to localStorage, auto-selected/validated).
                            #   createOrganization / createWorkspace / refreshOrgs
    MemberContext.tsx       # team members + tasks CRUD; mutations update local state
                            #   optimistically and RETURN the created/updated entity.
                            #   addMember sends `workspaceId`; Member type carries it
    TaskContext.tsx         # member-facing tasks CRUD; updateTask returns the updated Task;
                            #   taskWindow + refreshTaskWindow gate "Add task"
    ProjectContext.tsx      # project + team lists (admins: active workspace; members: theirs)
                            #   and their create/update/delete; all project/team wire types
  components/
    layout/                 # AppShell (sidebar + page transitions), Page (PageHeader,
                            #   Section, Panel), AuthLayout (split: photo panel with slow
                            #   push-in + rotating captions | form; photo banner on phones),
                            #   ChangePasswordDialog,
                            #   VerifyEmailBanner (soft email-verification reminder)
    tasks/                  # TaskBoard (4 columns, inline status, gliding cards),
                            #   TaskFormDialog (add/edit, mirrors API validation),
                            #   TaskWindowPill (the member's submission hours)
    home/                   # Home dashboard cells: Tile/StatCell/TaskLine, TodayTile,
                            #   AttendanceCalendar (+ legend), WeeklyAttendance (recharts)
    projects/               # shared.tsx (badges, avatars, PeoplePicker, EmptyState),
                            #   ProjectFormDialog, TeamFormDialog, AddPeopleDialog
    reports/ReportCharts.tsx  # StatTile, ThroughputChart, AttendanceChart (recharts)
    ProtectedRoute.tsx      # gates routes; redirects to "/login" when unauthenticated
    theme-provider.tsx      # ThemeProvider, useTheme, ThemeToggle
    ui/                     # shadcn components
  hooks/                    # use-workspace-people.ts loads Member seats for pickers
  lib/                      # utils.ts (cn), api.ts (fetch helper), cache.ts (persistent SWR cache),
                            #   pages.ts + lazy.ts (code-split page registry, preloading),
                            #   tasks.ts (parseTask: API row → Task),
                            #   projectMeta.ts (labels/colours/dates,
                            #   greeting), reports.ts (report types, IST date keys/presets, CSV
                            #   export), home.ts (per-person attendance maths), motion.ts (shared
                            #   ease + grid stagger variants)
```

## Routing (`src/App.tsx`)

Public: `/` (Landing), `/login`, `/forgot-password`, `/reset-password`, `/auth/callback`,
`/verify-email`.
Protected routes sit under `ProtectedRoute` → **`AppShell`** (a layout route that renders the
sidebar and the page via `<Outlet>`), so pages render **content only** — no headers, no
`min-h-screen` wrappers; start with `<PageHeader>`. Protected: `/dashboard`, `/attendance`,
`/dashboard/member/:memberId/attendance`, `/admin/attendance`,
`/member/:memberId`, `/todos/:memberId`, `/projects`, `/projects/:projectId`, `/teams`,
`/teams/:teamId`, `/reports`, `/home`. Everything else → `NotFound`.

After login, admins go to `/dashboard`; members go to `/home` (their dashboard; "My tasks"
at `/todos/:id` is the full board). The
public `/` (Landing) and `/login` pages **redirect an already-authenticated user** to that
same destination (via a `useEffect` on `user`), so reopening the site while logged in drops
you back in the app instead of on the marketing/login page.

## Auth model

- JWT-based. On success the API returns `{ token, user }`; the token is stored in
  `localStorage.authToken` and the user in `localStorage.user`.
- `AuthContext` initializes `user` synchronously from `localStorage` to avoid a flash
  redirect on first render, but only trusts the stored session while the JWT is still
  valid: `readValidSession()` decodes the token's `exp` (no dependency) and, if it has
  expired, clears `authToken`/`user` and returns `null`. So a login persists for the full
  7-day token life and a stale token cleanly forces re-login instead of a broken session.
- Authenticated requests send `Authorization: Bearer <token>`. The backend `authenticate`
  middleware accepts this header (it prefers a `token` cookie but falls back to Bearer), so
  the localStorage-token model works cross-site.
- New members are created by an admin **into a workspace** with no password; their invite
  email opens `/reset-password?token=…&welcome=1`, where `ResetPassword.tsx` shows
  first-password copy ("Choose your password" / "Set password"). Login toasts the server's
  message, which covers "use your invite" and the refused legacy `123456`.
- **Email verification is soft.** `User.emailVerified` comes from login / `GET /auth/me`.
  `AppShell` shows `VerifyEmailBanner` while it's `false` (resend button → `POST
  /auth/resend-verification`, which may answer 429 with a wait time; dismissible for the
  browser session) and refreshes the user once on mount so a confirmation made on another
  device clears it. `/verify-email` posts the token (once — guarded against StrictMode's
  double effect) and calls `AuthContext.refreshUser()` if this browser is signed in.
  Emails are branded **WorkZen** (capital Z) while the app UI says **Workzen**.
  The logo mark is lucide's `Feather`; the favicon is `public/favicon.svg` (cream
  feather on terracotta) with `public/apple-touch-icon.png` for iOS.
- **Google sign-in:** `components/auth/GoogleSignInButton.tsx` sits at the top of both the
  Sign in and Sign up tabs ("Sign in with Google" / "Sign up with Google" via `label`). It
  renders straight away and hides only if `GET /auth/providers` explicitly answers
  `{ google: false }` (a slow or unreachable API never hides it); clicking does a full-page
  `window.location.assign(VITE_API_URL + "/auth/google")`. The API returns to
  **`/auth/callback`** (`pages/AuthCallback.tsx`, public route) with `#token=…`; the page
  strips the fragment, calls `AuthContext.loginWithToken(token)` (stores the token, loads
  `GET /auth/me`) and routes like a normal login. Failures come back as
  `/login?error=google_failed|google_unavailable|email_unverified`, which `Login.tsx` toasts.

## Organizations & workspaces (`OrgContext`)

- Tenancy is **Org → Workspace → Members**. `OrgContext` loads the caller's orgs via
  `GET /org/getMyOrgs?workspace=true` and exposes `organizations`, `activeOrg`,
  `workspaces`, `activeWorkspace`, plus `setActiveOrgId` / `setActiveWorkspaceId`,
  `createOrganization`, `createWorkspace`, `refreshOrgs`.
- The **active org/workspace** are persisted to `localStorage` (`activeOrgId` /
  `activeWorkspaceId`) and auto-selected/validated (fall back to the first available).
- The admin **Dashboard** has an org/workspace switcher + "New Org" / "New Workspace"
  dialogs, onboarding empty-states (create first org → first workspace), and a member grid
  **scoped to the active workspace**. Adding a member requires an active workspace and
  sends its `workspaceId` (the `Member` type carries `workspaceId`).
- Create endpoints: `POST /org/createOrganization` `{ name }`, `POST /org/:orgId/workspaces`
  `{ workspaceName }`.

## Projects & teams

- `ProjectContext` lists projects/teams for the **active workspace** (admins) or everything
  the caller is on (members, no `workspaceId`). Detail pages fetch their own data via
  `api()` and keep it in local state; header stats on `ProjectDetail` are recomputed from
  the local task list so status changes reflect instantly.
- Pages render controls from the API's `permissions` (`canManage`, `canAssignLeads`,
  `canDelete`) and `myRole` — don't re-derive permissions client-side. Seat and assignee
  ids are **Member** ids (from `GET /workspace/:id/members`), not User ids.
- New code calls the API through `lib/api.ts` (`api<T>(path, { method, body, query })`,
  throws `ApiRequestError` with the server message) and keeps non-component exports in
  `lib/` or `hooks/` so `react-refresh/only-export-components` stays clean.
- Task due dates from the project board are saved as **end of day** (`fromDueDateInput`),
  so a task due today isn't overdue until the day is over.
- Tasks carry `project?: { id, name, color }`; `TaskDetails` / `MemberDetail` cards show it
  as a link chip.

## Reports (`/reports`)

- Filters live in one row and in the **URL** (`?scope=project:<id>&range=7d|30d|90d|month|custom
  &from&to&weekends=include`), so a report link is shareable; project/team pages link in
  with `?scope=project:<id>` / `team:<id>`. Scope options come from `ProjectContext`
  (admin → workspace + everything; others → "me" + what they lead).
- Dates are **IST calendar days** (`istToday`, `presetRange`) to match the API.
- Refetching keeps the previous report on screen at reduced opacity (no spinner flash).
- **Chart colours are tokens** in `index.css` (`--viz-completed`, `--viz-created`,
  `--viz-present/partial/absent`), validated with the dataviz palette script against
  `#fcf8ec` / `#1f1b18` (the card surfaces). Terracotta is kept out of charts (it
  collapses into sage for protan viewers). Charts follow the dataviz rules: 2px lines, ≤24px bars with a 2px
  surface gap, legend on every multi-series chart, tooltip with every series, and a
  chart/table toggle (the table view is the accessible fallback). Bars have 4px rounded
  data ends. Re-run the validator if you change these tokens.
- CSV export (`exportMembersCsv` / `exportDailyCsv`) neutralises cells starting with
  `= + - @` so names can't run as spreadsheet formulas.

## Task submission window

- Members can add their own tasks **at any time** by default. Each `Workspace` carries a
  `taskWindow` (`{ enabled, startTime, endTime }`, "HH:mm" IST) that an admin can switch on
  from the Members page's **Workspace → Task submission hours** dialog,
  which calls `OrgContext.updateTaskWindow(workspaceId, window)` →
  `PATCH /workspace/:id/task-window`. Omitting the times keeps the stored hours; a window
  whose end is ≤ its start wraps past midnight.
- The member side reads its own effective window from `GET /tasks/task-window` via
  `TaskContext.taskWindow` / `refreshTaskWindow()` (loaded once per signed-in user).
  `TaskDetails.tsx` shows an open/closed pill, disables "Add Task" while closed, and
  re-checks the window on open. `addTask` refuses locally when closed, and adopts the
  `taskWindow` the API returns on a 403 so a stale copy self-corrects.
- Admin-assigned tasks are never blocked by the window.

## Domain types

- `TaskStatus = "todo" | "in_progress" | "review" | "completed"` (from `TaskContext`)
- `TaskPriority = "low" | "medium" | "high" | "urgent"` (from `TaskContext`)
- `UserRole = "admin" | "member"` (from `AuthContext`)
- `ProjectStatus`, `ScopeRole` (`lead | member`), `ScopeAccess`, `ProjectSummary`,
  `ProjectDetail`, `TeamSummary`, `TeamDetail`, `Person` (from `ProjectContext`)
- `Organization` / `Workspace` / `TaskWindow` (from `OrgContext`); `TaskWindowInfo` — the
  member-facing window incl. `label` / `open` (from `TaskContext`); `Member` carries
  `workspaceId` (from `MemberContext`)

## Conventions

- Use the `@/` import alias (maps to `src/`).
- Reuse `src/components/ui/*` shadcn primitives; don't hand-roll buttons/inputs/dialogs.
- **Design language: minimalist, warm and calm ("Earth").** Palette: cream `#f7f1de`,
  sage `#b0ba99`, caramel `#9d6638`, espresso `#4e220f`, plus terracotta for actions.
  Light is the default (`ThemeProvider defaultTheme="light"`, key `crewly-theme`); dark
  is a near-neutral charcoal (`#171412`) so large areas never turn muddy brown. Style
  only with tokens so both work: canvas `bg-background` (cream), panels `bg-card`, insets
  `bg-surface`, text `foreground` (espresso), `text-muted-foreground`, `border-border`.
  Colour has one meaning each: `primary` (terracotta `#a4521f`) = **act here** (buttons,
  selected controls) and never a status; `sage` / `sage-soft` = done, present, success;
  `honey` / `honey-soft` (caramel) = in progress, partial; `destructive` (brick) = errors
  and absent. Shadows use an espresso tint (`rgb(78_34_15/…)`). The espresso **sidebar**
  is the one bold colour block — don't add more. Photo panels (landing hero, auth pages)
  are shaded with `--hero-shade` (an "r g b" triplet) and accented with `--hero-accent`.
- **Landing page** (`components/landing/`, composed in `pages/Landing.tsx`): one motion idea
  per section, every scroll-linked transform zeroed under `useReducedMotion()`, and copy that
  states real product behaviour (keep it true: the FAQ and the day timeline quote the 9 PM IST
  cron, the submission window and the invite email). Pieces: hero (photo parallax,
  `Typewriter` headline, word-by-word subcopy, two floating product cards at different scroll
  depths), `Marquee` (CSS `marquee` keyframe, pauses on hover, wraps under reduced motion),
  `BeforeAfter` (panels enter from opposite sides, dotted spines draw with scroll),
  `AttendanceFlow` (the interactive tasks → attendance demo; same rules as
  `attendancecron.ts`), `DayTimeline` (≥lg: a `h-[300vh]` section pins and scroll moves the
  day sideways; phones/reduced motion get a grid), `TeamBoard` (espresso band, the page's one
  dark section; board tilts upright on scroll, bars fill, statuses resolve), `FeatureBento`
  (seven real features with small illustrations that play once), `SetupSteps` (numbered —
  a real sequence — joined by a line that draws with scroll), `Faq` (shadcn accordion),
  closing band (typewriter + drifting feather), footer wordmark that rises in. `LineReveal`
  is the section-headline treatment; the nav carries a scroll-progress line. The root uses
  `overflow-x-clip` (not hidden) so side-entering panels can't widen the page while sticky
  sections still pin. No invented customers, logos, testimonials, prices or stats. The hero
  photo is self-hosted in
  `public/images/hero-team-earth-{1280,2400}.webp` (Unsplash License, by Sable Flow — keep
  the footer credit). The auth pages use `public/images/auth-desk-earth-{900,1600}.webp`
  (Unsplash License, by Dhony Koswara — credited on the photo panel). Both `-earth`
  files are tritone-graded copies of the originals (still alongside) to sit in the
  palette. The auth photo drifts with a CSS `kenburns` keyframe (`index.css`, off under
  `motion-reduce`).
- **Status/priority pills are soft tints** (pale fill + deeper ink of the same hue), from
  `lib/projectMeta.ts` (`taskStatusColors`, `taskStatusDots`, `priorityColors`) and
  `ProjectStatusBadge` / `AttendanceDot` in `components/projects/shared.tsx`. Don't use
  saturated Tailwind palette colours (`bg-blue-500`, `bg-emerald-500`…).
- **Typography:** one family site-wide, **Roboto** with **Inter** as the fallback
  (`--font-sans` / `--font-display`, both loaded from Google Fonts in `index.html`).
  Headings get weight 600 and tight tracking from the base layer; no second display face,
  no monospace, **no all-caps tracked labels**. Use `tabular-nums` for numbers in columns.
- **Rounded, with a hierarchy** (`--radius: 0.875rem`): controls `rounded-sm` (10px),
  inputs/menus `rounded-md`/`rounded-lg`, cards and panels `rounded-xl`, dialogs
  `rounded-2xl`, badges/avatars/switches `rounded-full`. Hairline borders
  (`border-border/80`) instead of drop shadows; soft layered shadows only on overlays.
- **Motion (framer-motion, wrapped in `MotionConfig reducedMotion="user"`):** keep it
  purposeful. The signature moment is the sidebar's sliding active pill (`layoutId=
  "nav-active"`). Pages **crossfade** on route change (AppShell, `AnimatePresence
  mode="popLayout"`: in 280 ms with an 8px lift, out 140 ms). The `Suspense` boundary sits
  *above* that transition and React Router 7 runs navigations as transitions, so the current
  page stays visible while the next page's code loads, then the two crossfade (don't switch
  back to `mode="wait"`: it renders the new page only after the exit, outside the
  transition, which leaves a blank gap). Content that replaces a skeleton is wrapped in
  `components/layout/Reveal` (fade + 4px lift, mount only; key it when it should replay,
  e.g. per month), and tab panels fade in (`ui/tabs.tsx`). Task cards glide
  between board columns when their status changes (`layoutId={task.id}`). Expand/collapse
  uses height+opacity. Grids may stagger in once (≤40ms). Buttons press to `scale(0.97)`
  via `index.css`. Use the `--ease-out` curve (`[0.23, 1, 0.32, 1]`), keep UI motion
  ≤300ms, animate `opacity`/`transform` only, and never animate keyboard-driven actions.
- **Copy:** sentence case, plain verbs, a toast names the action that happened ("Task
  added", "Member removed"); errors say what went wrong and what to do.
- Icons from `lucide-react`.
- Use `toast` from `@/components/ui/sonner` for user feedback.
- **Data mutations are optimistic, not refetch-based.** The context CRUD functions
  update local state and return the affected entity (or a boolean for deletes). After
  a mutation, update the page's local list from that return value — do **not** trigger
  a full `refreshMembers()` / `getTasks()` refetch (the prod backend cold-starts, so a
  blocking refetch is slow). Always show a per-action loading spinner (`Loader2`) and
  disable the button while a request is in flight; for `AlertDialog` actions, call
  `e.preventDefault()` so the dialog stays open until the request resolves.
- **Every page is code-split (`lib/pages.ts`).** Pages are only imported there, through
  `lazyPage()` (`lib/lazy.ts`), and `App.tsx` renders `pages.X.Component`; a new page goes
  in that registry, never as a static import (or it lands in the main bundle). Signed-in
  pages suspend inside AppShell (`PageFallback`, shown after 200 ms; the sidebar stays),
  public pages on `ScreenFallback`. Sidebar links preload their page on hover/focus/touch
  (`preloadPath`), and once idle the shell preloads every sidebar page; the landing page
  preloads Login. Both skip when the visitor saves data. A chunk that fails to load (a tab
  open across a deploy) triggers one automatic reload per session. Home lazy-loads its two
  charts so the chart library (~390 KB) never holds up today's list.
  **Vendor chunks** (`vite.config.ts`): only React and Framer Motion get manual chunks;
  don't add rules for libraries only some pages use — a manual chunk swallows that
  library's dependencies, and if one is shared with the shell the whole chunk joins the
  first download (it happened with recharts). First load: ~570 KB / ~180 KB gzip, down
  from 1.26 MB / 371 KB.
- **Data is cached for an instant first paint (stale-while-revalidate).** `lib/cache.ts`
  keeps the last response per key in `localStorage` (prefix `wz-cache:v1:`, entries older
  than 7 days ignored, quota errors degrade to uncached). `hooks/use-persistent-state.ts`
  is a drop-in `useState` that starts from the cached value for its key and saves every
  change (values read from the cache aren't written back, so they still age out); `revive`
  rebuilds Dates. Used by OrgContext (orgs), MemberContext (members), ProjectContext
  (projects/teams per workspace), `useLiveTasks`, Home's report, ProjectDetail,
  TeamDetail and both attendance pages; Reports reads/writes the cache by hand so changing
  filters still keeps the previous report on screen. **Rules:** every key starts with the
  user's id; `logout` and an expired session call `clearCache()`; a context's `isLoading`
  means "nothing to show yet" (don't set it when cached data is on screen); and when you
  add a cached value, list its setter in hook dependency arrays (it's stable, but the
  hooks lint rule can't tell).
- **A member's own task lists stay current without a refresh.** Home and "My tasks" load
  through `hooks/use-live-tasks.ts`: it refetches when the member returns to the tab or
  window (or comes back online) and once a minute while the tab is visible, and toasts
  tasks that appeared from elsewhere ("New task on your list: …"). Its `setTasks` is for
  the page's own optimistic updates, and what it sets counts as seen, so the member's own
  additions are never announced. Background checks fail silently. This is polling, not
  push: Vercel functions can't hold connections open, so true real-time would need a
  service like Pusher/Ably. Admin and project boards don't poll yet.
- **Task status is editable inline.** On `components/tasks/TaskBoard` the status pill is a
  `DropdownMenu` (when `canManage`) — picking a status calls `updateTask({ status })`.
  `MemberDetail` (admin) and `TaskDetails` (member) both use it.
- Theme toggle, change password and sign-out live in the sidebar's **account menu**
  (`AppShell`); admins switch org/workspace from the sidebar's workspace switcher.
- API base URL must come from `import.meta.env.VITE_API_URL` (set `VITE_API_URL` in
  the environment / Vercel). Don't hardcode backend URLs.

## Deployment

Configured for **Vercel** (`vercel.json` rewrites all paths to `/index.html` for SPA
client-side routing).
</content>
</invoke>
