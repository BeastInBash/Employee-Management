import request from "supertest";
import { Prisma, ScopeRole } from "@prisma/client";
import { prismaMock } from "./singleton";
import { createTestApp } from "./testApp";
import { authHeader, ADMIN, MEMBER, makeTask } from "./helpers";
import { sendScopeNotices } from "../src/utils/email";

const noticesMock = sendScopeNotices as jest.Mock;

const app = createTestApp();

// UUIDs because the zod schemas validate them.
const WS = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const TEAM = "33333333-3333-4333-8333-333333333333";
const MY_SEAT = "44444444-4444-4444-8444-444444444444";
const OTHER_SEAT = "55555555-5555-4555-8555-555555555555";

const memberRow = (id: string, name = "Someone") => ({
  id,
  userId: `user-${id}`,
  email: `${id}@example.com`,
  role: "Engineer",
  user: { name },
});

type Standing = "admin" | "lead" | "member" | "outsider";

/**
 * Program the lookups `utils/access` performs so the caller has the given
 * standing on PROJECT / TEAM inside workspace WS.
 */
function standAs(standing: Standing) {
  prismaMock.project.findUnique.mockResolvedValue({ id: PROJECT, workspaceId: WS } as any);
  prismaMock.team.findUnique.mockResolvedValue({ id: TEAM, workspaceId: WS, name: "Design", color: null } as any);
  prismaMock.workspace.findUnique.mockResolvedValue({ id: WS, orgId: "org-1" } as any);
  prismaMock.organization.findUnique.mockResolvedValue({
    ownerId: standing === "admin" ? ADMIN.userId : "someone-else",
  } as any);
  prismaMock.orgMembership.findUnique.mockResolvedValue(null);
  prismaMock.member.findFirst.mockResolvedValue(
    standing === "admin" || standing === "outsider" ? null : ({ id: MY_SEAT } as any),
  );
  const seat =
    standing === "lead" ? { role: ScopeRole.lead } : standing === "member" ? { role: ScopeRole.member } : null;
  prismaMock.projectMember.findUnique.mockResolvedValue(seat as any);
  prismaMock.teamMember.findUnique.mockResolvedValue(seat as any);
  prismaMock.projectTeam.findFirst.mockResolvedValue(null);
}

const as = (s: Standing) => authHeader(s === "admin" ? ADMIN : MEMBER);

afterEach(() => {
  jest.restoreAllMocks();
});

