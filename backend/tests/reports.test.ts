import request from "supertest";
import { ScopeRole, TaskStatus } from "@prisma/client";
import { prismaMock } from "./singleton";
import { createTestApp } from "./testApp";
import { authHeader, ADMIN, MEMBER } from "./helpers";
import { istDateKey } from "../src/controllers/reports.controller";

const app = createTestApp();

const WS = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const TEAM = "33333333-3333-4333-8333-333333333333";
const SEAT_A = "44444444-4444-4444-8444-444444444444";
const SEAT_B = "55555555-5555-4555-8555-555555555555";

const person = (id: string, name: string) => ({ id, userId: `user-${id}`, role: "Engineer", user: { name } });

/** Caller owns the org when admin; otherwise holds a seat with the given role. */
function standAs(standing: "admin" | "lead" | "member") {
  prismaMock.project.findUnique.mockResolvedValue({ id: PROJECT, workspaceId: WS, name: "Relaunch" } as any);
  prismaMock.team.findUnique.mockResolvedValue({ id: TEAM, workspaceId: WS, name: "Design" } as any);
  prismaMock.workspace.findUnique.mockResolvedValue({ id: WS, orgId: "org-1", name: "Agency" } as any);
  prismaMock.organization.findUnique.mockResolvedValue({
    ownerId: standing === "admin" ? ADMIN.userId : "someone-else",
  } as any);
  prismaMock.orgMembership.findUnique.mockResolvedValue(null);
  prismaMock.member.findFirst.mockResolvedValue(standing === "admin" ? null : ({ id: SEAT_A } as any));
  const seat =
    standing === "lead" ? { role: ScopeRole.lead } : standing === "member" ? { role: ScopeRole.member } : null;
  prismaMock.projectMember.findUnique.mockResolvedValue(seat as any);
  prismaMock.teamMember.findUnique.mockResolvedValue(seat as any);
  prismaMock.projectTeam.findFirst.mockResolvedValue(null);
}

/** Empty data so access tests don't trip over unprogrammed queries. */
function noData() {
  prismaMock.member.findMany.mockResolvedValue([]);
  prismaMock.task.findMany.mockResolvedValue([]);
  (prismaMock.task.groupBy as jest.Mock).mockResolvedValue([]);
  prismaMock.dailyAttendance.findMany.mockResolvedValue([]);
  prismaMock.projectMember.findMany.mockResolvedValue([]);
  prismaMock.teamMember.findMany.mockResolvedValue([]);
}

const range = "from=2026-10-19&to=2026-10-25";

afterEach(() => {
  jest.restoreAllMocks();
});

describe("istDateKey", () => {
  it("rolls UTC evenings into the next IST day", () => {
    expect(istDateKey(new Date("2026-10-19T18:29:00Z"))).toBe("2026-10-19");
    expect(istDateKey(new Date("2026-10-19T18:30:00Z"))).toBe("2026-10-20");
  });
});

describe("GET /api/reports access", () => {
  it("only lets admins see a workspace report", async () => {
    standAs("lead");
    noData();
    const res = await request(app)
      .get(`/api/reports?scope=workspace&id=${WS}&${range}`)
      .set("Authorization", authHeader(MEMBER));
    expect(res.status).toBe(403);
  });

  it("lets a project lead see their project's report", async () => {
    standAs("lead");
    noData();
    const res = await request(app)
      .get(`/api/reports?scope=project&id=${PROJECT}&${range}`)
      .set("Authorization", authHeader(MEMBER));
    expect(res.status).toBe(200);
    expect(res.body.scope).toEqual({ type: "project", id: PROJECT, name: "Relaunch" });
  });

  it("keeps a regular member out of project and team reports", async () => {
    standAs("member");
    noData();
    const p = await request(app)
      .get(`/api/reports?scope=project&id=${PROJECT}&${range}`)
      .set("Authorization", authHeader(MEMBER));
    const t = await request(app)
      .get(`/api/reports?scope=team&id=${TEAM}&${range}`)
      .set("Authorization", authHeader(MEMBER));
    expect(p.status).toBe(403);
    expect(t.status).toBe(403);
  });

  it("lets anyone with a seat see their own report", async () => {
    noData();
    prismaMock.member.findMany.mockResolvedValueOnce([{ id: SEAT_A }] as any);
    const res = await request(app).get(`/api/reports?scope=me&${range}`).set("Authorization", authHeader(MEMBER));
    expect(res.status).toBe(200);
  });

  it("rejects bad ranges", async () => {
    const backwards = await request(app)
      .get("/api/reports?scope=me&from=2026-10-25&to=2026-10-01")
      .set("Authorization", authHeader(MEMBER));
    const tooLong = await request(app)
      .get("/api/reports?scope=me&from=2024-01-01&to=2026-01-01")
      .set("Authorization", authHeader(MEMBER));
    const badDate = await request(app)
      .get("/api/reports?scope=me&from=yesterday&to=2026-01-01")
      .set("Authorization", authHeader(MEMBER));
    expect([backwards.status, tooLong.status, badDate.status]).toEqual([400, 400, 400]);
  });
});

