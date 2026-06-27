# ReBAC.md — Relationship-Based Access Control Design Guide

A design guide (not an implementation) for adding **Organizations → Workspaces → Members**
with granular **view / edit / delete** access to the Task Tracker backend.

> This document only describes *how* to build it. No production code is added here. Schema
> sketches and pseudocode below are illustrations to anchor the design, not drop-in files.

---

## 1. What we want

```
User (login identity)
  └── creates / belongs to → Organization
                               └── has many → Workspaces
                                                └── has many → Members (Users)
```

Requirements:

- A user logs in, then **creates an Organization** (becomes its owner).
- An org has **multiple Workspaces**.
- A user can be a **Member of one or many Workspaces** (and of one or many Orgs).
- Per workspace (and ideally per resource), a member can have **view / edit / delete**
  access — i.e. fine-grained permissions, not just one global role.

This is fundamentally a **graph of relationships** between *subjects* (users) and *objects*
(orgs, workspaces, tasks). That is exactly what **ReBAC** models.

---

## 2. RBAC vs ReBAC — pick the right model

| | RBAC (what you have now) | ReBAC (what you want) |
|---|---|---|
| Question it answers | "What **role** does this user have?" | "What **relationship** does this user have *to this object*?" |
| Permission source | A global `role` column on the user | An edge in a relationship graph: `(user) —[relation]→ (object)` |
| Scope | App-wide (`admin` / `member`) | Per-object (this workspace, this task) |
| Multi-tenant | Awkward — one role can't differ per workspace | Natural — different access per workspace |
| Inspiration | Classic roles | Google **Zanzibar** ("user U is `editor` of doc D") |

Your current `User.role = admin | member` is RBAC and is **app-global**. It can't express
"Alice can edit Workspace A but only view Workspace B." ReBAC can, because permission lives
on the **membership edge**, not on the user.

**Recommendation:** keep `User.role` for *platform-level* concerns (e.g. a super-admin), but
introduce a **membership table** that carries the per-workspace permissions. This is a
pragmatic ReBAC — sometimes called "scoped RBAC" — and is the right amount of complexity for
this app. Full Zanzibar (a separate tuple store + relation-rewrite engine) is overkill here.

---

## 3. The relationship graph

```
        ┌────────────┐   owner / admin / member        ┌──────────────┐
   User │  Membership ├────────────────────────────────►│ Organization │
        └────────────┘                                  └──────┬───────┘
              │                                                 │ has many
              │ user can also be a member of                    ▼
              │ individual workspaces                    ┌──────────────┐
              └─────────────────────────────────────────►│  Workspace   │
                        WorkspaceMembership               └──────┬───────┘
                        (view / edit / delete)                   │ has many
                                                                 ▼
                                                          ┌──────────────┐
                                                          │     Task     │
                                                          └──────────────┘
```

Two relationship edges do the work:

1. **OrgMembership** — user ↔ organization, with an org-level role (`owner`, `admin`, `member`).
2. **WorkspaceMembership** — user ↔ workspace, with the granular permissions
   (`canView`, `canEdit`, `canDelete`) — or a workspace role that maps to those.

Because membership is a *join table*, a user can have **many** WorkspaceMemberships → they
belong to many workspaces, each with its own permission set. One row = one workspace = "only
one workspace" is also naturally supported.

---

## 4. Modeling permissions: two viable shapes

### Option A — Role per workspace (simpler, recommended to start)

Define named workspace roles and map each to a permission set in code:

```
WorkspaceRole = viewer | editor | admin
  viewer → { view }
  editor → { view, edit }
  admin  → { view, edit, delete, manage_members }
```

- **Pro:** few rows to reason about, easy UI ("invite as Editor"), matches user intuition.
- **Con:** less flexible if you later need odd combos (e.g. delete-but-not-edit).

### Option B — Explicit permission flags / set (more flexible)

Store the capabilities directly on the membership: `canView`, `canEdit`, `canDelete`
(booleans) or a `permissions String[]` array.

- **Pro:** arbitrary combinations; future-proof.
- **Con:** more surface area; UI must present individual toggles.

**Recommendation:** Start with **Option A (roles)** and derive the boolean capabilities from
the role in one central place. You can migrate to Option B later without changing call sites
if every permission check goes through a single helper (see §7). The two are not mutually
exclusive — a role *is* just a named bundle of permissions.

