# CLAUDE.md

Guidance for working in this repository (the **backend** of the Task Tracker app).

## What this app is

**Task Tracker** is a team task & attendance management app. This repo is the **REST API**
that the React client (`../client`) talks to. Two roles:

- **Admin** — signs up, creates team members, assigns/views tasks, and reviews attendance.
- **Member** — created by an admin (emailed a default password `123456`), submits and
  updates their own daily tasks, and views their own attendance.

The core domain idea: **attendance is derived from task activity**. A member submits tasks
in a morning window and completes them by end of day; the system marks them
present / partial / absent automatically (see "Attendance model" below).

## Stack

- **Node.js + Express 5** with **TypeScript** (CommonJS; dev runs via `tsx --watch`).
- **Prisma 6** ORM over **PostgreSQL** (Neon serverless in prod). Schema in
  `prisma/schema.prisma`, migrations in `prisma/migrations/`.
- **JWT** auth (`jsonwebtoken`) with **bcrypt**-hashed passwords.
- **zod** for request validation.
- **nodemailer** for transactional email over **Gmail SMTP** (`smtp.gmail.com:587`
  with a Gmail App Password — 2-Step Verification must be enabled). `resend` is a
  dependency but not currently wired in. The member-credentials email is sent **from
  the admin who created the member**: `from` uses the admin name + `SENDER_EMAIL`
  (Gmail rewrites the From address to the authenticated account, so an arbitrary
  admin address can't be used directly) and `Reply-To` is set to the admin's email.
- **node-cron** for two scheduled jobs (EOD attendance + keep-alive ping).
- Deployed on **Vercel** (`vercel.json`, `@vercel/node`). Prod URL pinged by the
  keep-alive cron: `https://todo-app-fz58.onrender.com` (also references Render).

## Commands

> **Tooling note:** the backend now uses **Bun** for installs/scripts (`bun.lock`;
> `package-lock.json` removed) and **tsx** instead of nodemon+ts-node for dev. The root
> `CLAUDE.md` still says "backend uses npm" — that's stale; prefer `bun`.

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
  controllers/
    auth.controller.ts        # login, signup, changePassword, forgot/resetPassword
    members.controller.ts     # createMember, getMembers, getMember, deleteMember
    tasks.controller.ts       # createTask, getMemberTasks, updateTask, deleteTask
    attendance.controller.ts  # getMyAttendance + 3 admin report endpoints
    organization.controller.ts# createOrganization, getMyOrganization, getOrgById
    workspace.controller.ts   # createWorkspace (+ owner WorkspaceMembership, in a txn)
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
    email.ts               # nodemailer transporter + 2 HTML emails
    attendance.ts          # IST time helpers + the daily-window logic
    errors/ApiError.ts     # Error subclass w/ statusCode + static badRequest/notFound/etc.
  validation/
    authValidation.ts, memberValidation.ts, taskValidation.ts   # zod schemas
    orgValidation.ts       # zod schemas for org query params (membership/workspace flags)
prisma/
  schema.prisma            # User, Member, Task, DailyAttendance, Organization,
                           #   OrgMembership, Workspace, WorkspaceMembership + enums
  migrations/
tests/                     # jest + supertest suite (auth, members, tasks, attendance,
                           #   middleware) + env/singleton/helpers/testApp harness
ReBAC.md                   # design guide for the Organizations→Workspaces ReBAC work
```

## Data model (`prisma/schema.prisma`)

- **User** — the auth identity. `email` (unique), `password` (hashed), `name`, `role`
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
  `priority` (`low|medium|high|urgent`), `dueDate`, `completedAt`. Cascade-deletes with
  its Member.
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
  `WorkspaceMembership` and **`Member`** (the domain seats). Table `workspaces`.
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
- `POST /login` → `{ token, user, requiresPasswordChange }`
- `POST /signup` → creates an **admin** User, returns `{ token, user }`
- `POST /change-password` *(auth)* — verify old pw, set new (must differ), clear `isPasswordReset`
- `POST /forgot-password` — takes `email` only; if the account exists, stores a hashed,
  1-hour reset token and emails a reset link. Always returns a generic 200 (no user
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
- `POST /` — member: only within 9–11 AM IST window, creates task for self + upserts
  today's attendance row; admin: must pass `userId` (the member's **User** id)
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

Still no permission gating (`can()` / `authorize()`) on these yet.

See `api-docs.md` for fuller request/response examples.

## Attendance model (the important domain logic)

All times are **IST (UTC+5:30)**; helpers live in `src/utils/attendance.ts`.

- **Submission window:** 9:00–11:00 AM IST. Members can only `POST /api/tasks` in this
  window (`isWithinTaskSubmissionWindow`). Submitting creates/keeps a `DailyAttendance`
  row (default `absent`, `taskSubmittedAt` set).
- **Completion → present:** when a member completes a task (`PATCH` status→`completed`),
  `checkAndMarkPresent` checks whether **all of today's tasks** are completed; if so the
  day flips to `present`.
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
- Passwords hashed with bcrypt, **cost 10**. New members get `DEFAULT_PASSWORD`
  (`"123456"`) and `isPasswordReset: true`; the client should force a change.
- Role gating: `requireAdmin` for admin-only; `canManageTask` / `canViewMemberTasks`
  let members act only on their own resources (matched by **email**).

## Env vars

Read from `process.env` (loaded via `dotenv` in `index.ts`). Required:

- `DATABASE_URL` — Postgres connection string (Prisma).
- `JWT_SECRET` — JWT signing secret. **Required** — `jwt.ts` throws on startup if it's
  missing (no insecure fallback).
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SENDER_EMAIL` — email sending.
- `CLIENT_URL` — base URL of the client app, used to build links in emails (login +
  password-reset). Defaults to `http://localhost:5173`.

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
  fixtures/utilities. Suites cover auth, members, tasks, attendance, and middleware.
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
  status code. `handleError` honours `ApiError.statusCode` but does **not** yet special-case
  `ZodError` (so a thrown `ZodError` becomes a 500). The org router mounts `handleError`
  itself; the global handler in `index.ts` is still the hardcoded-500 one. Match the style
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
