# CLAUDE.md

Guidance for working in this repository (the **backend** of the Task Tracker app).

## What this app is

**Task Tracker** is a team task & attendance management app. This repo is the **REST API**
that the React client (`../client`) talks to. Two roles:

- **Admin** — signs up, creates team members, assigns/views tasks, and reviews attendance.
- **Member** — created by an admin (emailed a default password `123456`), submits and
  updates their own daily tasks, and views their own attendance.

The core domain idea: **attendance is derived from task activity**. A member submits their
tasks (any time by default, or inside an admin-configured window) and completes them by
end of day; the system marks them present / partial / absent automatically (see
"Attendance model" below).

## Stack

- **Node.js + Express 5** with **TypeScript** (CommonJS; dev runs via `tsx --watch`).
- **Prisma 6** ORM over **PostgreSQL** (Neon serverless in prod). Schema in
  `prisma/schema.prisma`, migrations in `prisma/migrations/`.
- **JWT** auth (`jsonwebtoken`) with **bcrypt**-hashed passwords.
- **Better Auth 1.7** for the **Google OAuth handshake only** (see "Google sign-in"). It's
  ESM-only and loaded from this CommonJS build via Node's `require(esm)` (Node ≥ 22.12).
- **zod** for request validation.
- **Resend** for transactional email (`utils/email.ts`), branded **WorkZen** and sent
  from `EMAIL_FROM` (a verified Resend domain, `no-reply@workzen.besaif.in`). See "Email".
- **node-cron** for two scheduled jobs (EOD attendance + keep-alive ping).
- Deployed on **Vercel** (`vercel.json`, `@vercel/node`). Prod URL pinged by the
  keep-alive cron: `https://todo-app-fz58.onrender.com` (also references Render).

## Commands

> **Tooling note:** the backend now uses **Bun** for installs/scripts (`bun.lock`;
> `package-lock.json` removed) and **tsx** instead of nodemon+ts-node for dev.

```bash
bun install          # install deps (postinstall runs `prisma generate`)
bun run dev          # tsx --watch ./src/index.ts
bun run build        # tsc -> dist/ + prisma generate
bun start            # build then node dist/index.js
bun run test         # jest --runInBand
bun run test:watch   # jest --watch

npx prisma migrate dev --name <name>   # create+apply a migration in dev
npx prisma generate                    # regenerate the client after schema edits
npx prisma studio                      # browse the DB
```

There is now a **Jest test suite** in `tests/` (ts-jest, Prisma deep-mocked via
`tests/singleton.ts` — see "Testing" below). No linter is configured.

## Project layout