describe("GET /api/reports metrics", () => {
  beforeEach(() => {
    standAs("admin");
    noData();
    prismaMock.member.findMany.mockResolvedValue([person(SEAT_A, "Ada"), person(SEAT_B, "Ben")] as any);
    prismaMock.task.findMany.mockImplementation((async (args: any) => {
      if (args.where.createdAt) {
        return [
          { memberId: SEAT_A, createdAt: new Date("2026-10-20T04:00:00Z"), status: TaskStatus.completed },
          { memberId: SEAT_A, createdAt: new Date("2026-10-20T05:00:00Z"), status: TaskStatus.todo },
          { memberId: SEAT_B, createdAt: new Date("2026-10-21T04:00:00Z"), status: TaskStatus.completed },
          // 19:00 UTC on the 21st is the 22nd in IST.
          { memberId: SEAT_B, createdAt: new Date("2026-10-21T19:00:00Z"), status: TaskStatus.completed },
        ];
      }
      return [
        // Ada: done 10h after creation, before the due date.
        {
          memberId: SEAT_A,
          createdAt: new Date("2026-10-20T04:00:00Z"),
          completedAt: new Date("2026-10-20T14:00:00Z"),
          dueDate: new Date("2026-10-20T18:29:59Z"),
        },
        // Ben: one late (done after due), one on time.
        {
          memberId: SEAT_B,
          createdAt: new Date("2026-10-21T04:00:00Z"),
          completedAt: new Date("2026-10-23T04:00:00Z"),
          dueDate: new Date("2026-10-21T18:29:59Z"),
        },
        {
          memberId: SEAT_B,
          createdAt: new Date("2026-10-21T19:00:00Z"),
          completedAt: new Date("2026-10-22T05:00:00Z"),
          dueDate: new Date("2026-10-23T18:29:59Z"),
        },
      ];
    }) as any);
    (prismaMock.task.groupBy as jest.Mock).mockResolvedValue([{ memberId: SEAT_A, _count: { _all: 2 } }]);
    prismaMock.dailyAttendance.findMany.mockResolvedValue([
      { memberId: SEAT_A, date: new Date("2026-10-20T00:00:00Z"), status: "present" },
      { memberId: SEAT_A, date: new Date("2026-10-21T00:00:00Z"), status: "partial" },
      { memberId: SEAT_B, date: new Date("2026-10-20T00:00:00Z"), status: "absent" },
      { memberId: SEAT_B, date: new Date("2026-10-21T00:00:00Z"), status: "present" },
      // Saturday the 24th — excluded by default.
      { memberId: SEAT_A, date: new Date("2026-10-24T00:00:00Z"), status: "absent" },
    ] as any);
  });

  it("computes the summary", async () => {
    const res = await request(app)
      .get(`/api/reports?scope=workspace&id=${WS}&${range}`)
      .set("Authorization", authHeader(ADMIN));
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      people: 2,
      tasksCreated: 4,
      tasksCompleted: 3,
      completionRate: 75, // 3 of the 4 created are done
      onTimeRate: 67, // 2 of 3
      overdueOpen: 2,
      avgCycleHours: round1((10 + 48 + 10) / 3),
      attendanceRate: 63, // (2 present + ½ partial) / 4 weekday rows
      presentDays: 2,
      partialDays: 1,
      absentDays: 1,
    });
  });

  it("breaks results down per member", async () => {
    const res = await request(app)
      .get(`/api/reports?scope=workspace&id=${WS}&${range}`)
      .set("Authorization", authHeader(ADMIN));
    const [ben, ada] = res.body.members; // sorted by tasks completed
    expect(ben).toEqual(
      expect.objectContaining({ name: "Ben", completed: 2, onTimeRate: 50, attendanceRate: 50, avgCycleHours: 29 }),
    );
    expect(ada).toEqual(
      expect.objectContaining({ name: "Ada", completed: 1, onTimeRate: 100, overdueOpen: 2, attendanceRate: 75 }),
    );
  });

  it("buckets the daily trend by IST day and flags weekends", async () => {
    const res = await request(app)
      .get(`/api/reports?scope=workspace&id=${WS}&${range}`)
      .set("Authorization", authHeader(ADMIN));
    const byDate = Object.fromEntries(res.body.trend.map((d: any) => [d.date, d]));
    expect(res.body.trend).toHaveLength(7);
    expect(byDate["2026-10-21"]).toEqual(expect.objectContaining({ created: 1, completed: 0, present: 1, partial: 1 }));
    expect(byDate["2026-10-22"]).toEqual(expect.objectContaining({ created: 1, completed: 1 }));
    expect(byDate["2026-10-24"]).toEqual(expect.objectContaining({ weekend: true, absent: 0 }));
  });

  it("counts weekend attendance when asked to", async () => {
    const res = await request(app)
      .get(`/api/reports?scope=workspace&id=${WS}&${range}&excludeWeekends=false`)
      .set("Authorization", authHeader(ADMIN));
    expect(res.body.summary.absentDays).toBe(2);
    expect(res.body.summary.attendanceRate).toBe(50); // 2.5 / 5
  });

  it("filters project reports to that project's tasks", async () => {
    prismaMock.projectMember.findMany.mockResolvedValue([{ memberId: SEAT_A }] as any);
    await request(app).get(`/api/reports?scope=project&id=${PROJECT}&${range}`).set("Authorization", authHeader(ADMIN));
    const where = (prismaMock.task.findMany.mock.calls[0]![0] as any).where;
    expect(where.projectId).toBe(PROJECT);
    expect(where.memberId).toEqual({ in: [SEAT_A] });
  });
});

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
