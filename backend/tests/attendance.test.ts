import request from "supertest";
import { AttendanceStatus } from "@prisma/client";
import { prismaMock } from "./singleton";
import { createTestApp } from "./testApp";
import { makeMember, makeAttendance, authHeader, ADMIN, MEMBER } from "./helpers";
import * as attendance from "../src/utils/attendance";

const app = createTestApp();

afterEach(() => jest.restoreAllMocks());

describe("GET /api/attendance/me", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/attendance/me");
    expect(res.status).toBe(401);
  });

  it("returns the member's monthly attendance plus a status summary", async () => {
    prismaMock.member.findUnique.mockResolvedValue(makeMember() as any);
    prismaMock.dailyAttendance.findMany.mockResolvedValue([
      makeAttendance({ status: AttendanceStatus.present }),
      makeAttendance({ id: "a2", status: AttendanceStatus.absent }),
      makeAttendance({ id: "a3", status: AttendanceStatus.partial }),
    ] as any);

    const res = await request(app)
      .get("/api/attendance/me")
      .set("Authorization", authHeader(MEMBER));

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      present: 1,
      absent: 1,
      partial: 1,
      total: 3,
    });
  });

  it("returns 404 when the caller has no member row", async () => {
    prismaMock.member.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/attendance/me")
      .set("Authorization", authHeader(MEMBER));

    expect(res.status).toBe(404);
  });

  it("honours explicit ?month & ?year query params", async () => {
    prismaMock.member.findUnique.mockResolvedValue(makeMember() as any);
    prismaMock.dailyAttendance.findMany.mockResolvedValue([] as any);

    await request(app)
      .get("/api/attendance/me?month=3&year=2025")
      .set("Authorization", authHeader(MEMBER));

    const arg = prismaMock.dailyAttendance.findMany.mock.calls[0]![0] as any;
    // month=3 → March (index 2): gte = 2025-03-01.
    expect(arg.where.date.gte).toEqual(new Date(2025, 2, 1));
    expect(arg.where.date.lte).toEqual(new Date(2025, 3, 0));
  });

  it("returns an empty summary when there are no records", async () => {
    prismaMock.member.findUnique.mockResolvedValue(makeMember() as any);
    prismaMock.dailyAttendance.findMany.mockResolvedValue([] as any);

    const res = await request(app)
      .get("/api/attendance/me")
      .set("Authorization", authHeader(MEMBER));

    expect(res.body.summary).toEqual({
      present: 0,
      absent: 0,
      partial: 0,
      total: 0,
    });
  });
});

describe("GET /api/attendance/today", () => {
  it("rejects non-admin callers with 403", async () => {
    const res = await request(app)
      .get("/api/attendance/today")
      .set("Authorization", authHeader(MEMBER));

    expect(res.status).toBe(403);
  });

  it("returns an overview, defaulting members with no record to absent", async () => {
    jest.spyOn(attendance, "isWithinTaskSubmissionWindow").mockReturnValue(true);
    jest.spyOn(attendance, "isAfterCompletionDeadline").mockReturnValue(false);
    prismaMock.member.findMany.mockResolvedValue([
      {
        ...makeMember({ id: "m1" }),
        user: { name: "Has Record" },
        attendance: [makeAttendance({ status: AttendanceStatus.present })],
      },
      {
        ...makeMember({ id: "m2", email: "norec@example.com" }),
        user: { name: "No Record" },
        attendance: [],
      },
    ] as any);

    const res = await request(app)
      .get("/api/attendance/today")
      .set("Authorization", authHeader(ADMIN));

    expect(res.status).toBe(200);
    expect(res.body.submissionWindowOpen).toBe(true);
    expect(res.body.completionDeadlinePassed).toBe(false);
    expect(res.body.overview).toHaveLength(2);
    expect(res.body.overview[0].status).toBe(AttendanceStatus.present);
    expect(res.body.overview[1].status).toBe(AttendanceStatus.absent);
    expect(res.body.overview[1].taskSubmittedAt).toBeNull();
  });
});

describe("GET /api/attendance/report", () => {
  it("rejects non-admin callers with 403", async () => {
    const res = await request(app)
      .get("/api/attendance/report")
      .set("Authorization", authHeader(MEMBER));
    expect(res.status).toBe(403);
  });

  it("computes per-member summaries and attendance percentage", async () => {
    prismaMock.member.findMany.mockResolvedValue([
      {
        ...makeMember({ id: "m1" }),
        user: { name: "Alice" },
        attendance: [
          makeAttendance({ status: AttendanceStatus.present }),
          makeAttendance({ id: "a2", status: AttendanceStatus.present }),
          makeAttendance({ id: "a3", status: AttendanceStatus.absent }),
          makeAttendance({ id: "a4", status: AttendanceStatus.partial }),
        ],
      },
    ] as any);

    const res = await request(app)
      .get("/api/attendance/report")
      .set("Authorization", authHeader(ADMIN));

    expect(res.status).toBe(200);
    const summary = res.body.report[0].summary;
    expect(summary).toEqual({
      present: 2,
      absent: 1,
      partial: 1,
      total: 4,
      attendancePercentage: 50, // 2/4
    });
  });

  it("uses startDate/endDate when both are supplied", async () => {
    prismaMock.member.findMany.mockResolvedValue([] as any);

    await request(app)
      .get("/api/attendance/report?startDate=2026-01-01&endDate=2026-01-31")
      .set("Authorization", authHeader(ADMIN));

    const arg = prismaMock.member.findMany.mock.calls[0]![0] as any;
    const dateFilter = arg.include.attendance.where.date;
    expect(dateFilter.gte).toEqual(new Date("2026-01-01"));
    expect(dateFilter.lte).toEqual(new Date("2026-01-31"));
  });
});

describe("GET /api/attendance/report/:memberId", () => {
  it("rejects non-admin callers with 403", async () => {
    const res = await request(app)
      .get("/api/attendance/report/m1")
      .set("Authorization", authHeader(MEMBER));
    expect(res.status).toBe(403);
  });

  it("resolves by Member id OR User id and returns 0% with no records", async () => {
    prismaMock.member.findFirst.mockResolvedValue({
      ...makeMember({ id: "m1" }),
      user: { name: "Bob", email: "bob@example.com" },
    } as any);
    prismaMock.dailyAttendance.findMany.mockResolvedValue([] as any);

    const res = await request(app)
      .get("/api/attendance/report/m1")
      .set("Authorization", authHeader(ADMIN));

    expect(res.status).toBe(200);
    expect(res.body.summary.attendancePercentage).toBe(0);
    const arg = prismaMock.member.findFirst.mock.calls[0]![0] as any;
    expect(arg.where.OR).toEqual([{ id: "m1" }, { userId: "m1" }]);
  });

  it("returns 404 when no member matches the id", async () => {
    prismaMock.member.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/attendance/report/ghost")
      .set("Authorization", authHeader(ADMIN));

    expect(res.status).toBe(404);
  });

  it("returns 500 on DB error", async () => {
    prismaMock.member.findFirst.mockRejectedValue(new Error("boom"));
    const res = await request(app)
      .get("/api/attendance/report/m1")
      .set("Authorization", authHeader(ADMIN));
    expect(res.status).toBe(500);
  });
});