```
src/
  index.ts                 # express app: middleware, route mounting, cron start, listen
  config.ts                # PrismaClient `client`, PORT, JWT_SECRET, UserPayload type,
                           #   + a pile of unused legacy zod schemas (news/posts/comments)
  routes/
    auth.router.ts         # /api/auth
    members.router.ts      # /api/members   (router-level authenticate)
    tasks.router.ts        # /api/tasks     (router-level authenticate)
    attendance.router.ts   # /api/attendance(router-level authenticate)
    organization.router.ts # /api/org       (authenticate; also POST /:orgId/workspaces)
    workspace.router.ts    # /api/workspace (authenticate; POST /create-workspace/:orgId)
    projects.router.ts     # /api/projects  (authenticate + handleError)
    teams.router.ts        # /api/teams     (authenticate + handleError)
    reports.router.ts      # /api/reports   (authenticate + handleError)
    google.router.ts       # /api/auth/providers, /api/auth/google, /api/auth/google/complete
  controllers/
    auth.controller.ts        # login, signup, changePassword, forgot/resetPassword
    members.controller.ts     # createMember, getMembers, getMember, deleteMember
    tasks.controller.ts       # createTask, getMemberTasks, updateTask, deleteTask
    attendance.controller.ts  # getMyAttendance + 3 admin report endpoints
    organization.controller.ts# createOrganization, getMyOrganization, getOrgById
    workspace.controller.ts   # createWorkspace (+ owner WorkspaceMembership, in a txn),
                              #   task window, listWorkspaceMembers
    projects.controller.ts    # projects CRUD, seats, team assignment, project tasks
    teams.controller.ts       # teams CRUD + seats
    reports.controller.ts     # productivity/attendance report (IST day helpers live here)
    admin.controller.ts       # setUserRole  (NOT mounted on any route)
  middleware/
    auth.middleware.ts     # authenticate(): verifies JWT (cookie, falls back to Bearer) -> req.user
    roleCheck.ts           # requireAdmin, canManageTask, canViewMemberTasks
    error.middleware.ts    # handleError: ApiError-aware error handler (statusCode + message)
  cron/
    attendancecron.ts      # 9:00 PM IST EOD attendance finalization
    pingcron.ts            # every 5 min health ping (keep dyno warm)
  utils/
    jwt.ts                 # generate/verify token (7d expiry)
    password.ts            # bcrypt hash/compare + DEFAULT_PASSWORD = "123456"
    hash.ts                # bcryptjs hash/compare (duplicate of password.ts, unused-ish)
    email.ts               # Resend client, the WorkZen template, every email we send
    verification.ts        # email-verification tokens (hash, TTL, resend cooldown)
    notify.ts              # notifySeats(): team/project added + lead emails
    attendance.ts          # IST time helpers + the daily-window logic
    access.ts              # who is admin/lead/member of a workspace, project or team
    betterAuth.ts          # the Better Auth instance (Google provider, Auth* tables)
    googleAuth.ts          # resolveGoogleUser(): Google profile → app User (no better-auth import)
    errors/ApiError.ts     # Error subclass w/ statusCode + static badRequest/notFound/etc.
  validation/
    authValidation.ts, memberValidation.ts, taskValidation.ts   # zod schemas
    orgValidation.ts       # zod schemas for org query params (membership/workspace flags)
    workspaceValidation.ts # zod schema for the task-submission-window PATCH
    projectValidation.ts   # zod schemas for projects, teams, seats, project tasks
    reportValidation.ts    # zod schema for the report query
prisma/
  schema.prisma            # User, Member, Task, DailyAttendance, Organization,
                           #   OrgMembership, Workspace, WorkspaceMembership + enums
  migrations/
tests/                     # jest + supertest suite (auth, members, tasks, attendance,
                           #   middleware) + env/singleton/helpers/testApp harness
ReBAC.md                   # design guide for the Organizations→Workspaces ReBAC work
```

## Data model (`prisma/schema.prisma`)

- **User** — the auth identity. `email` (unique), `password` (hashed; **nullable** for
  Google-only accounts), `emailVerified` (true once a Google sign-in proved the address),
  `image`, `name`, `role`
  (`admin` | `member`), `isPasswordReset` (true = must change pw), `resetToken` /
  `resetTokenExpiry`. An admin User owns the Members they create via
  `createdMembers` (relation `"CreatedMembers"`).
- **Member** — a User's seat in a **workspace**. `userId`, `workspaceId` (required;
  `@@unique([userId, workspaceId])` → one Member per user *per workspace*, so a user can
  be a member of several workspaces), `email`, `role` (free-form string job title, NOT
  the auth role), `createdById` (the admin who added them). Cascade-deletes with its User
  **and** with its Workspace. **`userId` is no longer globally unique** — look members up
  with `findFirst({ where: { userId } })`, never `findUnique`.
- **Task** — belongs to a Member (so it's transitively scoped to that Member's workspace).
  `title`, `description`, `status` (`todo` | `in_progress` | `review` | `completed`),
  `priority` (`low|medium|high|urgent`), `dueDate`, `completedAt`, optional `projectId`
  (`onDelete: SetNull`, so deleting a project keeps its tasks). Cascade-deletes with its
  Member. Reopening a completed task clears `completedAt`.
