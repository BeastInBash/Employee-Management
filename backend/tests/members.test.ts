import request from "supertest";
import { Prisma, UserRole } from "@prisma/client";
import { prismaMock } from "./singleton";
import { createTestApp } from "./testApp";
import {
  makeUser,
  makeMember,
  authHeader,
  ADMIN,
  MEMBER,
} from "./helpers";
import { sendMemberCredentials } from "../src/utils/email";

const app = createTestApp();
const credsMock = sendMemberCredentials as jest.Mock;

describe("POST /api/members", () => {
  const validBody = {
    name: "New Person",
    email: "new@example.com",
    role: "Designer",
  };

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).post("/api/members").send(validBody);
    expect(res.status).toBe(401);
  });

  it("rejects non-admin (member) callers with 403", async () => {
    const res = await request(app)
      .post("/api/members")
      .set("Authorization", authHeader(MEMBER))
      .send(validBody);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Admin access required");
  });

  it("creates a brand-new member, hashes default pw, and emails credentials", async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce(null) // existingUser lookup
      .mockResolvedValueOnce({ name: "Admin", email: ADMIN.email } as any); // admin lookup
    prismaMock.user.create.mockResolvedValue(
      makeUser({ id: "new-user", email: "new@example.com", name: "New Person" }) as any
    );
    prismaMock.member.create.mockResolvedValue(
      makeMember({ id: "m-new", userId: "new-user", email: "new@example.com" }) as any
    );

    const res = await request(app)
      .post("/api/members")
      .set("Authorization", authHeader(ADMIN))
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/credentials were emailed/i);
    expect(res.body.memberData.name).toBe("New Person");
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "new@example.com",
        password: "hashed:123456",
        role: UserRole.member,
        isPasswordReset: true,
      }),
      include: { members: { select: { id: true } } },
    });
    expect(credsMock).toHaveBeenCalledTimes(1);
  });

  it("reuses an existing member-role user (no new user, no email)", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      ...makeUser({ id: "existing", role: UserRole.member }),
      members: [],
    } as any);
    prismaMock.member.create.mockResolvedValue(
      makeMember({ userId: "existing" }) as any
    );

    const res = await request(app)
      .post("/api/members")
      .set("Authorization", authHeader(ADMIN))
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Member added successfully.");
    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(credsMock).not.toHaveBeenCalled();
  });

  it("rejects adding an admin account as a member with 409", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      ...makeUser({ role: UserRole.admin }),
      members: [],
    } as any);

    const res = await request(app)
      .post("/api/members")
      .set("Authorization", authHeader(ADMIN))
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/admin account/i);
    expect(prismaMock.member.create).not.toHaveBeenCalled();
  });

  it("rejects when the person is already a member with 409", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      ...makeUser({ role: UserRole.member }),
      members: [{ id: "already" }],
    } as any);

    const res = await request(app)
      .post("/api/members")
      .set("Authorization", authHeader(ADMIN))
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("This person is already a member");
  });

  it("maps a P2002 unique-constraint race to 409", async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ name: "Admin", email: ADMIN.email } as any);
    prismaMock.user.create.mockResolvedValue(makeUser({ id: "u" }) as any);
    prismaMock.member.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "6.0.0",
      })
    );

    const res = await request(app)
      .post("/api/members")
      .set("Authorization", authHeader(ADMIN))
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("This person is already a member");
  });

  it("returns 400 for invalid input (short name)", async () => {
    const res = await request(app)
      .post("/api/members")
      .set("Authorization", authHeader(ADMIN))
      .send({ name: "A", email: "x@y.com", role: "Dev" });

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid email", async () => {
    const res = await request(app)
      .post("/api/members")
      .set("Authorization", authHeader(ADMIN))
      .send({ name: "Valid Name", email: "bad", role: "Dev" });

    expect(res.status).toBe(400);
  });

  it("returns 500 on unexpected DB error", async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error("boom"));

    const res = await request(app)
      .post("/api/members")
      .set("Authorization", authHeader(ADMIN))
      .send(validBody);

    expect(res.status).toBe(500);
  });
});

