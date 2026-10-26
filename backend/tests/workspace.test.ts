import request from "supertest";
import { OrgRole } from "@prisma/client";
import { prismaMock } from "./singleton";
import { createTestApp } from "./testApp";
import { authHeader, ADMIN, MEMBER } from "./helpers";
import { isWithinTaskWindow, parseTimeString, toTimeString, formatISTMinute } from "../src/utils/attendance";

const app = createTestApp();

const WORKSPACE = {
  id: "ws-1",
  name: "Engineering",
  orgId: "org-1",
  taskWindowEnabled: false,
  taskWindowStart: 540,
  taskWindowEnd: 660,
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe("GET /api/workspace/:workspaceId/task-window", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/workspace/ws-1/task-window");
    // `authenticate` throws on a missing token, so the status is whatever the
    // error handler produces — what matters is that the handler never ran.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(prismaMock.workspace.findUnique).not.toHaveBeenCalled();
  });

  it("returns the window to a member of the workspace", async () => {
    prismaMock.workspace.findUnique.mockResolvedValue(WORKSPACE as any);
    prismaMock.organization.findUnique.mockResolvedValue({
      ownerId: "someone-else",
    } as any);
    prismaMock.workspaceMembership.findUnique.mockResolvedValue(null);
    prismaMock.member.findFirst.mockResolvedValue({ id: "member-1" } as any);
    prismaMock.orgMembership.findUnique.mockResolvedValue(null);

    const res = await request(app).get("/api/workspace/ws-1/task-window").set("Authorization", authHeader(MEMBER));

    expect(res.status).toBe(200);
    expect(res.body.taskWindow).toEqual(expect.objectContaining({ enabled: false, open: true, label: "Anytime" }));
  });

  it("403s a user with no relationship to the workspace", async () => {
    prismaMock.workspace.findUnique.mockResolvedValue(WORKSPACE as any);
    prismaMock.organization.findUnique.mockResolvedValue({
      ownerId: "someone-else",
    } as any);
    prismaMock.workspaceMembership.findUnique.mockResolvedValue(null);
    prismaMock.member.findFirst.mockResolvedValue(null);
    prismaMock.orgMembership.findUnique.mockResolvedValue(null);

    const res = await request(app).get("/api/workspace/ws-1/task-window").set("Authorization", authHeader(MEMBER));

    expect(res.status).toBe(403);
  });

  it("404s an unknown workspace", async () => {
    prismaMock.workspace.findUnique.mockResolvedValue(null);

    const res = await request(app).get("/api/workspace/ghost/task-window").set("Authorization", authHeader(ADMIN));

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/workspace/:workspaceId/task-window", () => {
  function asOrgOwner() {
    prismaMock.workspace.findUnique.mockResolvedValue(WORKSPACE as any);
    prismaMock.organization.findUnique.mockResolvedValue({
      id: "org-1",
      ownerId: ADMIN.userId,
    } as any);
  }

  it("enables a window with the supplied hours", async () => {
    asOrgOwner();
    prismaMock.workspace.update.mockResolvedValue({
      ...WORKSPACE,
      taskWindowEnabled: true,
      taskWindowStart: 600,
      taskWindowEnd: 780,
    } as any);

    const res = await request(app)
      .patch("/api/workspace/ws-1/task-window")
      .set("Authorization", authHeader(ADMIN))
      .send({ enabled: true, startTime: "10:00", endTime: "13:00" });

    expect(res.status).toBe(200);
    expect(prismaMock.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          taskWindowEnabled: true,
          taskWindowStart: 600,
          taskWindowEnd: 780,
        },
      }),
    );
    expect(res.body.taskWindow).toEqual(
      expect.objectContaining({ enabled: true, startTime: "10:00", endTime: "13:00" }),
    );
  });

  it("keeps the stored hours when only the toggle is sent", async () => {
    asOrgOwner();
    prismaMock.workspace.update.mockResolvedValue({
      ...WORKSPACE,
      taskWindowEnabled: true,
    } as any);

    const res = await request(app)
      .patch("/api/workspace/ws-1/task-window")
      .set("Authorization", authHeader(ADMIN))
      .send({ enabled: false });

    expect(res.status).toBe(200);
    expect(prismaMock.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taskWindowStart: 540,
          taskWindowEnd: 660,
        }),
      }),
    );
  });

  it("rejects a member (non-admin) with 403", async () => {
    const res = await request(app)
      .patch("/api/workspace/ws-1/task-window")
      .set("Authorization", authHeader(MEMBER))
      .send({ enabled: true, startTime: "09:00", endTime: "11:00" });

    expect(res.status).toBe(403);
    expect(prismaMock.workspace.update).not.toHaveBeenCalled();
  });

  it("rejects an admin who does not manage the org with 403", async () => {
    prismaMock.workspace.findUnique.mockResolvedValue(WORKSPACE as any);
    prismaMock.organization.findUnique.mockResolvedValue({
      id: "org-1",
      ownerId: "another-admin",
    } as any);
    prismaMock.orgMembership.findUnique.mockResolvedValue({
      role: OrgRole.member,
    } as any);

    const res = await request(app)
      .patch("/api/workspace/ws-1/task-window")
      .set("Authorization", authHeader(ADMIN))
      .send({ enabled: true, startTime: "09:00", endTime: "11:00" });

    expect(res.status).toBe(403);
  });

  it("400s a malformed time", async () => {
    const res = await request(app)
      .patch("/api/workspace/ws-1/task-window")
      .set("Authorization", authHeader(ADMIN))
      .send({ enabled: true, startTime: "9am", endTime: "11:00" });

    expect(res.status).toBe(400);
  });

  it("400s when enabling without hours", async () => {
    const res = await request(app)
      .patch("/api/workspace/ws-1/task-window")
      .set("Authorization", authHeader(ADMIN))
      .send({ enabled: true });

    expect(res.status).toBe(400);
  });
});