---

## 5. Schema sketch (Prisma)

Illustrative only — adapt names/migrations to your conventions. New models in **bold** idea:

```prisma
model Organization {
  id        String   @id @default(uuid())
  name      String
  ownerId   String                 // the User who created it
  createdAt DateTime @default(now())

  memberships OrgMembership[]
  workspaces  Workspace[]

  @@map("organizations")
}

enum OrgRole { owner admin member }

model OrgMembership {
  id     String  @id @default(uuid())
  userId String
  orgId  String
  role   OrgRole @default(member)

  user User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  org  Organization @relation(fields: [orgId],  references: [id], onDelete: Cascade)

  @@unique([userId, orgId])         // one membership per (user, org)
  @@map("org_memberships")
}

model Workspace {
  id        String   @id @default(uuid())
  name      String
  orgId     String
  createdAt DateTime @default(now())

  org         Organization          @relation(fields: [orgId], references: [id], onDelete: Cascade)
  memberships WorkspaceMembership[]
  // tasks    Task[]                 // see §8 — Task gets a workspaceId

  @@map("workspaces")
}

enum WorkspaceRole { admin editor viewer }

model WorkspaceMembership {
  id          String        @id @default(uuid())
  userId      String
  workspaceId String
  role        WorkspaceRole @default(viewer)

  // Option B alternative to `role`:
  // canView   Boolean @default(true)
  // canEdit   Boolean @default(false)
  // canDelete Boolean @default(false)

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([userId, workspaceId])   // a user appears once per workspace
  @@map("workspace_memberships")
}
```

Key invariants:

- `@@unique([userId, orgId])` and `@@unique([userId, workspaceId])` prevent duplicate edges.
- `onDelete: Cascade` cleans up memberships when an org/workspace/user is deleted.
- A user with **zero** WorkspaceMemberships sees no workspaces; with **many**, they see many
  — both "one workspace" and "multiple workspaces" fall out for free.

> **Migration note:** your existing `Member` model is a per-user "team membership" tied 1:1 to
> a User (`userId @unique`). It overlaps conceptually with `WorkspaceMembership`. Decide
> whether to (a) repurpose `Member` into `WorkspaceMembership`, or (b) keep `Member` for the
> attendance domain and layer the new tables alongside. See §8.

---

## 6. The permission hierarchy (inheritance)

Permissions should **flow down** the graph so you don't re-grant everything everywhere:

```
Org owner/admin  ──►  implicit admin on every workspace in the org
Workspace admin  ──►  full control of that workspace's resources (tasks)
Workspace editor ──►  view + edit tasks, cannot delete workspace
Workspace viewer ──►  read-only
```

A permission check therefore resolves in order:

1. Is the user the **org owner** (or org admin)? → allow.
2. Else, does the user have a **WorkspaceMembership** whose role grants the needed capability?
3. Else → deny.

This "check the broadest relationship first, then narrow" is the core ReBAC evaluation loop.

---

## 7. Enforcement: one resolver, used everywhere

The single most important design rule: **all access decisions go through one function.**
Scatter `if (role === 'admin')` checks and you'll have security holes. Centralize:

```
// pseudocode — the only place that knows the permission rules
async function can(userId, action, resource): boolean
//   action   = 'view' | 'edit' | 'delete' | 'manage_members'
//   resource = { type: 'workspace' | 'task' | 'org', id }

// 1. resolve the resource up to its workspace + org
// 2. load the user's OrgMembership and WorkspaceMembership for that scope
// 3. apply the hierarchy from §6
// 4. map role → capability and return true/false
```

Then express it as **Express middleware** so routes stay declarative:

```
router.delete('/tasks/:taskId',
  authenticate,
  authorize('delete', 'task'),   // 403 if can(...) is false
  deleteTaskController)
```

Where `authorize(action, type)` reads the resource id from params, calls `can(...)`, and
either `next()`s or returns `403`. This mirrors how your current `requireAdmin` /
`canManageTask` middleware works — you're generalizing it from "role" to "relationship."

Guidelines:

- **Always check on the server.** Client-side hiding of buttons is UX, not security.
- **Resolve the scope from the resource, not from the request body** — never trust a
  `workspaceId` the client claims; look up the task's real workspace.
