import request from "supertest";
import { TaskStatus, TaskPriority, AttendanceStatus } from "@prisma/client";
import { prismaMock } from "./singleton";
import { createTestApp } from "./testApp";
import { makeMember, makeTask, authHeader, ADMIN, MEMBER } from "./helpers";
import * as attendance from "../src/utils/attendance";

const app = createTestApp();

const validTask = {
  title: "Write the report",
  description: "Compile the quarterly numbers and summarize",
  dueDate: "2026-12-31T00:00:00.000Z",
  priority: TaskPriority.high,
};

afterEach(() => {
  jest.restoreAllMocks();
});

// The submission window now lives on the member's workspace and is off by
// default, so a member can submit at any time unless an admin restricts it.
const UNRESTRICTED_WORKSPACE = {
  taskWindowEnabled: false,
  taskWindowStart: 540,
  taskWindowEnd: 660,
};

const RESTRICTED_WORKSPACE = {
  taskWindowEnabled: true,
  taskWindowStart: 540, // 9:00 AM IST
  taskWindowEnd: 660, // 11:00 AM IST
};

describe("POST /api/tasks (member)", () => {
  function openWindow(workspace: object = UNRESTRICTED_WORKSPACE) {
    prismaMock.member.findFirst.mockResolvedValue({
      id: "member-1",
      workspace,
    } as any);
    jest.spyOn(attendance, "getTodayISTDate").mockReturnValue(new Date("2026-06-21T00:00:00.000Z"));
    jest.spyOn(attendance, "getISTDateOf").mockReturnValue(new Date("2026-06-21T00:00:00.000Z"));
  }

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).post("/api/tasks").send(validTask);
    expect(res.status).toBe(401);
  });

  it("creates a task inside the window and upserts today's attendance row", async () => {
    openWindow();
    prismaMock.task.create.mockResolvedValue(makeTask() as any);
    prismaMock.dailyAttendance.upsert.mockResolvedValue({} as any);

    const res = await request(app).post("/api/tasks").set("Authorization", authHeader(MEMBER)).send(validTask);

    expect(res.status).toBe(201);
    expect(prismaMock.task.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.dailyAttendance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          memberId_date: {
            memberId: "member-1",
            date: new Date("2026-06-21T00:00:00.000Z"),
          },
        },
        // Planned but not finished yet counts as partial from the start.
        create: expect.objectContaining({
          status: AttendanceStatus.partial,
        }),
      }),
    );
  });

  describe("tags", () => {
    it("saves tags trimmed, without #, de-duplicated ignoring case", async () => {
      openWindow();
      prismaMock.task.create.mockResolvedValue(makeTask() as any);
      prismaMock.dailyAttendance.upsert.mockResolvedValue({} as any);
      prismaMock.dailyAttendance.updateMany.mockResolvedValue({ count: 0 } as any);

      const res = await request(app)
        .post("/api/tasks")
        .set("Authorization", authHeader(MEMBER))
        .send({ ...validTask, tags: ["  #Frontend ", "frontend", "bug   fix", "", "API"] });

      expect(res.status).toBe(201);
      expect((prismaMock.task.create.mock.calls[0]![0] as any).data.tags).toEqual(["Frontend", "bug fix", "API"]);
    });

    it("rejects more than 10 tags or a tag over 24 characters", async () => {
      openWindow();
      const many = await request(app)
        .post("/api/tasks")
        .set("Authorization", authHeader(MEMBER))
        .send({ ...validTask, tags: Array.from({ length: 11 }, (_, i) => `t${i}`) });
      const long = await request(app)
        .post("/api/tasks")
        .set("Authorization", authHeader(MEMBER))
        .send({ ...validTask, tags: ["x".repeat(25)] });

      expect(many.status).toBe(400);
      expect(long.status).toBe(400);
      expect(prismaMock.task.create).not.toHaveBeenCalled();
    });

    it("rejects a description over 5000 characters", async () => {
      openWindow();
      const res = await request(app)
        .post("/api/tasks")
        .set("Authorization", authHeader(MEMBER))
        .send({ ...validTask, description: "x".repeat(5001) });
      expect(res.status).toBe(400);
    });
  });

  describe("from the client's outbox", () => {
    const ID = "7f1c2a4e-1b7d-4c55-9b0e-3d2f8a6c9e01";

    it("creates the task under the client's id and timestamp", async () => {
      openWindow();
      prismaMock.task.findUnique.mockResolvedValue(null);
      prismaMock.task.create.mockResolvedValue(makeTask({ id: ID }) as any);
      prismaMock.dailyAttendance.upsert.mockResolvedValue({} as any);
      prismaMock.dailyAttendance.updateMany.mockResolvedValue({ count: 0 } as any);
      const addedAt = new Date(Date.now() - 10 * 60 * 1000); // queued 10 minutes ago

      const res = await request(app)
        .post("/api/tasks")
        .set("Authorization", authHeader(MEMBER))
        .send({ ...validTask, id: ID, clientCreatedAt: addedAt.toISOString() });

      expect(res.status).toBe(201);
      const data = (prismaMock.task.create.mock.calls[0]![0] as any).data;
      expect(data.id).toBe(ID);
      expect(data.createdAt).toEqual(addedAt);
      const upsert = prismaMock.dailyAttendance.upsert.mock.calls[0]![0] as any;
      expect(upsert.create.taskSubmittedAt).toEqual(addedAt);
    });

    it("answers a retry with the task it already has instead of a duplicate", async () => {
      openWindow();
      prismaMock.task.findUnique.mockResolvedValue({
        ...makeTask({ id: ID }),
        member: { userId: MEMBER.userId },
      } as any);

      const res = await request(app)
        .post("/api/tasks")
        .set("Authorization", authHeader(MEMBER))
        .send({ ...validTask, id: ID });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(ID);
      expect(res.body.member).toBeUndefined();
      expect(prismaMock.task.create).not.toHaveBeenCalled();
    });

    it("refuses an id that belongs to someone else's task", async () => {
      openWindow();
      prismaMock.task.findUnique.mockResolvedValue({
        ...makeTask({ id: ID }),
        member: { userId: "someone-else" },
      } as any);

      const res = await request(app)
        .post("/api/tasks")
        .set("Authorization", authHeader(MEMBER))
        .send({ ...validTask, id: ID });

      expect(res.status).toBe(409);
      expect(prismaMock.task.create).not.toHaveBeenCalled();
    });

    it("ignores a client timestamp that is too old or in the future", () => {
      const now = new Date("2026-06-21T10:00:00.000Z");
      expect(attendance.resolveClientTime("2026-06-21T09:50:00.000Z", now)).toEqual(
        new Date("2026-06-21T09:50:00.000Z"),
      );
      expect(attendance.resolveClientTime("2026-06-20T10:00:00.000Z", now)).toEqual(now); // a day old
      expect(attendance.resolveClientTime("2026-06-21T11:00:00.000Z", now)).toEqual(now); // an hour ahead
      expect(attendance.resolveClientTime(undefined, now)).toEqual(now);
    });

    it("turns an absent day back to partial when the task was added before it settled", async () => {
      openWindow();
      prismaMock.task.findUnique.mockResolvedValue(null);
      prismaMock.task.create.mockResolvedValue(makeTask({ id: ID }) as any);
      prismaMock.dailyAttendance.upsert.mockResolvedValue({} as any);
      prismaMock.dailyAttendance.updateMany.mockResolvedValue({ count: 1 } as any);
      // 2026-06-21 settles at 15:30 UTC; this was added at 15:25 UTC.
      jest.spyOn(attendance, "resolveClientTime").mockReturnValue(new Date("2026-06-21T15:25:00.000Z"));

      await request(app)
        .post("/api/tasks")
        .set("Authorization", authHeader(MEMBER))
        .send({ ...validTask, id: ID, clientCreatedAt: "2026-06-21T15:25:00.000Z" });

      expect(prismaMock.dailyAttendance.updateMany).toHaveBeenCalledWith({
        where: { memberId: "member-1", date: new Date("2026-06-21T00:00:00.000Z"), status: AttendanceStatus.absent },
        data: { status: AttendanceStatus.partial, taskSubmittedAt: new Date("2026-06-21T15:25:00.000Z") },
      });
    });
  });

  it("blocks task creation outside a restricted workspace's window with 403", async () => {
    openWindow(RESTRICTED_WORKSPACE);
    jest.spyOn(attendance, "isWithinTaskWindow").mockReturnValue(false);

    const res = await request(app).post("/api/tasks").set("Authorization", authHeader(MEMBER)).send(validTask);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/9:00 AM and 11:00 AM IST/);
    expect(res.body.taskWindow).toEqual(
      expect.objectContaining({ enabled: true, startTime: "09:00", endTime: "11:00" }),
    );
    expect(prismaMock.task.create).not.toHaveBeenCalled();
  });

  it("lets a member submit at any hour when the workspace has no window", async () => {
    // No isWithinTaskWindow spy: a disabled window is open regardless of time.
    openWindow(UNRESTRICTED_WORKSPACE);
    prismaMock.task.create.mockResolvedValue(makeTask() as any);
    prismaMock.dailyAttendance.upsert.mockResolvedValue({} as any);

    const res = await request(app).post("/api/tasks").set("Authorization", authHeader(MEMBER)).send(validTask);

    expect(res.status).toBe(201);
  });

  it("returns 404 when the member row is missing", async () => {
    openWindow();
    prismaMock.member.findFirst.mockResolvedValue(null);

    const res = await request(app).post("/api/tasks").set("Authorization", authHeader(MEMBER)).send(validTask);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Member not found");
  });

  it("defaults status to todo when omitted", async () => {
    openWindow();
    prismaMock.task.create.mockResolvedValue(makeTask() as any);
    prismaMock.dailyAttendance.upsert.mockResolvedValue({} as any);

    await request(app).post("/api/tasks").set("Authorization", authHeader(MEMBER)).send(validTask);

    expect(prismaMock.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: TaskStatus.todo }),
      }),
    );
  });

  it("returns 400 for a too-short title", async () => {
    openWindow();
    const res = await request(app)
      .post("/api/tasks")
      .set("Authorization", authHeader(MEMBER))
      .send({ ...validTask, title: "ab" });

    expect(res.status).toBe(400);
  });

  it("returns 400 for a too-short description", async () => {
    openWindow();
    const res = await request(app)
      .post("/api/tasks")
      .set("Authorization", authHeader(MEMBER))
      .send({ ...validTask, description: "short" });

    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid (non-ISO) dueDate", async () => {
    openWindow();
    const res = await request(app)
      .post("/api/tasks")
      .set("Authorization", authHeader(MEMBER))
      .send({ ...validTask, dueDate: "31-12-2026" });

    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid status enum", async () => {
    openWindow();
    const res = await request(app)
      .post("/api/tasks")
      .set("Authorization", authHeader(MEMBER))
      .send({ ...validTask, status: "done" });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/tasks (admin)", () => {
  it("requires userId and is not constrained by the time window", async () => {
    // Window closed — admin should still succeed.
    jest.spyOn(attendance, "isWithinTaskWindow").mockReturnValue(false);
    prismaMock.member.findFirst.mockResolvedValue({ id: "member-1" } as any);
    prismaMock.task.create.mockResolvedValue(makeTask() as any);

    const res = await request(app)
      .post("/api/tasks")
      .set("Authorization", authHeader(ADMIN))
      .send({ ...validTask, userId: "member-user-id" });

    expect(res.status).toBe(201);
    // Admin-created tasks never upsert attendance.
    expect(prismaMock.dailyAttendance.upsert).not.toHaveBeenCalled();
  });

  it("returns 400 when userId is missing for an admin-created task", async () => {
    const res = await request(app).post("/api/tasks").set("Authorization", authHeader(ADMIN)).send(validTask);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("userId is required for admin created tasks");
  });

  it("returns 404 when the target member does not exist", async () => {
    prismaMock.member.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/tasks")
      .set("Authorization", authHeader(ADMIN))
      .send({ ...validTask, userId: "ghost" });

    expect(res.status).toBe(404);
  });
});