describe("task window helpers", () => {
  const at = (hh: number, mm = 0) =>
    // 05:30 UTC == 11:00 IST, so subtract the IST offset to build a UTC instant.
    new Date(Date.UTC(2026, 5, 21, hh, mm) - 330 * 60000);

  it("is always open when disabled", () => {
    const window = { enabled: false, startMinute: 540, endMinute: 660 };
    expect(isWithinTaskWindow(window, at(3))).toBe(true);
    expect(isWithinTaskWindow(window, at(23))).toBe(true);
  });

  it("honours a same-day window", () => {
    const window = { enabled: true, startMinute: 540, endMinute: 660 };
    expect(isWithinTaskWindow(window, at(8, 59))).toBe(false);
    expect(isWithinTaskWindow(window, at(9, 0))).toBe(true);
    expect(isWithinTaskWindow(window, at(10, 59))).toBe(true);
    expect(isWithinTaskWindow(window, at(11, 0))).toBe(false);
  });

  it("wraps a window that crosses midnight", () => {
    const window = { enabled: true, startMinute: 22 * 60, endMinute: 2 * 60 };
    expect(isWithinTaskWindow(window, at(23))).toBe(true);
    expect(isWithinTaskWindow(window, at(1))).toBe(true);
    expect(isWithinTaskWindow(window, at(12))).toBe(false);
  });

  it("round-trips HH:mm strings", () => {
    expect(parseTimeString("09:30")).toBe(570);
    expect(parseTimeString("24:00")).toBeNull();
    expect(parseTimeString("9:30")).toBeNull();
    expect(toTimeString(570)).toBe("09:30");
    expect(formatISTMinute(570)).toBe("9:30 AM");
    expect(formatISTMinute(0)).toBe("12:00 AM");
    expect(formatISTMinute(12 * 60)).toBe("12:00 PM");
  });
});
