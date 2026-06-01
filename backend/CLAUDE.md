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

- **Node.js + Express 5** with **TypeScript** (CommonJS, `ts-node` in dev).
- **Prisma 6** ORM over **PostgreSQL** (Neon serverless in prod). Schema in
  `prisma/schema.prisma`, migrations in `prisma/migrations/`.
- **JWT** auth (`jsonwebtoken`) with **bcrypt**-hashed passwords.
- **zod** for request validation.
- **nodemailer** for transactional email (SMTP, Brevo relay in prod). `resend` is a
  dependency but not currently wired in.
- **node-cron** for two scheduled jobs (EOD attendance + keep-alive ping).
- Deployed on **Vercel** (`vercel.json`, `@vercel/node`). Prod URL pinged by the
  keep-alive cron: `https://todo-app-fz58.onrender.com` (also references Render).

## Commands

```bash
npm install          # install deps (postinstall runs `prisma generate`)
npm run dev          # nodemon + ts-node, watches ./src, runs src/index.ts
npm run build        # tsc -> dist/ + prisma generate
npm start            # build then node dist/index.js

npx prisma migrate dev --name <name>   # create+apply a migration in dev
npx prisma generate                    # regenerate the client after schema edits
npx prisma studio                      # browse the DB
```

There is **no test suite** and **no linter** configured.

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
  controllers/
    auth.controller.ts        # login, signup, changePassword, forgot/resetPassword
    members.controller.ts     # createMember, getMembers, getMember, deleteMember
    tasks.controller.ts       # createTask, getMemberTasks, updateTask, deleteTask
    attendance.controller.ts  # getMyAttendance + 3 admin report endpoints
    admin.controller.ts       # setUserRole  (NOT mounted on any route)
  middleware/
    auth.middleware.ts     # authenticate(): verifies Bearer JWT -> req.user
    roleCheck.ts           # requireAdmin, canManageTask, canViewMemberTasks
  cron/
    attendancecron.ts      # 9:00 PM IST EOD attendance finalization
    pingcron.ts            # every 5 min health ping (keep dyno warm)
  utils/
    jwt.ts                 # generate/verify token (7d expiry)
    password.ts            # bcrypt hash/compare + DEFAULT_PASSWORD = "123456"
    hash.ts                # bcryptjs hash/compare (duplicate of password.ts, unused-ish)
    email.ts               # nodemailer transporter + 2 HTML emails
    attendance.ts          # IST time helpers + the daily-window logic
  validation/
    authValidation.ts, memberValidation.ts, taskValidation.ts   # zod schemas
prisma/
  schema.prisma            # User, Member, Task, DailyAttendance + enums
  migrations/
```

## Data model (`prisma/schema.prisma`)

- **User** — the auth identity. `email` (unique), `password` (hashed), `name`, `role`
  (`admin` | `member`), `isPasswordReset` (true = must change pw), `resetToken` /
  `resetTokenExpiry`. An admin User owns the Members they create via
  `createdMembers` (relation `"CreatedMembers"`).
- **Member** — a User's membership in a team. `userId` (unique → one Member per User),
  `email`, `role` (free-form string job title, NOT the auth role), `createdById`
  (the admin who added them). Cascade-deletes with its User.
- **Task** — belongs to a Member. `title`, `description`, `status` (`todo` |
  `in_progress` | `review` | `completed`), `priority` (`low|medium|high|urgent`),
  `dueDate`, `completedAt`. Cascade-deletes with its Member.
- **DailyAttendance** — one row per `(memberId, date)` (unique). `status`
  (`present` | `absent` | `partial`, default `absent`), `taskSubmittedAt`,
  `allTasksCompletedAt`. `date` is `@db.Date`.

> **Note the two `role` fields:** `User.role` is the auth role (admin/member);
> `Member.role` is a job-title string. Don't conflate them.

## API surface (all under the CORS-allowed origins in `index.ts`)

`/health` → `{ status, timestamp }` (public; used by keep-alive cron).

**`/api/auth`** (public unless noted)
- `POST /login` → `{ token, user, requiresPasswordChange }`
- `POST /signup` → creates an **admin** User, returns `{ token, user }`
- `POST /change-password` *(auth)* — verify old pw, set new, clear `isPasswordReset`
- `POST /forgot-password` — resets pw directly by email + newPassword (no token step)
- `POST /reset-password` — resets pw via `resetToken` + newPassword

**`/api/members`** (all `authenticate`)
- `POST /` *(admin)* — create member; creates the User w/ DEFAULT_PASSWORD if new and
  emails credentials; sets `isPasswordReset: true`
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

- Send `Authorization: Bearer <jwt>`. `authenticate` puts the decoded payload
  (`{ userId, email, role }`) on `req.user`. Tokens last **7d**.
- Passwords hashed with bcrypt, **cost 10**. New members get `DEFAULT_PASSWORD`
  (`"123456"`) and `isPasswordReset: true`; the client should force a change.
- Role gating: `requireAdmin` for admin-only; `canManageTask` / `canViewMemberTasks`
  let members act only on their own resources (matched by **email**).

## Env vars

Read from `process.env` (loaded via `dotenv` in `index.ts`). Required:

- `DATABASE_URL` — Postgres connection string (Prisma).
- `JWT_SECRET` — JWT signing secret. **Always set it** — `jwt.ts` silently falls back
  to `"fallback-secret-key"` if missing, which is unsafe.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SENDER_EMAIL` — email sending.

Optional: `PORT` (defaults **3000** in `index.ts`, but `config.ts` exports **3001** —
inconsistent), `JWT_EXPIRES_IN` (default `"7d"`, though `generateToken` hardcodes `"7d"`
anyway), `BACKEND_URL` (keep-alive ping target, default `http://localhost:3000`).

## Conventions & gotchas

- Each controller/middleware file `new PrismaClient()`s its own instance instead of
  reusing `config.ts`'s exported `client`. Follow the file you're editing, but prefer
  the shared `client` for new code.
- Controllers validate with zod and catch `ZodError` → `400 { message, errors }`;
  everything else → `500`. Keep that shape.
- `userId` in task routes means the member's **User** id, not the Member id — the code
  resolves Member via `where: { userId }`. Be careful which id you're passing.
- `tsconfig` is strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) —
  hence the `!` assertions and the conditional-spread update pattern in `updateTask`.
  Match that style rather than loosening types.
- Email links are hardcoded to `http://localhost:5173` in `utils/email.ts` — update
  before relying on them in production.
- `admin.controller.ts` (`setUserRole`) and `utils/hash.ts` exist but are unused; the
  legacy zod schemas in `config.ts` are leftovers from another project. Don't assume
  they're wired in.
- CORS origins are an allow-list in `index.ts`; add new client origins there.
</content>
</invoke>