describe("GET /api/tasks/task-window", () => {
  it("returns the member's workspace window", async () => {
    prismaMock.member.findFirst.mockResolvedValue({
      workspaceId: "ws-1",
      workspace: RESTRICTED_WORKSPACE,
    } as any);

    const res = await request(app).get("/api/tasks/task-window").set("Authorization", authHeader(MEMBER));

    expect(res.status).toBe(200);
    expect(res.body.workspaceId).toBe("ws-1");
    expect(res.body.taskWindow).toEqual(
      expect.objectContaining({
        enabled: true,
        startTime: "09:00",
        endTime: "11:00",
        label: "9:00 AM – 11:00 AM IST",
      }),
    );
  });

  it("reports an always-open window for an unrestricted workspace", async () => {
    prismaMock.member.findFirst.mockResolvedValue({
      workspaceId: "ws-1",
      workspace: UNRESTRICTED_WORKSPACE,
    } as any);

    const res = await request(app).get("/api/tasks/task-window").set("Authorization", authHeader(MEMBER));

    expect(res.status).toBe(200);
    expect(res.body.taskWindow).toEqual(expect.objectContaining({ enabled: false, open: true, label: "Anytime" }));
  });

  it("never constrains an admin", async () => {
    const res = await request(app).get("/api/tasks/task-window").set("Authorization", authHeader(ADMIN));

    expect(res.status).toBe(200);
    expect(res.body.taskWindow.open).toBe(true);
    expect(prismaMock.member.findFirst).not.toHaveBeenCalled();
  });
});

