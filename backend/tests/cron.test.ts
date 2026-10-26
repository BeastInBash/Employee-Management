import request from "supertest";
import { AttendanceStatus, TaskStatus } from "@prisma/client";
import { prismaMock } from "./singleton";
import { createTestApp } from "./testApp";

const app = createTestApp();
const SECRET = "test-cron-secret";

describe("GET /api/internal/cron/eod", () => {
  const original = process.env.CRON_SECRET;
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
  });
  afterAll(() => {
    process.env.CRON_SECRET = original;
  });

  it("refuses to run when CRON_SECRET isn't configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await request(app).get("/api/internal/cron/eod").set("Authorization", `Bearer ${SECRET}`);
    expect(res.status).toBe(503);
    expect(prismaMock.member.findMany).not.toHaveBeenCalled();
  });

  it("rejects a missing or wrong secret", async () => {
    const none = await request(app).get("/api/internal/cron/eod");
    const wrong = await request(app).get("/api/internal/cron/eod").set("Authorization", "Bearer nope");
    expect(none.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(prismaMock.member.findMany).not.toHaveBeenCalled();
  });

  it("settles each member's day in one batch and reports the counts", async () => {
    const at = (h: number) => new Date(Date.UTC(2026, 9, 26, h));
    prismaMock.member.findMany.mockResolvedValue([{ id: "done" }, { id: "some" }, { id: "none" }, { id: "early" }] as any);
    prismaMock.task.findMany.mockResolvedValue([
      { memberId: "done", status: TaskStatus.completed, createdAt: at(5) },
      { memberId: "done", status: TaskStatus.completed, createdAt: at(4) },
      { memberId: "some", status: TaskStatus.completed, createdAt: at(6) },
      { memberId: "some", status: TaskStatus.todo, createdAt: at(3) },
      { memberId: "early", status: TaskStatus.completed, createdAt: at(2) },
    ] as any);
    prismaMock.dailyAttendance.findMany.mockResolvedValue([
      { memberId: "early", status: AttendanceStatus.present, taskSubmittedAt: at(2) },
    ] as any);
    prismaMock.dailyAttendance.upsert.mockImplementation(((args: any) => args) as any);
    prismaMock.$transaction.mockResolvedValue([] as any);

    const res = await request(app).get("/api/internal/cron/eod").set("Authorization", `Bearer ${SECRET}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ dryRun: false, members: 4, present: 1, partial: 1, absent: 1, alreadyPresent: 1 });
    // Three reads for everyone, not two per member.
    expect(prismaMock.task.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.dailyAttendance.findMany).toHaveBeenCalledTimes(1);

    const upserts = prismaMock.dailyAttendance.upsert.mock.calls.map((c) => c[0] as any);
    const byMember = Object.fromEntries(upserts.map((u) => [u.where.memberId_date.memberId, u]));
    expect(Object.keys(byMember).sort()).toEqual(["done", "none", "some"]); // "early" left alone
    expect(byMember.none.update).toEqual({ status: AttendanceStatus.absent });
    expect(byMember.some.update).toEqual({ status: AttendanceStatus.partial });
    // taskSubmittedAt is the earliest task of the day.
    expect(byMember.some.create.taskSubmittedAt).toEqual(at(3));
    expect(byMember.done.update.status).toBe(AttendanceStatus.present);
    expect(byMember.done.create.taskSubmittedAt).toEqual(at(4));
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("with ?dryRun=1 counts the same way but writes nothing", async () => {
    prismaMock.member.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }] as any);
    prismaMock.task.findMany.mockResolvedValue([{ memberId: "a", status: TaskStatus.todo, createdAt: new Date() }] as any);
    prismaMock.dailyAttendance.findMany.mockResolvedValue([] as any);

    const res = await request(app).get("/api/internal/cron/eod?dryRun=1").set("Authorization", `Bearer ${SECRET}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ dryRun: true, members: 2, partial: 1, absent: 1 });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("still needs the secret for a dry run", async () => {
    const res = await request(app).get("/api/internal/cron/eod?dryRun=1");
    expect(res.status).toBe(401);
    expect(prismaMock.member.findMany).not.toHaveBeenCalled();
  });

  it("reports a failure as 500 so the scheduler logs it", async () => {
    prismaMock.member.findMany.mockRejectedValue(new Error("db down"));
    const res = await request(app).post("/api/internal/cron/eod").set("Authorization", `Bearer ${SECRET}`);
    expect(res.status).toBe(500);
  });
});
