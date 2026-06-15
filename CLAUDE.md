# CLAUDE.md

Repository-level guidance for the **Task Tracker** monorepo. This is the umbrella context;
each package has its own detailed `CLAUDE.md`:

- **`backend/CLAUDE.md`** — the Express + Prisma REST API.
- **`client/CLAUDE.md`** — the React + Vite single-page app.

Read the relevant package file before doing focused work there; this file covers the
cross-cutting picture and the contract between the two.

## What this app is

**Task Tracker** is a team task & attendance management app where **attendance is derived
from task activity** rather than entered manually. Two roles:

- **Admin** — signs up, creates team members (who are emailed a default password
  `123456`), assigns/views tasks, and reviews attendance across the team.
- **Member** — created by an admin, submits their daily tasks in a morning window and
  completes them through the day; the system marks them present / partial / absent.

## Repo shape

```
todo-app/
  backend/    # Node + Express 5 + TypeScript, Prisma 6 over PostgreSQL, JWT auth. (CLAUDE.md)
  client/     # React 19 + Vite 7 + TS, Tailwind v4 + shadcn/ui, React Context state. (CLAUDE.md)
```

It is **not** a workspace-managed monorepo — the two packages are independent npm/bun
projects with their own dependencies, build, and deploy. Install and run each separately.

> **Package managers differ:** the **backend uses npm** (`package-lock.json`), the
> **client uses Bun** (`bun.lock`). Don't cross-contaminate lockfiles.

## Running locally

```bash
# Terminal 1 — API on :3000
cd backend && npm install && npm run dev

# Terminal 2 — client on :5173
cd client && bun install && bun run dev
```

The client reads the API base URL from `VITE_API_URL`; point it at the local backend
(`http://localhost:3000`). The backend's CORS allow-list (`backend/src/index.ts`) already
includes `http://localhost:5173`. There is **no test suite** in either package.

## The frontend ↔ backend contract

- **Transport:** REST over HTTP. The client calls `${VITE_API_URL}/api/...`; the API
  mounts `/api/auth`, `/api/members`, `/api/tasks`, `/api/attendance` (plus public
  `/health`). Full surface is in `backend/CLAUDE.md` / `backend/api-docs.md`.
- **Auth:** JWT bearer tokens. Login/signup return `{ token, user }`; the client stores
  the token in `localStorage.authToken` and sends `Authorization: Bearer <token>` on
  authenticated requests. Tokens last 7 days.
- **First login:** new members get the default password `123456` and `isPasswordReset:
  true`; the client is responsible for forcing a password change.
- **Shared domain enums** (keep both sides in sync — they are duplicated, not shared):
  - `TaskStatus = todo | in_progress | review | completed`
  - `TaskPriority = low | medium | high | urgent`
  - `UserRole = admin | member`
- **`userId` vs Member id gotcha:** task/attendance endpoints key off the member's
  **User** id, not the Member row id. Be deliberate about which id the client sends.

## CORS / origins

Allowed origins are an explicit allow-list in `backend/src/index.ts`. When deploying the
client to a new domain, add it there or requests will be blocked.

## Deployment

Both packages deploy to **Vercel** (each has its own `vercel.json`). The backend also has
Render/keep-alive references (a cron pings the prod URL to stay warm) — see
`backend/CLAUDE.md`. The client `vercel.json` rewrites all paths to `/index.html` for SPA
routing.

## When making cross-cutting changes

- Changing an API route, payload shape, or enum: update **both** the backend controller
  /validation and the matching client context (`AuthContext` / `MemberContext` /
  `TaskContext`), since types are mirrored by hand.
- Adding a new client origin: update the backend CORS list.
- Touching attendance logic: the source of truth is the backend (`utils/attendance.ts`
  + the cron job); the client only displays/derives from what the API returns.