- **Project** — in a workspace: `name`, `description?`, `status` (`ProjectStatus`),
  `color?` (hex), `startDate?`, `dueDate?`, `createdById`. Seats are **`ProjectMember`**
  (`projectId`+`memberId` unique, `role: ScopeRole` = `lead|member`); whole teams attach via
  **`ProjectTeam`** (composite PK). Everyone on an assigned team counts as a participant.
- **Team** — in a workspace (`@@unique([workspaceId, name])`), `description?`, `color?`;
  seats are **`TeamMember`** (`role: ScopeRole`).
- **DailyAttendance** — one row per `(memberId, date)` (unique). `status`
  (`present` | `absent` | `partial`, default `absent`), `taskSubmittedAt`,
  `allTasksCompletedAt`. `date` is `@db.Date`.

> **Note the two `role` fields:** `User.role` is the auth role (admin/member);
> `Member.role` is a job-title string. Don't conflate them.

### ReBAC models (Organizations → Workspaces)

Multi-tenancy layer (design in `ReBAC.md`). **`Member` is now workspace-scoped** (Option A —
see `SCHEMA-RELATIONS.md`), so the task/attendance domain lives inside a workspace via
`Member.workspaceId`. The user↔workspace **permission** layer (`WorkspaceMembership`) is
still separate from the **domain** layer (`Member`).

- **Organization** — `name`, `ownerId` (creating User), `createdAt`. Has many
  `OrgMembership` and `Workspace`. Mapped to table `organization`.
- **OrgMembership** — user ↔ org edge with `OrgRole` (`owner | admin | member`, default
  `member`). `@@unique([userId, orgId])`. Table `org_membership`.
- **Workspace** — `name`, `orgId`; belongs to an Organization, has many
  `WorkspaceMembership` and **`Member`** (the domain seats). Also carries the task
  submission window: `taskWindowEnabled` (default **`false`** → members submit anytime),
  `taskWindowStart` / `taskWindowEnd` (minutes from IST midnight, default 540/660 =
  9–11 AM). Table `workspaces`.
- **WorkspaceMembership** — user ↔ workspace edge carrying **Option B** boolean perms
  (`canView` / `canEdit` / `canDelete`, all default **`true`**). `workspaceId` is **now
  required** (was nullable). `@@unique([userId, workspaceId])`. Table `workspace_memberships`.

Migration `20260629131555_workspace_scoped_members` added `Member.workspaceId` (with a
backfill), made `WorkspaceMembership.workspaceId` non-null, and swapped `Member`'s
`userId @unique` for the composite unique.

> **Known rough edges (vs `ReBAC.md`):** perms still default to wide-open `true` (doc wants
> default-deny); no `can()` resolver or `authorize()` middleware yet. Member-initiated task
> submission / `GET /attendance/me` resolve the member via `findFirst({ where: { userId } })`
> and pick an arbitrary workspace when a user belongs to several (see `SCHEMA-RELATIONS.md`).

## API surface (all under the CORS-allowed origins in `index.ts`)

`/health` → `{ status, timestamp }` (public; used by keep-alive cron).

**`/api/auth`** (public unless noted)
- `GET /providers` → `{ google: boolean }` (whether Google credentials are configured)
- `GET /google` → 302 to Google (via Better Auth `signInSocial`); `GET /google/complete` →
  swaps the Better Auth session for the app JWT, 302 to `CLIENT_URL/auth/callback#token=…`
  (`&new=1` for a newly created admin, `&notice=password_disabled`), or to
  `CLIENT_URL/login?error=google_failed|google_unavailable|email_unverified`
