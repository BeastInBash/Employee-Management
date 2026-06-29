# Schema Relations Review — Org / Workspace / Tasks / Attendance

Review of `prisma/schema.prisma` against the goal:

> An **organization** has **workspaces**. A workspace has **members and admins**. A
> workspace can **assign tasks** to its members, and **attendance** is tracked per
> workspace — i.e. the current Member → Task → Attendance logic, but wrapped inside
> an Org + Workspace.

---

## What's correct ✅

The **org/workspace tenancy backbone** is wired correctly:

- `Organization` → `OrgMembership[]` / `Workspace[]`
- `OrgMembership` → `User` + `Organization`, with `@@unique([userId, orgId])`
- `Workspace` → `Organization` + `WorkspaceMembership[]`
- `User` back-relations (`orgMemberships`, `workspaceMemberships`)
- Cascade deletes flow correctly: delete org → memberships + workspaces → workspace
  memberships

So "an org has workspaces, and a workspace has people (with roles/perms)" is modeled fine.

---

## What's missing / needs fixing ❌

### 1. `Task` and `DailyAttendance` are not connected to a Workspace (the big one)

Both still hang off `Member` only — there is **no path** from a `Workspace` to its tasks
or attendance, so a workspace cannot own or scope a task.

```prisma
model Task {
    memberId String
    member   Member @relation(...)   // ← no workspaceId
}
model DailyAttendance {
    memberId String
    member   Member @relation(...)   // ← no workspaceId
}
```

**Fix:** give tasks/attendance a workspace scope (directly, or transitively via a
workspace-scoped `Member` — see option A below).

### 2. Two disconnected "membership" concepts

- **`Member`** — old: admin-created team member, owns tasks/attendance, linked by
  `createdById`.
- **`WorkspaceMembership`** — new: User↔Workspace edge with perms.

They never reference each other. So "the member of a workspace" (`WorkspaceMembership`) is
a *different object* from "the Member that has tasks" (`Member`). You can't currently
express "this workspace member's tasks."

**Fix:** pick one source of truth (see options below).

### 3. `WorkspaceMembership.workspaceId` is nullable

```prisma
workspaceId String?
workspace   Workspace? @relation(...)
```

A workspace membership with no workspace is meaningless, and it weakens
`@@unique([userId, workspaceId])` (Postgres treats NULLs as distinct, so a user could get
many null-workspace rows).

**Fix:** make it required (`String` / non-optional relation).

### 4. Owner FKs are bare strings (no relations)

`Organization.ownerId` and `Workspace` (no owner field) have no `@relation` to `User`.
Not breaking, but you lose referential integrity and convenient includes.

**Fix (optional):** add proper `owner User @relation(...)` fields.

### 5. Permission defaults are wide-open

`WorkspaceMembership.canView / canEdit / canDelete` all default to `true` (ReBAC.md wants
default-deny). Not a relation issue, but flagging it as part of the same work.

---

## Two ways to reconcile Member vs WorkspaceMembership

### Option A — scope `Member` to a workspace (least churn, keeps existing task logic)

Add `workspaceId` to `Member`. A Member becomes "a person's seat in one workspace," and
their tasks/attendance come along automatically. A user with seats in 3 workspaces = 3
Member rows. `WorkspaceMembership` can stay purely for permissions/roles (or be folded in).

```prisma
model Member {
    id          String   @id @default(uuid())
    role        String
    email       String
    userId      String
    user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
    createdAt   DateTime @default(now())
    createdById String?
    createdBy   User?    @relation("CreatedMembers", fields: [createdById], references: [id])

    workspaceId String                                                                  // NEW
    workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade) // NEW

    tasks      Task[]
    attendance DailyAttendance[]

    @@unique([userId, workspaceId])   // CHANGED: was `userId @unique` — one seat per workspace
    @@map("members")
}

model Workspace {
    // ...existing...
    members     Member[]              // NEW back-relation
}
```

`Task` and `DailyAttendance` then inherit their workspace through `Member.workspaceId` — no
change to those models, and `createTask` / the attendance cron keep working, just
workspace-scoped.

**Trade-off:** `Member.userId` is no longer globally unique (a user can be a member of
multiple workspaces).

### Option B — collapse `Member` into `WorkspaceMembership` (cleaner ReBAC, bigger refactor)

Drop `Member`; hang tasks/attendance off `WorkspaceMembership` (or off `(workspaceId,
userId)` directly). Single membership entity, but requires rewriting the task/attendance
controllers and the cron.

---

## Checklist of things to implement

- [x] Decide: **Option A** (scope `Member`) — chosen.
- [x] Add workspace scope to tasks/attendance (via `Member.workspaceId`; tasks/attendance
      inherit their workspace through the Member).
- [x] Make `WorkspaceMembership.workspaceId` required.
- [x] Reconcile the two membership concepts so "workspace member" == "task owner"
      (`Member` is now workspace-scoped; `@@unique([userId, workspaceId])`).
- [x] Write the Prisma migration (`20260629131555_workspace_scoped_members`, applied;
      existing member backfilled to the "Tech Talk" workspace).
- [x] Update controllers/validation to be workspace-scoped:
  - `createMemberSchema` now requires `workspaceId` (uuid).
  - `createMember` verifies the workspace exists and the admin owns / is owner-admin of
    its org, scopes the "already a member" check to that workspace, and persists
    `workspaceId`.
  - Member-by-`userId` lookups switched from `findUnique` → `findFirst` in
    `tasks`, `attendance`, and `roleCheck` (since `userId` is no longer unique alone).
- [ ] (Optional) Add `owner` relations for `Organization` / `Workspace`.
- [ ] Flip permission defaults to default-deny (`false`) per `ReBAC.md`.
- [ ] Add a `can()` resolver + `authorize()` middleware (still missing per `ReBAC.md`).
- [ ] Mirror the `workspaceId` member-create field in the client.

### Known limitation introduced by `findFirst`

A user can now be a `Member` of multiple workspaces, but **member-initiated task
submission** (`POST /api/tasks` as a member) and **`GET /api/attendance/me`** resolve the
member via `findFirst({ where: { userId } })` — they pick an arbitrary workspace when the
user belongs to more than one. This preserves today's single-workspace behaviour; once
members can belong to several workspaces, these paths need a workspace selector (e.g. an
active-workspace header or route param).

### Pre-existing issues (NOT caused by this change — verified against HEAD)

- `tsc --noEmit` reports **19 errors at HEAD and 19 after this change** (no net new): loose
  `req.params` / `req.query` `string | string[]` typing in the committed controllers.
- The Jest suite fails **73/101 at HEAD and 73/101 after this change** (no net new): the
  cookie-auth refactor makes `authenticate` ignore the `Authorization` header the tests
  send. The suite can't validate this work until that's fixed.