describe("GET /api/tasks/:userId and /member/:userId", () => {
  it("returns tasks resolved via the member's User id", async () => {
    prismaMock.member.findFirst.mockResolvedValue({ id: "member-1" } as any);
    prismaMock.task.findMany.mockResolvedValue([makeTask()] as any);

    const res = await request(app).get("/api/tasks/member-user-id").set("Authorization", authHeader(ADMIN));

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
  });

  it("returns 404 when no member maps to that userId", async () => {
    prismaMock.member.findFirst.mockResolvedValue(null);

    const res = await request(app).get("/api/tasks/ghost").set("Authorization", authHeader(ADMIN));

    expect(res.status).toBe(404);
  });

  it("lets an admin view any member's tasks via /member/:userId", async () => {
    // Admin bypasses canViewMemberTasks before any param check.
    prismaMock.member.findFirst.mockResolvedValue({ id: "member-1" } as any);
    prismaMock.task.findMany.mockResolvedValue([] as any);

    const res = await request(app).get("/api/tasks/member/member-user-id").set("Authorization", authHeader(ADMIN));

    expect(res.status).toBe(200);
  });

  it("lets a member view their own tasks via /member/:userId", async () => {
    // canViewMemberTasks resolves the member by the userId param and matches userId.
    prismaMock.member.findFirst.mockResolvedValue(makeMember({ id: "member-1", userId: MEMBER.userId }) as any);
    prismaMock.task.findMany.mockResolvedValue([] as any);

    const res = await request(app).get("/api/tasks/member/member-user-id").set("Authorization", authHeader(MEMBER));

    expect(res.status).toBe(200);
    expect(prismaMock.member.findFirst).toHaveBeenCalledWith({
      where: { userId: "member-user-id" },
      select: { userId: true },
    });
  });

  it("blocks a member from viewing another member's tasks (403)", async () => {
    prismaMock.member.findFirst.mockResolvedValue(makeMember({ id: "member-1", userId: "other-user-id" }) as any);

    const res = await request(app).get("/api/tasks/member/other-user-id").set("Authorization", authHeader(MEMBER));

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("You can only view your own tasks");
  });

  it("returns 404 from canViewMemberTasks when no member maps to that userId", async () => {
    prismaMock.member.findUnique.mockResolvedValue(null);

    const res = await request(app).get("/api/tasks/member/ghost").set("Authorization", authHeader(MEMBER));

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Member not found");
  });
});

