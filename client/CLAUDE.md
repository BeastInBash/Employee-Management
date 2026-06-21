# CLAUDE.md

Guidance for working in this repository (the **client** of the Task Tracker app).

## What this app is

**Task Tracker** is a team task & attendance management web app. Two roles:

- **Admin** — manages team members, assigns and tracks tasks, and reviews attendance across the team.
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
    Landing.tsx             # public marketing landing page  ->  route "/"
    Login.tsx               # login + signup tabs            ->  "/login"
    ForgotPassword.tsx / ResetPassword.tsx
    Dashboard.tsx           # admin: team member grid, add/delete member
    MemberDetail.tsx        # a single member's detail
    TaskDetails.tsx         # tasks for a member ("/todos/:memberId")
    MembersDashboard.tsx    # attendance dashboard ("/attendance")
    AdminPanel.tsx          # admin attendance panel ("/admin/attendance")
    NotFound.tsx
    Index.tsx               # legacy redirect-to-"/" helper (not routed)
  contexts/
    AuthContext.tsx         # login/signup/changePassword/logout; user in localStorage
    MemberContext.tsx       # team members + tasks CRUD; mutations update local state
                            #   optimistically and RETURN the created/updated entity
    TaskContext.tsx         # member-facing tasks CRUD; updateTask returns the updated Task
  components/
    ProtectedRoute.tsx      # gates routes; redirects to "/login" when unauthenticated
    theme-provider.tsx      # ThemeProvider, useTheme, ThemeToggle
    ui/                     # shadcn components
  hooks/  lib/utils.ts (cn)
```

## Routing (`src/App.tsx`)

Public: `/` (Landing), `/login`, `/forgot-password`, `/reset-password`.
Protected (wrapped by `ProtectedRoute`): `/dashboard`, `/attendance`,
`/dashboard/member/:memberId/attendance`, `/admin/attendance`,
`/member/:memberId`, `/todos/:memberId`. Everything else → `NotFound`.

After login, admins go to `/dashboard`; members go to `/todos/:id` (their tasks).

## Auth model

- JWT-based. On success the API returns `{ token, user }`; the token is stored in
  `localStorage.authToken` and the user in `localStorage.user`.
- `AuthContext` initializes `user` synchronously from `localStorage` to avoid a flash
  redirect on first render.
- Authenticated requests send `Authorization: Bearer <token>`.
- New members are created by an admin and emailed a default password (`123456`).

## Domain types (from `TaskContext`)

- `TaskStatus = "todo" | "in_progress" | "review" | "completed"`
- `TaskPriority = "low" | "medium" | "high" | "urgent"`
- `UserRole = "admin" | "member"` (from `AuthContext`)

## Conventions

- Use the `@/` import alias (maps to `src/`).
- Reuse `src/components/ui/*` shadcn primitives; don't hand-roll buttons/inputs/dialogs.
- Style with theme tokens (`bg-background`, `text-foreground`, `text-primary`,
  `text-muted-foreground`, `border-border`, etc.) so light/dark both work. Default
  theme is **dark** (`ThemeProvider defaultTheme="dark"`, key `vite-ui-theme`).
- **Dark-mode accent is orange + amber.** In `index.css` the `.dark` tokens set
  `--primary`/`--chart-1`/`--sidebar-primary` to orange and `--ring`/`--chart-2` to
  amber (light mode `:root` stays neutral). Prefer the `primary`/`ring` tokens for
  accents so they pick this up automatically. Any hardcoded `bg-blue-*`/`text-blue-*`
  must carry a `dark:` orange/amber override (e.g. status `review` →
  `dark:bg-orange-500`, priority `medium` → `dark:bg-amber-500`, links →
  `dark:text-amber-400`) — no literal blue should appear in dark mode.
- **Typography:** body & UI use **JetBrains Mono** (`--font-sans`/`--font-mono`,
  applied to `body`); headings (`h1`–`h6`) use **Special Gothic Expanded One**
  (`--font-display`). For non-heading elements that should use the display face
  (wordmarks, big numbers, shadcn `CardTitle` which renders as a `div`), add the
  `font-display` utility. Fonts load from Google Fonts in `index.html`.
- **Sharp corners everywhere.** The radius tokens are `0` and a base rule in
  `index.css` forces `border-radius: 0 !important` on all elements, so don't add
  `rounded-*` utilities expecting them to show — they're intentionally overridden.
- **Animation:** use `framer-motion` for *subtle* motion only (short distances,
  gentle easing, scroll reveals with `viewport={{ once: true }}`). See
  `pages/Landing.tsx` for the `fadeUp` / `stagger` variant pattern. Don't animate
  the data-heavy dashboards.
- Icons from `lucide-react`.
- Use `toast` from `@/components/ui/sonner` for user feedback.
- **Data mutations are optimistic, not refetch-based.** The context CRUD functions
  update local state and return the affected entity (or a boolean for deletes). After
  a mutation, update the page's local list from that return value — do **not** trigger
  a full `refreshMembers()` / `getTasks()` refetch (the prod backend cold-starts, so a
  blocking refetch is slow). Always show a per-action loading spinner (`Loader2`) and
  disable the button while a request is in flight; for `AlertDialog` actions, call
  `e.preventDefault()` so the dialog stays open until the request resolves.
- **Task status is editable inline.** On the task board the status `Badge` is a
  `DropdownMenu` (when `canManage`) — picking a status calls `updateTask({ status })`.
  No need to open the edit dialog just to change status. See `TaskCard` in
  `MemberDetail.tsx` (admin) and `TaskDetails.tsx` (member).
- **`MemberDetail` header** consolidates admin actions into a single "Actions"
  `DropdownMenu` (this member's attendance, all-members attendance, theme toggle via
  `useTheme`, logout) instead of scattered header buttons.
- API base URL must come from `import.meta.env.VITE_API_URL` (set `VITE_API_URL` in
  the environment / Vercel). Don't hardcode backend URLs.

## Deployment

Configured for **Vercel** (`vercel.json` rewrites all paths to `/index.html` for SPA
client-side routing).
</content>
</invoke>
