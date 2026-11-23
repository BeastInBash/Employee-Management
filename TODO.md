# Workzen feature roadmap

Features to build, in priority order. Tick them off as they ship. Effort is a rough estimate against the current codebase.

The order follows one idea: first make attendance **trustworthy** (it's the product's core promise), then make daily use **stick**, then make admins' lives **easy**, then **reach** people where they are, and only then **charge**.

---

## 1. Make attendance trustworthy

- [ ] **Leave and holidays** (3–4 days)
  A sick day or a public holiday currently counts as absent, so owners can't trust the numbers yet.
  - [ ] Members request leave (date range, type, optional note); admins approve or decline
  - [ ] Workspace holiday calendar (public holidays, shop closures)
  - [ ] Approved leave and holidays are excluded from attendance: the nightly job skips them and Reports, Home and the attendance pages show them as their own status
  - [ ] Leave balance per person (optional first version: just a count of days taken)

- [ ] **Working days and timezone per workspace** (2–3 days)
  IST and Monday–Friday are hard-coded, which rules out teams outside India and shops open on weekends.
  - [ ] Workspace settings: timezone, working days, settle time (today fixed at 9:00 PM IST)
  - [ ] Nightly job settles each workspace in its own timezone and skips non-working days (it currently writes "absent" for everyone on weekends)
  - [ ] "Today" boundaries use the workspace's local midnight (today tasks made 00:00–05:30 IST count toward the previous day)
  - [ ] Submission hours and reports use the workspace timezone

## 2. Make daily use stick

- [ ] **Reminders by email** (2 days)
  What keeps people coming back every day; the Resend email setup already exists.
  - [ ] Morning "plan your day" reminder for anyone with nothing planned
  - [ ] Evening "3 tasks left" reminder before the day settles
  - [ ] Weekly summary for admins
  - [ ] Per-person opt-out and a workspace-level on/off

- [ ] **Recurring tasks and templates** (2 days)
  Shops repeat the same daily jobs; retyping them every morning is the fastest way to lose people.
  - [ ] Repeat a task daily, on chosen weekdays, or weekly
  - [ ] Saved task templates ("Opening checklist") added in one click

## 3. Make admins' lives easy

- [ ] **Admin "today" overview** (1–2 days)
  One screen showing who's finished, who's behind and what's overdue across the team: the admin's version of the member Home page.

- [ ] **Admin correction of attendance** (1–2 days)
  A forgotten tick shouldn't permanently mark someone partial.
  - [ ] Change a day's status with a required reason
  - [ ] Record who changed it and when, and show it on the day

- [ ] **Bulk member import from CSV** (1 day)
  Adding 20 people one by one is a reason to give up during setup.
  - [ ] Upload, preview, fix errors, then send all invites at once

- [ ] **"Assigned by" on tasks** (1 day)
  Needs a `Task.createdById` migration.
  - [ ] Record who created each task
  - [ ] Real "Assigned to you" tile on Home (currently project tasks stand in for it)
  - [ ] Show "Assigned by Ana" on task cards and in reports

- [ ] **Comments and attachments on tasks** (2–3 days)
  Questions and photos ("done, here's the shelf") stay on the task instead of in WhatsApp.

- [ ] **Workspace switcher for members** (1 day)
  People in two shops or teams currently get one workspace picked arbitrarily for submitting tasks and for their attendance.

- [ ] **Payroll-ready monthly export** (1 day)
  Present, partial and leave days per person, formatted the way an accountant wants. Reports already exports CSV; this is mostly formatting.

## 4. Reach people where they are

- [ ] **Installable mobile app (PWA)** (1–2 days)
  Home-screen icon, app-like window, offline viewing of today's list. The site already works on phones.

- [ ] **Push notifications** (2 days)
  Web push for reminders and "new task assigned to you".

- [ ] **WhatsApp notifications** (4–5 days)
  Reaches staff in India far more reliably than email. Needs an approved WhatsApp Business provider.

- [ ] **Slack integration** (2–3 days)
  Daily digest and "new task" messages in a channel.

- [ ] **Google Calendar sync** (2–3 days)
  Task due dates on people's calendars.

## 5. Ready to charge

- [ ] **Plans and billing** (4–5 days)
  Free tier for small teams, paid seats beyond it (Stripe or Razorpay), and plan limits enforced in the API.

- [ ] **More roles** (2–3 days)
  For example a manager who sees attendance but not billing, or a read-only accountant.

- [ ] **Audit log** (2 days)
  Who added or removed people and who changed attendance. Larger customers ask for this before buying.

- [ ] **Data export and account deletion** (1–2 days)
  Download everything about a workspace or person; delete an account and its data.

## 6. Later: differentiators

- [ ] **AI daily summary for admins**: "Sam is 2 days behind on the refit; 3 people haven't planned today."
- [ ] **Workload view**: who has too much and who has room, across projects
- [ ] **Time estimates vs actuals** on tasks, for teams that bill clients by the hour
- [ ] **Public status page** for client-facing teams
- [ ] **Real testimonials and customer logos** on the landing page, once there are customers to quote