describe("POST /api/projects", () => {
  const body = { workspaceId: WS, name: "Website relaunch", leadIds: [MY_SEAT], memberIds: [OTHER_SEAT] };

  it("only lets workspace admins create projects", async () => {
    standAs("member");
    const res = await request(app).post("/api/projects").set("Authorization", as("member")).send(body);
    expect(res.status).toBe(403);
    expect(prismaMock.project.create).not.toHaveBeenCalled();
  });

  it("rejects members from another workspace", async () => {
    standAs("admin");
    prismaMock.member.count.mockResolvedValue(1); // only 1 of the 2 ids is in WS
    const res = await request(app).post("/api/projects").set("Authorization", as("admin")).send(body);
    expect(res.status).toBe(400);
    expect(prismaMock.project.create).not.toHaveBeenCalled();
  });

  it("creates the project with lead and member seats", async () => {
    standAs("admin");
    prismaMock.member.count.mockResolvedValue(2);
    prismaMock.project.create.mockResolvedValue({
      id: PROJECT,
      name: body.name,
      description: null,
      status: "active",
      color: null,
      startDate: null,
      dueDate: null,
      workspaceId: WS,
      createdById: ADMIN.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      members: [
        { role: ScopeRole.lead, member: memberRow(MY_SEAT, "Lead Person") },
        { role: ScopeRole.member, member: memberRow(OTHER_SEAT) },
      ],
      teams: [],
    } as any);

    const res = await request(app).post("/api/projects").set("Authorization", as("admin")).send(body);

    expect(res.status).toBe(201);
    expect(res.body.project.leads).toEqual([expect.objectContaining({ id: MY_SEAT, name: "Lead Person" })]);
    expect(res.body.project.memberCount).toBe(2);
    const created = prismaMock.project.create.mock.calls[0]![0] as any;
    expect(created.data.members.create).toEqual([
      { memberId: MY_SEAT, role: ScopeRole.lead },
      { memberId: OTHER_SEAT, role: ScopeRole.member },
    ]);
    // Both people are told, the lead with a lead email.
    expect(noticesMock.mock.calls[0]![0]).toEqual([
      expect.objectContaining({ to: `${MY_SEAT}@example.com`, role: "lead", event: "added" }),
      expect.objectContaining({ to: `${OTHER_SEAT}@example.com`, role: "member", event: "added" }),
    ]);
  });

  it("doesn't email the person who made the change", async () => {
    standAs("admin");
    prismaMock.member.count.mockResolvedValue(1);
    prismaMock.project.create.mockResolvedValue({
      id: PROJECT,
      name: "Solo",
      description: null,
      status: "active",
      color: null,
      startDate: null,
      dueDate: null,
      workspaceId: WS,
      createdById: ADMIN.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      // The admin seated themselves.
      members: [{ role: ScopeRole.lead, member: { ...memberRow(MY_SEAT), userId: ADMIN.userId } }],
      teams: [],
    } as any);

    await request(app)
      .post("/api/projects")
      .set("Authorization", as("admin"))
      .send({ workspaceId: WS, name: "Solo", leadIds: [MY_SEAT] });
    expect(noticesMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/projects/:projectId", () => {
  it("403s someone with no seat on the project", async () => {
    standAs("outsider");
    const res = await request(app).get(`/api/projects/${PROJECT}`).set("Authorization", as("outsider"));
    expect(res.status).toBe(403);
  });

  it("404s an unknown project", async () => {
    standAs("admin");
    prismaMock.project.findUnique.mockResolvedValue(null);
    const res = await request(app).get(`/api/projects/${PROJECT}`).set("Authorization", as("admin"));
    expect(res.status).toBe(404);
  });
});

describe("project seats", () => {
  it("lets a lead add a regular member", async () => {
    standAs("lead");
    prismaMock.member.count.mockResolvedValue(1);
    prismaMock.projectMember.create.mockResolvedValue({
      role: ScopeRole.member,
      addedAt: new Date(),
      member: memberRow(OTHER_SEAT, "Lena Kim"),
      project: { name: "Relaunch" },
    } as any);
    prismaMock.user.findUnique.mockResolvedValue({ name: "Marco Ruiz" } as any);

    const res = await request(app)
      .post(`/api/projects/${PROJECT}/members`)
      .set("Authorization", as("lead"))
      .send({ memberId: OTHER_SEAT });

    expect(res.status).toBe(201);
    expect(res.body.member).toEqual(expect.objectContaining({ id: OTHER_SEAT, projectRole: "member" }));
    expect(noticesMock).toHaveBeenCalledWith([
      expect.objectContaining({
        to: `${OTHER_SEAT}@example.com`,
        name: "Lena Kim",
        kind: "project",
        scopeName: "Relaunch",
        role: "member",
        event: "added",
        byName: "Marco Ruiz",
        path: `/projects/${PROJECT}`,
      }),
    ]);
  });

  it("doesn't let a lead appoint another lead", async () => {
    standAs("lead");
    const res = await request(app)
      .post(`/api/projects/${PROJECT}/members`)
      .set("Authorization", as("lead"))
      .send({ memberId: OTHER_SEAT, role: "lead" });
    expect(res.status).toBe(403);
    expect(prismaMock.projectMember.create).not.toHaveBeenCalled();
  });

  it("doesn't let a regular member add people", async () => {
    standAs("member");
    const res = await request(app)
      .post(`/api/projects/${PROJECT}/members`)
      .set("Authorization", as("member"))
      .send({ memberId: OTHER_SEAT });
    expect(res.status).toBe(403);
  });

  it("maps a duplicate seat to 409", async () => {
    standAs("admin");
    prismaMock.member.count.mockResolvedValue(1);
    prismaMock.projectMember.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6" }),
    );
    const res = await request(app)
      .post(`/api/projects/${PROJECT}/members`)
      .set("Authorization", as("admin"))
      .send({ memberId: OTHER_SEAT });
    expect(res.status).toBe(409);
  });

  it("doesn't let a lead remove another lead", async () => {
    standAs("lead");
    // First lookup: caller's own seat (lead). Second: the target's seat (also lead).
    prismaMock.projectMember.findUnique.mockResolvedValue({ role: ScopeRole.lead } as any);
    const res = await request(app)
      .delete(`/api/projects/${PROJECT}/members/${OTHER_SEAT}`)
      .set("Authorization", as("lead"));
    expect(res.status).toBe(403);
    expect(prismaMock.projectMember.delete).not.toHaveBeenCalled();
  });

  it("emails a member when an admin promotes them, but not on a no-op save", async () => {
    standAs("admin");
    prismaMock.user.findUnique.mockResolvedValue({ name: "Sam Admin" } as any);
    prismaMock.projectMember.update.mockResolvedValue({
      role: ScopeRole.lead,
      member: memberRow(OTHER_SEAT, "Lena Kim"),
      project: { name: "Relaunch" },
    } as any);

    // First call: the seat was a member → promotion → one email.
    prismaMock.projectMember.findUnique.mockResolvedValueOnce({ role: ScopeRole.member } as any);
    await request(app)
      .patch(`/api/projects/${PROJECT}/members/${OTHER_SEAT}`)
      .set("Authorization", as("admin"))
      .send({ role: "lead" });
    expect(noticesMock).toHaveBeenCalledTimes(1);
    expect(noticesMock.mock.calls[0]![0][0]).toEqual(expect.objectContaining({ event: "promoted", role: "lead" }));

    // Second call: already a lead → nothing new to say.
    prismaMock.projectMember.findUnique.mockResolvedValueOnce({ role: ScopeRole.lead } as any);
    await request(app)
      .patch(`/api/projects/${PROJECT}/members/${OTHER_SEAT}`)
      .set("Authorization", as("admin"))
      .send({ role: "lead" });
    expect(noticesMock).toHaveBeenCalledTimes(1);
  });

  it("only lets admins promote to lead", async () => {
    standAs("lead");
    const res = await request(app)
      .patch(`/api/projects/${PROJECT}/members/${OTHER_SEAT}`)
      .set("Authorization", as("lead"))
      .send({ role: "lead" });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/projects/:projectId/tasks", () => {
  const task = {
    title: "Draft homepage copy",
    description: "First pass at the hero and features sections",
    dueDate: "2026-12-01T00:00:00.000Z",
  };

  it("stops a regular member from assigning work to someone else", async () => {
    standAs("member");
    const res = await request(app)
      .post(`/api/projects/${PROJECT}/tasks`)
      .set("Authorization", as("member"))
      .send({ ...task, memberId: OTHER_SEAT });
    expect(res.status).toBe(403);
    expect(prismaMock.task.create).not.toHaveBeenCalled();
  });

  it("rejects an assignee who isn't on the project", async () => {
    standAs("lead");
    prismaMock.projectMember.findMany.mockResolvedValue([{ memberId: MY_SEAT }] as any);
    prismaMock.teamMember.findMany.mockResolvedValue([]);
    const res = await request(app)
      .post(`/api/projects/${PROJECT}/tasks`)
      .set("Authorization", as("lead"))
      .send({ ...task, memberId: OTHER_SEAT });
    expect(res.status).toBe(400);
  });

  it("lets a lead assign to someone on an assigned team, without touching their attendance", async () => {
    standAs("lead");
    prismaMock.projectMember.findMany.mockResolvedValue([{ memberId: MY_SEAT }] as any);
    prismaMock.teamMember.findMany.mockResolvedValue([{ memberId: OTHER_SEAT }] as any);
    prismaMock.task.create.mockResolvedValue({
      ...makeTask({ memberId: OTHER_SEAT, projectId: PROJECT }),
      member: memberRow(OTHER_SEAT, "Teammate"),
      project: { id: PROJECT, name: "Website relaunch", color: null },
    } as any);

    const res = await request(app)
      .post(`/api/projects/${PROJECT}/tasks`)
      .set("Authorization", as("lead"))
      .send({ ...task, memberId: OTHER_SEAT });

    expect(res.status).toBe(201);
    expect(res.body.task.assignee).toEqual(expect.objectContaining({ id: OTHER_SEAT, name: "Teammate" }));
    expect(prismaMock.dailyAttendance.upsert).not.toHaveBeenCalled();
  });

  it("applies the workspace task window to a member's own submission", async () => {
    standAs("member");
    prismaMock.projectMember.findMany.mockResolvedValue([{ memberId: MY_SEAT }] as any);
    prismaMock.teamMember.findMany.mockResolvedValue([]);
    // A one-minute window 12 hours from now (IST) is guaranteed to be closed.
    const nowIST = (new Date().getUTCHours() * 60 + new Date().getUTCMinutes() + 330) % 1440;
    const start = (nowIST + 720) % 1440;
    prismaMock.workspace.findUnique.mockResolvedValue({
      id: WS,
      orgId: "org-1",
      taskWindowEnabled: true,
      taskWindowStart: start,
      taskWindowEnd: (start + 1) % 1440,
    } as any);

    const res = await request(app).post(`/api/projects/${PROJECT}/tasks`).set("Authorization", as("member")).send(task);

    expect(res.status).toBe(403);
    expect(res.body.taskWindow).toEqual(expect.objectContaining({ enabled: true, open: false }));
    expect(prismaMock.task.create).not.toHaveBeenCalled();
  });
});

describe("existing task routes honour project leads", () => {
  it("lets a project lead update a teammate's project task", async () => {
    standAs("lead");
    const projectTask = {
      ...makeTask({ projectId: PROJECT }),
      member: { id: OTHER_SEAT, userId: "someone-else", email: "x@example.com" },
    };
    prismaMock.task.findUnique.mockResolvedValue(projectTask as any);
    prismaMock.task.update.mockResolvedValue({ ...projectTask, priority: "high" } as any);

    const res = await request(app)
      .patch("/api/tasks/task-1")
      .set("Authorization", as("lead"))
      .send({ priority: "high" });

    expect(res.status).toBe(200);
    expect(prismaMock.task.update).toHaveBeenCalled();
  });

  it("still blocks a regular project member from editing a teammate's task", async () => {
    standAs("member");
    prismaMock.task.findUnique.mockResolvedValue({
      ...makeTask({ projectId: PROJECT }),
      member: { id: OTHER_SEAT, userId: "someone-else", email: "x@example.com" },
    } as any);

    const res = await request(app)
      .patch("/api/tasks/task-1")
      .set("Authorization", as("member"))
      .send({ priority: "high" });

    expect(res.status).toBe(403);
    expect(prismaMock.task.update).not.toHaveBeenCalled();
  });
});

describe("teams", () => {
  it("only lets admins create teams", async () => {
    standAs("lead");
    const res = await request(app)
      .post("/api/teams")
      .set("Authorization", as("lead"))
      .send({ workspaceId: WS, name: "Design" });
    expect(res.status).toBe(403);
  });

  it("lets a team lead add a member but not a lead", async () => {
    standAs("lead");
    prismaMock.member.count.mockResolvedValue(1);
    prismaMock.teamMember.create.mockResolvedValue({
      role: ScopeRole.member,
      joinedAt: new Date(),
      member: memberRow(OTHER_SEAT),
      team: { name: "Design" },
    } as any);

    const ok = await request(app)
      .post(`/api/teams/${TEAM}/members`)
      .set("Authorization", as("lead"))
      .send({ memberId: OTHER_SEAT });
    expect(ok.status).toBe(201);

    const denied = await request(app)
      .post(`/api/teams/${TEAM}/members`)
      .set("Authorization", as("lead"))
      .send({ memberId: OTHER_SEAT, role: "lead" });
    expect(denied.status).toBe(403);
  });

  it("only lets admins delete a team", async () => {
    standAs("lead");
    const res = await request(app).delete(`/api/teams/${TEAM}`).set("Authorization", as("lead"));
    expect(res.status).toBe(403);
    expect(prismaMock.team.delete).not.toHaveBeenCalled();
  });

  it("validates the payload", async () => {
    standAs("admin");
    const res = await request(app)
      .post("/api/teams")
      .set("Authorization", as("admin"))
      .send({ workspaceId: "not-a-uuid", name: "D" });
    expect(res.status).toBe(400);
  });
});
