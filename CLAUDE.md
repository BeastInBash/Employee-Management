# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Repository-level guidance for the **Workzen** monorepo (the client UI was rebranded from
"Task Tracker", then "Crewly"; emails spell it "WorkZen"; repo/dirs are still `todo-app` and the backend still calls itself Task
Tracker internally). This is the umbrella context; each package has its own detailed
`CLAUDE.md`:

- **`backend/CLAUDE.md`** — the Express + Prisma REST API.
- **`client/CLAUDE.md`** — the React + Vite single-page app.

Read the relevant package file before doing focused work there; this file covers the
cross-cutting picture and the contract between the two.

## What this app is

**Workzen** is a team task & attendance management app where **attendance is derived
from task activity** rather than entered manually. Tenancy is **Org → Workspace →
Members** (a `Member` is a user's seat in one workspace; see the package docs). Two roles:

- **Admin** — signs up, creates organizations & workspaces, adds team members into a
  workspace (who are emailed a link to choose their own password), assigns/views tasks, and
  reviews attendance across the team.
- **Member** — created by an admin, submits their daily tasks (**any time** by default, or
  within a window the admin configures per workspace) and completes them through the day;
  the system marks them present / partial / absent.

## Repo shape

```
todo-app/
  backend/    # Node + Express 5 + TypeScript, Prisma 6 over PostgreSQL, JWT auth. (CLAUDE.md)
  client/     # React 19 + Vite 7 + TS, Tailwind v4 + shadcn/ui, React Context state. (CLAUDE.md)
```

It is **not** a workspace-managed monorepo — the two packages are independent Bun
projects with their own dependencies, build, and deploy. Install and run each separately.
The root `package.json` holds **repo tooling only** (Husky, lint-staged, Prettier) — no
workspaces, no app code; run `bun install` at the root once so the git hooks install.

> **Both packages use Bun** (`bun.lock` in each; there is no `package-lock.json`). Don't
> introduce npm/yarn lockfiles. CI (`.github/workflows/lint.yml`) runs `bun install` +
> `bun run build` in `backend/` on every PR.

## Running locally

```bash
# Terminal 1 — API on :3000
cd backend && bun install && bun run dev

# Terminal 2 — client on :5173
cd client && bun install && bun run dev
```

The client reads the API base URL from `VITE_API_URL`; point it at the local backend
(`http://localhost:3000`). The backend's CORS allow-list (`backend/src/index.ts`) already
includes `http://localhost:5173`.

## Tests & checks

```bash
# Backend tests (Jest + ts-jest + supertest, Prisma deep-mocked — no DB needed)
cd backend && bun run test                       # all
cd backend && bunx jest tests/tasks.test.ts      # one file
cd backend && bunx jest -t "task window"         # by test name

# Client checks (no client test suite)
cd client && bun run lint && bun run build

# Everything CI checks, from the root
bun run check            # format:check + lint + typecheck + build, both packages
bun run format           # Prettier, whole repo
```

**Git hooks (Husky, installed by `bun install` at the root):**
- **pre-commit** — `lint-staged` runs on staged files only, using the closest config
  (`client/.lintstagedrc.mjs`, `backend/.lintstagedrc.mjs`, root `.lintstagedrc.mjs`):
  `eslint --fix --max-warnings=0` + `prettier --write` on TS, then a whole-package
  type-check (`tsc -b` / `tsc --noEmit`) once per package touched.
- **pre-push** — builds whichever package changed since the upstream (both when there's
  no upstream). Skip a hook once with `--no-verify`, sparingly.
- **CI** (`.github/workflows/lint.yml`) runs format check, lint (zero warnings), build for
  both packages and backend tests on every PR; tests are non-blocking until the ~13
  known failures are fixed.

**Formatting:** Prettier from the root `.prettierrc.json` — 120 columns, double quotes,
semicolons, trailing commas; 2-space indent, **4-space in `backend/src`**. Markdown is
excluded (`.prettierignore`). The one-time whole-repo format commit is listed in
`.git-blame-ignore-revs`; run `git config blame.ignoreRevsFile .git-blame-ignore-revs`
once so local `git blame` skips it (GitHub does automatically).

**Lint:** both packages have ESLint flat configs with zero errors and warnings — keep it
that way (the hooks and CI enforce it). Client: `react-refresh/only-export-components` is
off for `components/ui`, `contexts` and `theme-provider` (they pair components/providers
with variants/hooks on purpose). Backend: `no-explicit-any` is off only in `tests/`;
unused vars allow rest-sibling omission and `_`-prefixed names.

## The frontend ↔ backend contract

- **Transport:** REST over HTTP. The client calls `${VITE_API_URL}/api/...`; the API
  mounts `/api/auth`, `/api/members`, `/api/tasks`, `/api/attendance`, `/api/org`,
  `/api/workspace`, `/api/projects`, `/api/teams`, `/api/reports` (plus public `/health`). Full surface is in `backend/CLAUDE.md` /
  `backend/api-docs.md`.
- **Auth:** JWT bearer tokens. Login/signup return `{ token, user }`; the client stores
  the token in `localStorage.authToken` and sends `Authorization: Bearer <token>` on
  authenticated requests. The backend `authenticate` middleware prefers a `token` cookie
  but **falls back to the Bearer header**, so this works cross-site. Tokens (and the login
  cookie) last **7 days**; the client keeps the session for the full token life by decoding
  the JWT `exp` and only clearing storage once it has actually expired.
- **First login:** new members have **no password**. Their invite email links to
  `/reset-password?token=…&welcome=1` (7-day one-time token), where they choose one; that
  also verifies their email. Accounts from before invites still carry the old shared
  `123456`: login refuses it (403 `password_setup_required`) and emails the owner a link
  instead, so knowing someone's address is never enough to get in.
- **Google sign-in (Better Auth):** the client navigates to `${VITE_API_URL}/auth/google`;
  Better Auth (mounted at `/api/better-auth`) runs the OAuth handshake on the API's origin,
  then `/api/auth/google/complete` matches the Google-verified email to a `User`, issues the
  **same app JWT**, and redirects to `CLIENT_URL/auth/callback#token=…`. Unknown emails
  become admins; a first Google sign-in to an existing account switches its password off.
  Details in `backend/CLAUDE.md` → "Google sign-in".
- **Shared domain enums** (keep both sides in sync — they are duplicated, not shared):
  - `TaskStatus = todo | in_progress | review | completed`
  - `TaskPriority = low | medium | high | urgent`
  - `UserRole = admin | member`
  - `ProjectStatus = planning | active | on_hold | completed | archived`
  - `ScopeRole = lead | member` (a seat on a project or team)
- **`userId` vs Member id gotcha:** task/attendance endpoints key off the member's
  **User** id, not the Member row id. Be deliberate about which id the client sends.
- **Workspace scoping:** a `Member` is a user's seat in a workspace (`Member.workspaceId`,
  `@@unique([userId, workspaceId])`), so a user can be a member of several workspaces and
  `userId` alone is no longer unique. Creating a member requires a `workspaceId`; the
  client picks it from the active workspace (`OrgContext`). See the package `CLAUDE.md`s.