- `GET /me` *(auth)* → `{ user, requiresPasswordChange }`
- `POST /login` → `{ token, user, requiresPasswordChange }` (401 with a "signs in with
  Google" message when the account has no password)
- `POST /signup` → creates an **admin** User and emails a verification link; returns
  `{ token, user, verificationSent }` (the account works before it's verified)
- `POST /verify-email` `{ token }` *(public)* — confirms the address (one-time, 24h)
- `POST /resend-verification` *(auth)* — new link; 429 + `retryAfter` within 60s of the
  last one; `{ alreadyVerified: true }` if there's nothing to do
- `POST /change-password` *(auth)* — verify old pw, set new (must differ), clear `isPasswordReset`
- `POST /forgot-password` — takes `email` only; if the account exists, stores a hashed
  reset token (valid 4 days, `RESET_TOKEN_TTL_MS`) and emails a reset link. Always returns a generic 200 (no user
  enumeration).
- `POST /reset-password` — resets pw via `token` + newPassword. The raw token from the
  email is SHA-256 hashed and matched against the stored hash + expiry.

**`/api/members`** (all `authenticate`)
- `POST /` *(admin)* — create member; body now **requires `workspaceId`** (the controller
  verifies the workspace exists and the admin owns / is owner-admin of its org); creates
  the User w/ DEFAULT_PASSWORD if new and emails credentials; sets `isPasswordReset: true`.
  The "already a member" check is **per workspace** (a user can be a member of several).
- `GET /` — admin: members they created; member: their own member row(s)
- `GET /:memberId` *(admin)* — single member by Member id
- `DELETE /:memberId` *(admin)*

**`/api/tasks`** (all `authenticate`)
- `POST /` — member: creates a task for self + upserts today's attendance row; allowed
  **anytime** unless the member's workspace has a submission window enabled (403 +
  `taskWindow` when it's closed); admin: must pass `userId` (the member's **User** id)
- `GET /task-window` — the window that applies to the caller (`{ workspaceId, taskWindow }`;
  admins always get an open one). **Must stay declared above `GET /:userId`.**
- `GET /member/:userId` *(canViewMemberTasks)* and `GET /:userId` — tasks by member's
  **User** id (resolves Member via `userId`)
- `PATCH /:taskId` *(canManageTask)* — update; completing the last open task can flip
  attendance to `present` (see `checkAndMarkPresent`)
- `DELETE /:taskId` *(canManageTask, but controller also hard-requires admin)*

**`/api/attendance`** (all `authenticate`)
- `GET /me` — current member's monthly attendance + summary (`?month`/`?year`)
- `GET /today` *(admin)* — today's overview across members the admin created
- `GET /report` *(admin)* — all members' report (`?startDate&endDate` or `?month&year`)
- `GET /report/:memberId` *(admin)* — one member's report (accepts Member id **or** User id)

**`/api/org`** (all `authenticate`; router uses `error.middleware`)
- `POST /createOrganization` — creates an Organization + owner `OrgMembership` in one
  transaction; body `{ name }` (zod: trimmed, min 2)
- `GET /getMyOrgs` — orgs owned **or joined** by the caller; `?membership=true&workspace=true`
  opt-in to include relations (the client calls this with `?workspace=true`)
- `GET /getOrg?orgId=<uuid>` — single org by id; same `membership`/`workspace` include flags
- `POST /:orgId/workspaces` — create a Workspace in the org + grant the creator a
  `WorkspaceMembership` (txn); body `{ workspaceName }` (min 2). Caller must own / be
  owner-admin of the org. **This is the path the client uses.**

**`/api/workspace`** (all `authenticate`)
- `POST /create-workspace/:orgId` — same `createWorkspace` handler as above, alternate mount.
- `GET /:workspaceId/task-window` — read the workspace's task submission window. Any org
  owner/admin, workspace membership holder, or Member seat in it may read.
- `PATCH /:workspaceId/task-window` *(admin who owns / owner-admins the org)* — body
  `{ enabled, startTime?, endTime? }` with `"HH:mm"` 24-hour IST times (required when
  `enabled`, and they must differ). Omitting the times keeps the stored hours, so the
  toggle alone can turn the restriction off.

- `GET /:workspaceId/members` — Member seats in the workspace (`{ id (Member id), userId,
  name, email, jobTitle, teams[] }`); any participant may read (used by the pickers).

**`/api/projects`** (all `authenticate`; throws → `handleError`)
- `GET /?workspaceId=` — with a workspace: admins see all, members only the ones they're on;
  without: every project the caller is on. Each has `leads`, `memberCount`, `teams`,
  `stats` (`total/completed/inProgress/overdue/progress`), `myRole`.
- `POST /` *(admin)* — `{ workspaceId, name, description?, status?, color?, startDate?,
  dueDate?, leadIds?, memberIds?, teamIds? }` (Member/Team ids must be in the workspace).
- `GET /:projectId` — `{ project: { …, teams, people[] (each with projectRole, viaTeams,
  stats, todayAttendance) }, myRole, permissions: { canManage, canAssignLeads, canDelete } }`.
- `PATCH /:projectId` *(admin/lead)*; `DELETE /:projectId` *(admin)*.
- `POST /:projectId/members` `{ memberId, role? }` *(admin/lead; only admins may add a
  lead)*; `PATCH /:projectId/members/:memberId` `{ role }` *(admin)*;
  `DELETE /:projectId/members/:memberId` *(admin/lead; leads can't remove a lead)*.
- `POST /:projectId/teams` `{ teamId }` / `DELETE /:projectId/teams/:teamId` *(admin/lead)*.
- `GET /:projectId/tasks?status&memberId` — any participant; tasks include `assignee` + `project`.
- `POST /:projectId/tasks` — admins/leads assign to any participant (`memberId` = Member id);
  a regular member may only create for themselves, and that self-submission obeys the
  workspace task window and upserts today's attendance like `POST /api/tasks`.

**`/api/teams`** (all `authenticate`; throws → `handleError`)
- `GET /?workspaceId=` (all teams in the workspace, `myRole` null if not on it) or without
  (teams the caller is on). `POST /` *(admin)* `{ workspaceId, name, description?, color?,
  leadIds?, memberIds? }`.
- `GET /:teamId` — roster with per-member task counts + `todayAttendance`, assigned
  projects, `permissions`. `PATCH` *(admin/lead)*, `DELETE` *(admin)*.
- Seats: same `POST/PATCH/DELETE /:teamId/members[/:memberId]` rules as projects.

**`/api/reports`** (`authenticate`; throws → `handleError`)
- `GET /?scope=workspace|project|team|me&id=<uuid>&from=YYYY-MM-DD&to=YYYY-MM-DD&excludeWeekends=true|false`
  (default `true`; range ≤ 366 days, `id` required except for `me`). Access: workspace →
  admin; project/team → admin or that project's/team's lead; `me` → the caller's own seats.
  Project scope counts only that project's tasks but every participant's attendance.
- Returns `{ scope, range, summary, trend[], members[] }`. Definitions: **completionRate** =
  share of tasks *created* in the range that are now completed; **onTimeRate** = share of
  tasks *completed* in the range with `completedAt <= dueDate`; **overdueOpen** = open tasks
  past due right now; **avgCycleHours** = created→completed; **attendanceRate** =
  (present + ½ partial) / recorded rows, Saturdays/Sundays skipped when `excludeWeekends`.
  Rates are `null` when there's nothing to divide by.
- Day bucketing is by **IST calendar day** (`istDateKey`); attendance rows are matched as
  UTC-midnight dates, the same way `getTodayISTDate` writes them.

**Existing task routes and projects:** `POST /api/tasks` accepts an optional `projectId`
(the assignee must be a participant; the member seat is resolved in the project's
workspace). `PATCH /api/tasks/:taskId` and `DELETE` also allow the **lead of the task's
project** (`canLeadTaskProject` in `canManageTask` + the controllers). Task list/create/update
responses include `project: { id, name, color } | null`.

See `api-docs.md` for fuller request/response examples.

## Email (Resend)

All mail goes through `utils/email.ts`: one inline-styled template (off-white canvas,
white card, forest-green button) with a plain-text alternative, branded **WorkZen**.
Everything user-supplied (names, project/team names) is HTML-escaped. Sends never throw —
they log and return `false` — so an email outage can't fail the request that triggered it.

| Trigger | Function | Notes |
|---|---|---|
| Admin creates a new member | `sendMemberCredentials` | temp password + a "Confirm email and sign in" link (verification included); `Reply-To` = the admin |
| Sign-up | `sendVerificationEmail` | soft verification — the account works immediately |
| Resend from the app banner | `sendVerificationEmail` | max one a minute |
| Forgot password | `sendPasswordResetEmail` | states the real link lifetime |
| Added to a team / project | `sendScopeNotice` via `notifySeats` | on create (seeded seats) and on add |
| Made a lead | `sendScopeNotice` (`event: "promoted"`) | only on a real member→lead change |

`notifySeats` (`utils/notify.ts`) skips the person who made the change, is awaited (so
serverless runtimes don't drop sends) and swallows errors. Assigning a whole **team** to a
project does not email its members (it could be many people) — add that deliberately if
wanted.

**Email verification** (soft): `User.emailVerified` plus `emailVerificationToken`
(SHA-256 of the emailed token) and `emailVerificationExpiry` (24h,
`utils/verification.ts`). Google sign-in also sets `emailVerified`. A verified address
matters for Google linking: `resolveGoogleUser` only switches off the password on the
first Google sign-in to an **unverified** account, so verifying by link keeps a password.

## Google sign-in (Better Auth)

Better Auth only runs the OAuth handshake; the app's own JWT stays the session.

- **Flow** — all top-level navigations on the API origin, so Better Auth's `HttpOnly`,
  `SameSite=Lax` state/session cookies are first-party even with the client on another
  domain: client → `GET /api/auth/google` → Google → `GET /api/better-auth/callback/google`
  (Better Auth handler) → `GET /api/auth/google/complete` → client `/auth/callback#token=…`.
  The token rides in the URL **fragment** (never sent to servers or logged). The Better
  Auth session is signed out right after the swap.
- **Tables** — Better Auth keeps its own `AuthUser` / `AuthSession` / `AuthAccount` /
  `AuthVerification` (`auth_*`, ids via Prisma `@default(uuid())` because
  `advanced.database.generateId: "uuid"`). Its field names follow Better Auth's core
  schema — don't rename them.
- **Matching** (`utils/googleAuth.ts`) — by the Google-verified email (unverified Google
  emails are refused). Unknown email → new **admin** with no password. Existing account
  whose `emailVerified` is still false → mark verified and **null the password** (kills
  the default `123456`, and stops anyone who pre-registered someone else's address from
  keeping a password into it). Better Auth's own implicit account linking isn't used
  because it requires `emailVerified` on the local row, which legacy users don't have.
- **Mounting** — `app.all("/api/better-auth/*splat", toNodeHandler(auth))` must stay
  **before** `express.json()`. `googleRouter` is mounted on `/api/auth` ahead of `authRoutes`.
- **Tests** — Jest can't load ESM `better-auth`, so keep its imports in `betterAuth.ts` /
  `google.router.ts` only (neither is in `tests/testApp.ts`); test logic via
  `resolveGoogleUser` (`tests/googleAuth.test.ts`).
- **Google Cloud setup** — OAuth client of type *Web application*; authorized redirect
  URIs: `http://localhost:3000/api/better-auth/callback/google` and
  `<BETTER_AUTH_URL>/api/better-auth/callback/google` for each deployed API. No JavaScript
  origins are needed (the browser never calls Google from the client origin).

## Attendance model (the important domain logic)

All times are **IST (UTC+5:30)**; helpers live in `src/utils/attendance.ts`.

- **Submission window (per workspace, off by default):** members may `POST /api/tasks`
  **at any time** unless an admin restricts the workspace. The window lives on
  `Workspace.taskWindowEnabled / taskWindowStart / taskWindowEnd` (start/end are minutes
  from IST midnight; `end <= start` wraps past midnight) and is enforced in
  `createTask` via `toTaskWindow` + `isWithinTaskWindow`. A blocked request returns
  **403** with the message *and* the serialized `taskWindow` so the client can correct a
  stale copy. Admin-created tasks are never constrained. Submitting creates/keeps a
  `DailyAttendance` row (default `absent`, `taskSubmittedAt` set).
  `isWithinTaskSubmissionWindow()` (the old fixed 9–11 AM helper) survives only for the
  legacy `submissionWindowOpen` field on the admin "today" overview.
- **Completion → present:** when a member completes a task (`PATCH` status→`completed`),
  `checkAndMarkPresent` checks whether **all of today's tasks** are completed; if so the
  day flips to `present`.
- **Known quirk:** the cron (and `checkAndMarkPresent`) select "today's tasks" with
  `createdAt` between `getTodayISTDate()` and +24h — i.e. UTC midnight to UTC midnight, not
  the IST day. Tasks created 00:00–05:30 IST count toward the previous day. The cron also
  writes an `absent` row for every member on weekends, which is why reports default to
  `excludeWeekends`.
- **EOD finalization (cron):** `attendancecron.ts` runs at **3:30 PM UTC = 9:00 PM IST**.
  For each member: no tasks today → `absent`; some-but-not-all complete → `partial`;
  all complete → `present`. Already-`present` rows are skipped.
- "Today" is computed as UTC-midnight of the current IST calendar day
  (`getTodayISTDate`) so it lines up with Prisma's `@db.Date`.

## Auth & security conventions

- `authenticate` reads the JWT from the **`token` cookie** (`cookie-parser` is mounted in
  `index.ts`), and **falls back to the `Authorization: Bearer` header** when the cookie is
  absent (`cookiesToken ?? bearerToken`) — this is what makes the client work, since it
  stores the JWT in `localStorage` and a `sameSite=lax` cookie is never sent cross-site.
  Puts the decoded payload (`{ userId, email, role }`) on `req.user`. Tokens last **7d**.
  It doesn't try/catch: a bad/absent token throws and is handled by error middleware.
- The **login cookie `maxAge` is 7d** (`auth.controller.ts`), matching the JWT lifetime —
  they were previously mismatched (cookie 4d), which expired the session early. The client
  authenticates via the localStorage Bearer token anyway, but keep the two in sync.
- Passwords hashed with bcrypt, **cost 10**. New members get `DEFAULT_PASSWORD`
  (`"123456"`) and `isPasswordReset: true`; the client should force a change.
- Project/team access lives in `utils/access.ts` (`getProjectAccess` / `getTeamAccess` →
  `admin | lead | member | null`, `canManage()`), keyed off Member seats in the resource's
  workspace — not off `User.role`. Use it for new scoped routes instead of ad-hoc checks.
- Role gating: `requireAdmin` for admin-only; `canManageTask` / `canViewMemberTasks`
  let members act only on their own resources, **matched by `userId`** (`task.member.userId`
  / `member.userId` vs `req.user.userId`). This was previously matched by **email**, which
  silently 403'd members whenever `Member.email` drifted from `User.email`; `updateTask`'s
  in-controller ownership check uses `userId` for the same reason. Prefer `userId` (the
  stable key) over email for any new ownership check.

## Env vars

Read from `process.env` (loaded via `dotenv` in `index.ts`). Required:

- `DATABASE_URL` — Postgres connection string (Prisma).
- `JWT_SECRET` — JWT signing secret. **Required** — `jwt.ts` throws on startup if it's
  missing (no insecure fallback).
- `RESEND_API_KEY` — Resend key (a send-only key is enough). Without it, sends are
  skipped with a warning and the app keeps working.
- `EMAIL_FROM` — sender address on a domain verified in Resend, e.g.
  `no-reply@workzen.besaif.in` (a bare address gets the "WorkZen" display name; you can
  also pass `"Name <addr>"`). Resend rejects addresses on unverified domains (403).
- `CLIENT_URL` — base URL of the client app, used to build every link in emails.
  Defaults to `http://localhost:5173`.

Google sign-in (optional — the button hides itself when unset):
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — OAuth client from Google Cloud Console.
- `BETTER_AUTH_URL` — public URL of **this API** (defaults to `http://localhost:$PORT`).
  Deliberately not `BACKEND_URL`, which points at prod for the keep-alive ping.
- `BETTER_AUTH_SECRET` — signs Better Auth cookies; falls back to `JWT_SECRET` if unset.
  Set a separate one in production.
- `CLIENT_URL` (above) is also where Google sign-in lands and is Better Auth's trusted origin.

Optional: `PORT` (defaults **3000** in `index.ts`, but `config.ts` exports **3001** —
inconsistent), `JWT_EXPIRES_IN` (default `"7d"`, though `generateToken` hardcodes `"7d"`
anyway), `BACKEND_URL` (keep-alive ping target, default `http://localhost:3000`).

## Testing

- **Jest + ts-jest + supertest**, run with `bun run test` (`jest --runInBand`). Config in
  `jest.config.js`.
- **Prisma is deep-mocked**, not hit for real: `tests/singleton.ts` provides a
  `jest-mock-extended` mock and `tests/env.ts` loads it (plus test env) before any module
  imports — so each controller's `new PrismaClient()` resolves to the shared mock.
- `tests/testApp.ts` builds an Express app for supertest; `tests/helpers.ts` has shared
  fixtures/utilities. Suites cover auth, members, tasks, attendance, middleware, the
  workspace task-submission window (`workspace.test.ts`, incl. the IST window helpers), and
  reports (`reports.test.ts` — metric math, IST bucketing, weekend exclusion, access), and
  projects/teams permissions and their notification emails (`projects.test.ts` — its
  `standAs()` helper programs the lookups `utils/access.ts` makes, so a test can act as
  admin / lead / member / outsider), and email verification (`verification.test.ts`).
  `tests/singleton.ts` mocks `utils/email` (every send resolves `true`; assert on the
  mocks) and the `resend` package, so tests never reach the network.
  **~19 pre-existing failures** (auth-middleware 401s surfacing as 500, plus members/
  attendance mocks that drifted from the controllers) are unrelated to that suite.
- ts-jest relaxes a few strict-mode diagnostics (`2345/2322/2769`) so test doubles compile;
  don't rely on that leniency in `src/`.

## Conventions & gotchas

- Each controller/middleware file `new PrismaClient()`s its own instance instead of
  reusing `config.ts`'s exported `client`. Follow the file you're editing, but prefer
  the shared `client` for new code.
- **Two error-handling styles coexist.** Older controllers validate with zod and catch
  `ZodError` → `400 { message, errors }`, everything else → `500`, inside the controller.
  Newer code (the org controller) **throws** instead — `ApiError.badRequest/notFound/...`
  or a raw `ZodError` — and lets `error.middleware.ts` (`handleError`) translate it to a
  status code. `handleError` maps `ZodError` → 400, Prisma `P2002` → 409 and `P2025` → 404,
  and honours `ApiError.statusCode` (incl. `ApiError.conflict`). The org, workspace,
  projects and teams routers mount `handleError` themselves; the global handler in
  `index.ts` is still the hardcoded-500 one. Match the style
  of the file you're editing.
- `userId` in task routes means the member's **User** id, not the Member id — the code
  resolves Member via `findFirst({ where: { userId } })`. **Use `findFirst`, not
  `findUnique`**, for member-by-`userId`: `userId` alone is no longer unique now that
  `Member` is workspace-scoped (`@@unique([userId, workspaceId])`). Be careful which id
  you're passing.
- `tsconfig` is strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) —
  hence the `!` assertions and the conditional-spread update pattern in `updateTask`.
  Match that style rather than loosening types.
- Email links are built from `CLIENT_URL` in `utils/email.ts` (default
  `http://localhost:5173`) — set it in production.
- `admin.controller.ts` (`setUserRole`) and `utils/hash.ts` exist but are unused; the
  legacy zod schemas in `config.ts` are leftovers from another project. Don't assume
  they're wired in.
- CORS origins are an allow-list in `index.ts`; add new client origins there.
- The **keep-alive ping cron is currently disabled** (`startKeepAliveCron()` and its import
  are commented out in `index.ts`). Only the EOD attendance cron runs.
</content>
</invoke>