describe("PATCH /api/tasks/:taskId", () => {
  it("lets an admin update any task", async () => {
    prismaMock.task.findUnique.mockResolvedValue({
      status: TaskStatus.todo,
      memberId: "member-1",
      member: { id: "member-1", email: "owner@example.com" },
    } as any);
    prismaMock.task.update.mockResolvedValue(makeTask({ title: "Updated" }) as any);

    const res = await request(app)
      .patch("/api/tasks/task-1")
      .set("Authorization", authHeader(ADMIN))
      .send({ title: "Updated title here" });

    expect(res.status).toBe(200);
    expect(prismaMock.task.update).toHaveBeenCalled();
  });

  it("flips attendance to present when the last open task is completed", async () => {
    jest.spyOn(attendance, "getTodayISTDate").mockReturnValue(new Date("2026-06-21T00:00:00.000Z"));
    prismaMock.task.findUnique.mockResolvedValue({
      status: TaskStatus.in_progress,
      memberId: "member-1",
      member: { id: "member-1", userId: MEMBER.userId },
    } as any);
    prismaMock.task.update.mockResolvedValue(makeTask({ status: TaskStatus.completed }) as any);
    // checkAndMarkPresent: all today's tasks completed.
    prismaMock.task.findMany.mockResolvedValue([{ status: TaskStatus.completed, createdAt: new Date() }] as any);
    prismaMock.dailyAttendance.upsert.mockResolvedValue({
      status: AttendanceStatus.present,
      date: new Date(),
    } as any);

    const res = await request(app)
      .patch("/api/tasks/task-1")
      .set("Authorization", authHeader(MEMBER))
      .send({ status: TaskStatus.completed });

    expect(res.status).toBe(200);
    expect(prismaMock.dailyAttendance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: AttendanceStatus.present }),
      }),
    );
  });

  it("does NOT mark present when other tasks are still open", async () => {
    jest.spyOn(attendance, "getTodayISTDate").mockReturnValue(new Date("2026-06-21T00:00:00.000Z"));
    prismaMock.task.findUnique.mockResolvedValue({
      status: TaskStatus.todo,
      memberId: "member-1",
      member: { id: "member-1", userId: MEMBER.userId },
    } as any);
    prismaMock.task.update.mockResolvedValue(makeTask({ status: TaskStatus.completed }) as any);
    prismaMock.task.findMany.mockResolvedValue([
      { status: TaskStatus.completed, createdAt: new Date() },
      { status: TaskStatus.todo, createdAt: new Date() },
    ] as any);

    const res = await request(app)
      .patch("/api/tasks/task-1")
      .set("Authorization", authHeader(MEMBER))
      .send({ status: TaskStatus.completed });

    expect(res.status).toBe(200);
    expect(prismaMock.dailyAttendance.upsert).not.toHaveBeenCalled();
  });

  it("does not re-run completion logic if the task was already completed", async () => {
    prismaMock.task.findUnique.mockResolvedValue({
      status: TaskStatus.completed,
      memberId: "member-1",
      member: { id: "member-1", userId: MEMBER.userId },
    } as any);
    prismaMock.task.update.mockResolvedValue(makeTask() as any);

    const res = await request(app)
      .patch("/api/tasks/task-1")
      .set("Authorization", authHeader(MEMBER))
      .send({ status: TaskStatus.completed });

    expect(res.status).toBe(200);
    expect(prismaMock.task.findMany).not.toHaveBeenCalled();
  });

  it("blocks a member from updating a task they don't own (403 from middleware)", async () => {
    prismaMock.task.findUnique.mockResolvedValue({
      ...makeTask(),
      member: makeMember({ userId: "other-user-id" }),
    } as any);

    const res = await request(app)
      .patch("/api/tasks/task-1")
      .set("Authorization", authHeader(MEMBER))
      .send({ title: "Trying to edit" });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("You can only manage your own tasks");
  });

  it("returns 404 from middleware when the task does not exist", async () => {
    prismaMock.task.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .patch("/api/tasks/missing")
      .set("Authorization", authHeader(MEMBER))
      .send({ title: "whatever here" });

    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid update payload", async () => {
    // Admin bypasses ownership; controller validates body.
    const res = await request(app)
      .patch("/api/tasks/task-1")
      .set("Authorization", authHeader(ADMIN))
      .send({ status: "nope" });

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/tasks/:taskId", () => {
  it("lets an admin delete a task", async () => {
    prismaMock.task.findUnique.mockResolvedValue({ id: "task-1" } as any);
    prismaMock.task.delete.mockResolvedValue(makeTask() as any);

    const res = await request(app).delete("/api/tasks/task-1").set("Authorization", authHeader(ADMIN));

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Task deleted successfully");
  });

  it("returns 404 when the task does not exist (admin)", async () => {
    prismaMock.task.findUnique.mockResolvedValue(null);

    const res = await request(app).delete("/api/tasks/missing").set("Authorization", authHeader(ADMIN));

    expect(res.status).toBe(404);
  });

  it("blocks a member from deleting even their own task", async () => {
    // canManageTask passes (owner), but deleting needs admin or project lead.
    prismaMock.task.findUnique.mockResolvedValue({
      ...makeTask(),
      member: makeMember({ email: MEMBER.email }),
    } as any);

    const res = await request(app).delete("/api/tasks/task-1").set("Authorization", authHeader(MEMBER));

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Only admins and project leads can delete tasks");
    expect(prismaMock.task.delete).not.toHaveBeenCalled();
  });
});