- **Task submission window:** members add their own tasks **anytime** by default. An admin
  can restrict a workspace to set hours (IST) via `PATCH /api/workspace/:id/task-window`
  `{ enabled, startTime, endTime }` ("HH:mm"); the backend enforces it on `POST /api/tasks`
  and the client reads the caller's effective window from `GET /api/tasks/task-window`
  (`TaskContext.taskWindow`) to gate its "Add task" affordance. Admin-assigned tasks are
  never blocked. Wire shape: `{ enabled, startMinute, endMinute, startTime, endTime, label,
  open, currentTimeIST }`.

## Projects, teams & leads

Inside a workspace, admins create **Teams** (groups of members) and **Projects**. People
join a project directly (`ProjectMember`) or through an assigned team (`ProjectTeam`).
Each seat is `lead` or `member`. Access is resolved in `backend/src/utils/access.ts`:
**admin** = owns the org or is an owner/admin `OrgMembership`; **leads** manage their own
project/team (edit details, add/remove regular members, assign tasks, and on projects also
edit/delete project tasks and assign teams); only admins appoint/remove leads or delete.
Tasks can carry an optional `projectId`. Project/team payloads use **Member** ids
(`/api/workspace/:id/members` lists them), unlike the task routes, which take **User** ids.

## Reports

`GET /api/reports?scope=workspace|project|team|me&id&from&to&excludeWeekends` returns
summary KPIs, a per-day trend and a per-person table for an **IST date range** (max 366
days). Admins report on the workspace and everything in it, leads on what they lead, and
everyone on themselves (`scope=me`). The client page is `/reports`; CSV export is built
client-side from the same payload (`client/src/lib/reports.ts`).

## CORS / origins

Allowed origins are an explicit allow-list in `backend/src/index.ts`. When deploying the
client to a new domain, add it there or requests will be blocked.

## Deployment

Both packages deploy to **Vercel** (each has its own `vercel.json`). The backend's
end-of-day attendance is triggered by **cron-job.org** once a day at 21:00 Asia/Kolkata
(`GET /api/internal/cron/eod` with `Authorization: Bearer <CRON_SECRET>`; the env var must
be set on the Vercel backend project). Test it any time with `?dryRun=1`, which writes nothing. The backend also has Render/keep-alive references — see
`backend/CLAUDE.md`. The client `vercel.json` rewrites all paths to `/index.html` for SPA
routing.

## When making cross-cutting changes

- Changing an API route, payload shape, or enum: update **both** the backend controller
  /validation and the matching client context (`AuthContext` / `MemberContext` /
  `TaskContext`), since types are mirrored by hand.
- Adding a new client origin: update the backend CORS list.
- Touching attendance logic: the source of truth is the backend (`utils/attendance.ts`
  + the cron job); the client only displays/derives from what the API returns.


