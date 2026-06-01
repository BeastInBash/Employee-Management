# MEMORY.md — Backend

Running notes & non-obvious facts about the Task Tracker **backend**. Keep this short;
deep guidance lives in `CLAUDE.md`. One line per fact.

## Architecture
- Express 5 + TypeScript (CommonJS, ts-node in dev) → Prisma 6 → PostgreSQL (Neon in prod).
- Deployed on Vercel (`@vercel/node`); a Render URL (`todo-app-fz58.onrender.com`) is the keep-alive ping target.
- No tests, no linter. `npm run dev` = nodemon + ts-node on `src/index.ts`.

## Domain rules (don't break these)
- **Attendance is derived from tasks**, not entered directly. present / partial / absent.
- Members can only submit tasks **9–11 AM IST**; all-tasks-completed flips the day to `present`; an EOD cron at **9 PM IST (3:30 PM UTC)** finalizes everyone.
- IST = UTC+5:30; "today" is stored as UTC-midnight of the IST day (`getTodayISTDate`) to match Prisma `@db.Date`.

## Easy-to-trip-on gotchas
- **Two `role` fields:** `User.role` = auth role (admin/member); `Member.role` = job-title string.
- **`userId` in task routes = the member's User id**, not the Member id; code resolves Member via `where: { userId }`.
- `JWT_SECRET` silently falls back to `"fallback-secret-key"` if unset — always set it.
- `PORT` default is inconsistent: `3000` in `index.ts`, `3001` in `config.ts`.
- Email links in `utils/email.ts` are hardcoded to `http://localhost:5173`.
- Dead code: `admin.controller.ts` (setUserRole) is unmounted; `utils/hash.ts` and the news/post zod schemas in `config.ts` are unused leftovers.
- Each file makes its own `new PrismaClient()` instead of reusing `config.ts`'s `client` — prefer the shared one for new code.

## Env vars
- Required: `DATABASE_URL`, `JWT_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SENDER_EMAIL`.
- Optional: `PORT`, `JWT_EXPIRES_IN` (default 7d), `BACKEND_URL` (keep-alive target).

## TODO / known rough edges
- `forgot-password` resets the password directly from email + newPassword (no token verification step) — weaker than `reset-password`.
- `DELETE /api/tasks/:taskId` is gated by `canManageTask` middleware but the controller also hard-requires admin.
</content>