describe("GET /api/members", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/members");
    expect(res.status).toBe(401);
  });

  it("returns members the admin created", async () => {
    prismaMock.member.findMany.mockResolvedValue([
      makeMember({ id: "m1" }),
    ] as any);

    const res = await request(app)
      .get("/api/members")
      .set("Authorization", authHeader(ADMIN));

    expect(res.status).toBe(200);
    expect(res.body.members).toHaveLength(1);
    expect(prismaMock.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { createdById: ADMIN.userId } })
    );
  });

  it("returns only the member's own row for a member caller", async () => {
    prismaMock.member.findMany.mockResolvedValue([
      makeMember({ userId: MEMBER.userId }),
    ] as any);

    const res = await request(app)
      .get("/api/members")
      .set("Authorization", authHeader(MEMBER));

    expect(res.status).toBe(200);
    expect(prismaMock.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: MEMBER.userId } })
    );
  });

  it("returns 500 on DB error", async () => {
    prismaMock.member.findMany.mockRejectedValue(new Error("boom"));
    const res = await request(app)
      .get("/api/members")
      .set("Authorization", authHeader(ADMIN));
    expect(res.status).toBe(500);
  });
});

describe("GET /api/members/:memberId", () => {
  it("returns the member for an admin", async () => {
    prismaMock.member.findUnique.mockResolvedValue({
      ...makeMember({ id: "m1" }),
      user: { name: "Bob" },
    } as any);

    const res = await request(app)
      .get("/api/members/m1")
      .set("Authorization", authHeader(ADMIN));

    expect(res.status).toBe(200);
    expect(res.body.member.id).toBe("m1");
  });

  it("returns 403 for a member caller", async () => {
    const res = await request(app)
      .get("/api/members/m1")
      .set("Authorization", authHeader(MEMBER));

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Access denied");
  });

  it("returns 404 when the member does not exist", async () => {
    prismaMock.member.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/members/missing")
      .set("Authorization", authHeader(ADMIN));

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/members/:memberId", () => {
  it("rejects non-admin with 403", async () => {
    const res = await request(app)
      .delete("/api/members/m1")
      .set("Authorization", authHeader(MEMBER));

    expect(res.status).toBe(403);
  });

  it("deletes the underlying user (cascades) for a member created by the admin", async () => {
    prismaMock.member.findUnique.mockResolvedValue({
      ...makeMember({ id: "m1", createdById: ADMIN.userId }),
      user: { id: "u-member", role: UserRole.member },
    } as any);
    prismaMock.user.delete.mockResolvedValue(makeUser() as any);

    const res = await request(app)
      .delete("/api/members/m1")
      .set("Authorization", authHeader(ADMIN));

    expect(res.status).toBe(200);
    expect(res.body.memberId).toBe("m1");
    expect(prismaMock.user.delete).toHaveBeenCalledWith({
      where: { id: "u-member" },
    });
    expect(prismaMock.member.delete).not.toHaveBeenCalled();
  });

  it("only deletes the member row (never the user) when the user is an admin", async () => {
    prismaMock.member.findUnique.mockResolvedValue({
      ...makeMember({ id: "m1", createdById: ADMIN.userId }),
      user: { id: "u-admin", role: UserRole.admin },
    } as any);
    prismaMock.member.delete.mockResolvedValue(makeMember() as any);

    const res = await request(app)
      .delete("/api/members/m1")
      .set("Authorization", authHeader(ADMIN));

    expect(res.status).toBe(200);
    expect(prismaMock.member.delete).toHaveBeenCalledWith({
      where: { id: "m1" },
    });
    expect(prismaMock.user.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when the member does not exist", async () => {
    prismaMock.member.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .delete("/api/members/missing")
      .set("Authorization", authHeader(ADMIN));

    expect(res.status).toBe(404);
  });

  it("returns 403 when deleting a member the admin did not create", async () => {
    prismaMock.member.findUnique.mockResolvedValue({
      ...makeMember({ id: "m1", createdById: "some-other-admin" }),
      user: { id: "u", role: UserRole.member },
    } as any);

    const res = await request(app)
      .delete("/api/members/m1")
      .set("Authorization", authHeader(ADMIN));

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("You can only delete members you created");
    expect(prismaMock.user.delete).not.toHaveBeenCalled();
  });

  it("returns 500 on DB error", async () => {
    prismaMock.member.findUnique.mockRejectedValue(new Error("boom"));
    const res = await request(app)
      .delete("/api/members/m1")
      .set("Authorization", authHeader(ADMIN));
    expect(res.status).toBe(500);
  });
});
