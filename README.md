# Workzen

Workzen is a task and attendance app for startups and small businesses. Each morning, people write down what they'll get done that day. When they finish the list, Workzen marks them present. Nobody clocks in. Attendance comes from the work itself.

- **Finish everything you planned:** present
- **Finish some of it:** partial
- **Plan nothing:** absent

Admins set up the organisation, add people and see the whole team's day. Leads run their own projects and teams. Everyone else sees their own work.

## Features

- **Daily task lists.** Members add their own tasks. Admins and project leads can assign tasks too.
- **Automatic attendance.** Finishing the whole list marks someone present straight away. The rest of the day is settled at 9:00 PM IST.
- **Home dashboard for members.** Today's list, the month's attendance calendar, what's coming up, project work, and weekly charts. New tasks appear without a page refresh.
- **Organisations, workspaces, projects and teams.** One organisation can hold several workspaces (one per shop, office or department). Inside a workspace, projects and teams each have leads and members.
- **Reports.** On-time rate, open work and attendance for any person, team or project over a date range, exportable as CSV.
- **Submission hours.** Optionally limit when members can add their plans, for example 9 to 11 AM. Off by default.
- **Sign-in.** Email and password, or Google. New members get an invite link to choose their own password.

## How it's built

This repo holds two separate projects, each with its own dependencies and deployment. It isn't a workspace-managed monorepo.

| Folder | What it is | Stack |
|---|---|---|
| [`backend/`](backend) | REST API | Node, Express 5, TypeScript, Prisma 6 on PostgreSQL (Neon), JWT, Better Auth (Google), Resend (email) |
| [`client/`](client) | Web app | React 19, Vite 7, TypeScript, Tailwind CSS v4, shadcn/ui, framer-motion, recharts |

Both use **[Bun](https://bun.sh)** for installs and scripts. Don't add `package-lock.json` or `yarn.lock` files.

The `CLAUDE.md` files are the detailed project guides: [root](CLAUDE.md) for the big picture, plus [backend/CLAUDE.md](backend/CLAUDE.md) and [client/CLAUDE.md](client/CLAUDE.md). They cover the data model, every API route, the attendance rules and the design system.

## Getting started

### What you need

- [Bun](https://bun.sh) 1.x
- Node.js 22 (the backend's `engines` setting)
- A PostgreSQL database. A free [Neon](https://neon.tech) project works well.

> **Use a separate database for development.** Everything you do locally (sign-ups, tasks, migrations, test data) writes to whatever `DATABASE_URL` points at. Create a dev database or a Neon branch, and never point your local `.env` at production.

### 1. Backend

```bash
cd backend
bun install                    # also runs prisma generate
cp .env.example .env           # then fill it in (see Environment variables)
bunx prisma migrate deploy     # create the tables in your dev database
bun run dev                    # http://localhost:3000
```

Check it's running: `curl http://localhost:3000/health`

### 2. Client

```bash
cd client
bun install
cp .env.example .env           # points at the local API
bun run dev                    # http://localhost:5173
```

Open http://localhost:5173 and sign up. Signing up creates an admin account; members are added by an admin rather than signing up themselves. From there, create an organisation, then a workspace, then add people.

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | What it's for |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_SECRET` | yes | Signs sign-in tokens. The API won't start without it. |
| `CLIENT_URL` | in production | The client's URL, used for links in emails and the Google sign-in redirect (default `http://localhost:5173`) |
| `RESEND_API_KEY` | for email | [Resend](https://resend.com) key. Without it, emails are skipped with a warning. |
| `EMAIL_FROM` | for email | Sender address on a domain verified in Resend |
| `CRON_SECRET` | in production | Protects the end-of-day attendance endpoint (see [Deployment](#deployment)) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | for Google sign-in | OAuth client from Google Cloud. The button hides itself when these aren't set. |
| `BETTER_AUTH_URL` | for Google sign-in | Public URL of this API (default `http://localhost:$PORT`) |
| `BETTER_AUTH_SECRET` | recommended | Signs Google sign-in cookies (falls back to `JWT_SECRET`) |
| `PORT` | no | Defaults to `3000` |

### Client (`client/.env`)

| Variable | What it's for |
|---|---|
| `VITE_API_URL` | Base URL of the API, including `/api` |

Never commit `.env` files.

## Scripts

| Where | Command | Does |
|---|---|---|
| `backend/` | `bun run dev` | API with reload on change |
| `backend/` | `bun run build` | Type-check, compile to `dist/` and generate the Prisma client |
| `backend/` | `bun run test` | Jest test suite (the database is mocked, so no DB is needed) |
| `backend/` | `bunx jest tests/tasks.test.ts` | One test file |
| `client/` | `bun run dev` | Web app with hot reload |
| `client/` | `bun run build` | Type-check and build to `dist/` |
| `client/` | `bun run lint` | ESLint |

Some backend tests currently fail because of two known, long-standing issues: the auth middleware returns 500 instead of 401 for a missing or bad token, and some attendance test mocks no longer match the controller.

## Deployment

Both projects deploy to **[Vercel](https://vercel.com)**, each from its own folder with its own `vercel.json`. The client rewrites every path to `index.html` so routing works on refresh.

When the client moves to a new domain, add that domain to the CORS allow-list in `backend/src/index.ts`, or the browser will block API calls.

### End-of-day attendance

At 9:00 PM IST, a job settles the day. Anyone with unfinished tasks becomes partial, and anyone who planned nothing becomes absent. Vercel functions aren't running at that time, so an external scheduler calls the API:

1. **Generate a secret** with `openssl rand -hex 32`. Add it to the backend project on Vercel as the `CRON_SECRET` environment variable (Production), then redeploy.
2. **Create a job on [cron-job.org](https://cron-job.org):**
   - **URL:** `https://<your-api>/api/internal/cron/eod`
   - **Schedule:** every day at **21:00**, timezone **Asia/Kolkata**. Run it only once a day; see the warning below.
   - **Advanced → Headers:** `Authorization: Bearer <your CRON_SECRET>`
3. **Test it safely** by adding `?dryRun=1` to the URL. That checks the secret, reads and counts, and writes nothing. A working setup returns the day's summary, for example `{"dryRun":true,"members":12,"present":7,...}`. A 401 means the secret doesn't match, and a 503 means `CRON_SECRET` isn't set. Remove `?dryRun=1` afterwards.

> Don't run the job for real during the day. It marks everyone who hasn't planned their tasks yet as absent, and adding tasks later doesn't undo that.

On an always-on host (a VPS, Render, or locally), the API schedules the job itself and no external scheduler is needed.

## Security notes

- **No shared passwords.** New members are invited by email and choose their own password through a one-time link. Accounts created before invites existed can't sign in with the old temporary password; they're emailed a link to set one instead.
- **Rate limits.** Sign-in, password reset, sign-up and email verification are rate-limited per network and per account. The whole API also has a wide per-network limit.
- **Security headers** are set with [helmet](https://helmetjs.github.io).
- **Token storage.** Reset, invite and verification tokens are stored only as SHA-256 hashes.

## Contributing

- Work happens on `development`; open pull requests into `main`.
- Keep frontend and backend types in sync by hand. Enums like task status and priority are duplicated on both sides.
- Read the relevant `CLAUDE.md` before changing an area. They describe the conventions (design tokens, copy style, error handling, access rules) that the code follows.