- **Default deny.** Unknown action or missing membership → `false`.
- Add a **DB index** on the membership lookups (`@@unique` already gives you one) since
  `can()` runs on most requests; consider caching the membership per-request on `req`.

---

## 8. How this lands on the *existing* app

Your current domain (Task / DailyAttendance / Member) is **flat** — tasks belong to a Member,
not a workspace. To introduce workspaces you must decide where tasks live:

- **Add `workspaceId` to `Task`** so every task belongs to a workspace. Attendance, which is
  derived from tasks, then becomes per-workspace too (or you scope it however the product
  wants). This is the biggest ripple and should be planned deliberately.
- **`Member` vs `WorkspaceMembership`:** the cleanest long-term move is to treat
  `WorkspaceMembership` as the real "who is in this team" edge and reduce `Member` to either
  (a) an alias that maps onto it, or (b) keep `Member` solely as the attendance subject. Don't
  do both half-way — pick one to avoid two competing sources of truth.
- **`userId` gotcha still applies:** task/attendance endpoints key off the **User** id, not a
  membership row id (see root `CLAUDE.md`). Keep that consistent in the new membership lookups.
- **JWT stays thin:** do *not* bake the full permission set into the token (workspaces and
  roles change; 7-day tokens would go stale). Keep `{ userId, email }` in the JWT and resolve
  memberships from the DB per request inside `can()`. Optionally include the user's *current*
  `activeOrgId` for convenience, but treat it as a hint, not authority.

Migration sequence (suggested):

1. Add `Organization`, `OrgMembership`, `Workspace`, `WorkspaceMembership` tables.
2. Backfill: create one Org + one Workspace per existing admin, and a membership row per
   existing Member, mapping their old role to a workspace role.
3. Add `workspaceId` to `Task` (and attendance if scoping it); backfill from the member's
   workspace.
4. Introduce the `can()` resolver + `authorize()` middleware.
5. Replace `requireAdmin` / `canManageTask` / `canViewMemberTasks` call sites with
   `authorize(...)`, one route at a time.
6. Update the client contexts to fetch "my workspaces" and gate UI by returned capabilities.

---

## 9. API surface this implies (sketch)

```
POST   /api/orgs                      create org (caller becomes owner)
GET    /api/orgs                      orgs the caller belongs to
POST   /api/orgs/:orgId/workspaces    create workspace (org admin+)
GET    /api/orgs/:orgId/workspaces    workspaces caller can see

POST   /api/workspaces/:id/members    add user to workspace with a role   (workspace admin)
PATCH  /api/workspaces/:id/members/:userId   change a member's role        (workspace admin)
DELETE /api/workspaces/:id/members/:userId   remove a member               (workspace admin)
GET    /api/workspaces/:id/members            list members + roles

# existing task/attendance routes now scoped by workspace and gated by authorize()
```

Each mutating route is wrapped in `authorize(action, type)` from §7.

---

## 10. Build it yourself vs. use a library

- **Roll your own (recommended here):** the scoped-RBAC design above is a few tables + one
  resolver. Lowest dependency, fits the existing Express/Prisma/zod stack, easy to reason about.
- **A policy library** (e.g. CASL for JS) if rules get complex and you want declarative
  abilities on the client too.
- **A Zanzibar engine** (OpenFGA, SpiceDB, Permify) only if you outgrow the DB approach —
  deeply nested groups, cross-org sharing, millions of tuples. **Not needed now**; revisit if
  relationships become genuinely graph-shaped beyond org→workspace→task.

---

## 11. Checklist before you start coding

- [ ] Decide Option A (roles) vs Option B (flags) — start with A.
- [ ] Decide the fate of the existing `Member` model (alias vs attendance-only).
- [ ] Decide whether attendance is scoped per-workspace.
- [ ] Confirm tasks get a `workspaceId` and plan the backfill.
- [ ] Define the role→capability map in one constant.
- [ ] Implement `can()` first, with the §6 hierarchy and default-deny.
- [ ] Wrap routes with `authorize()`; remove ad-hoc role checks.
- [ ] Keep JWT thin; resolve permissions from DB per request.
- [ ] Mirror the new types/enums into the client contexts (see root `CLAUDE.md` contract).
```
