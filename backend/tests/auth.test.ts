import request from "supertest";
import { Prisma, UserRole } from "@prisma/client";
import { prismaMock } from "./singleton";
import { createTestApp } from "./testApp";
import { makeUser, authHeader, ADMIN } from "./helpers";
import { comparePassword, hashPassword } from "../src/utils/password";
import { sendPasswordResetEmail } from "../src/utils/email";
import crypto from "crypto";

const app = createTestApp();

const compareMock = comparePassword as jest.Mock;
const hashMock = hashPassword as jest.Mock;
const resetEmailMock = sendPasswordResetEmail as jest.Mock;

describe("POST /api/auth/login", () => {
  it("logs in with valid credentials and omits the password", async () => {
    const user = makeUser({ email: "user@example.com", role: UserRole.member });
    prismaMock.user.findUnique.mockResolvedValue(user as any);
    compareMock.mockResolvedValue(true);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "user@example.com", password: "secret" });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.id).toBe(user.id);
    expect(res.body.user).not.toHaveProperty("password");
    expect(res.body.requiresPasswordChange).toBe(false);
  });

  it("lowercases the email before lookup", async () => {
    const user = makeUser();
    prismaMock.user.findUnique.mockResolvedValue(user as any);
    compareMock.mockResolvedValue(true);

    await request(app)
      .post("/api/auth/login")
      .send({ email: "USER@Example.com", password: "secret" });

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: "user@example.com" },
    });
  });

  it("flags requiresPasswordChange when isPasswordReset is true", async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      makeUser({ isPasswordReset: true }) as any
    );
    compareMock.mockResolvedValue(true);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "user@example.com", password: "secret" });

    expect(res.body.requiresPasswordChange).toBe(true);
  });

  it("returns 401 when the user does not exist", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "secret" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password");
  });

  it("returns 401 (same message) when the password is wrong", async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser() as any);
    compareMock.mockResolvedValue(false);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "user@example.com", password: "wrong" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password");
  });

  it("returns 400 for an invalid email format", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "not-an-email", password: "secret" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid input");
    expect(res.body.errors).toBeDefined();
  });

  it("returns 400 when the password is missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "user@example.com" });

    expect(res.status).toBe(400);
  });

  it("returns 400 for an empty body", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
  });

  it("returns 500 when the database throws", async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error("db down"));

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "user@example.com", password: "secret" });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Internal server error");
  });
});

describe("POST /api/auth/signup", () => {
  it("creates an admin user and returns a token", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue(
      makeUser({ id: "new-admin", role: UserRole.admin, email: "a@b.com" }) as any
    );

    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "A@B.com", password: "secret1", name: "Admin" });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).not.toHaveProperty("password");
    // Always created as admin and email is normalized + hashed.
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "a@b.com",
        role: UserRole.admin,
        password: "hashed:secret1",
      }),
    });
  });

  it("returns 400 when a user with that email already exists", async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser() as any);

    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "user@example.com", password: "secret1", name: "Admin" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("User already exists with this email");
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("returns 400 when the password is shorter than 6 chars", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "a@b.com", password: "12345", name: "Admin" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when the name is shorter than 2 chars", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "a@b.com", password: "secret1", name: "A" });

    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid email", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "bad", password: "secret1", name: "Admin" });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/change-password", () => {
  it("requires authentication", async () => {
    const res = await request(app)
      .post("/api/auth/change-password")
      .send({ oldPassword: "old123", newPassword: "new12345" });

    expect(res.status).toBe(401);
  });

  it("changes the password and clears isPasswordReset", async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      makeUser({ id: ADMIN.userId }) as any
    );
    compareMock.mockResolvedValue(true);
    prismaMock.user.update.mockResolvedValue(makeUser() as any);

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", authHeader(ADMIN))
      .send({ oldPassword: "old123", newPassword: "new12345" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Password changed successfully");
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: ADMIN.userId },
      data: { password: "hashed:new12345", isPasswordReset: false },
    });
  });

  it("returns 404 when the authenticated user no longer exists", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", authHeader(ADMIN))
      .send({ oldPassword: "old123", newPassword: "new12345" });

    expect(res.status).toBe(404);
  });

  it("returns 400 when the current password is incorrect", async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser() as any);
    compareMock.mockResolvedValue(false);

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", authHeader(ADMIN))
      .send({ oldPassword: "wrong", newPassword: "new12345" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Current password is incorrect");
  });

  it("rejects when the new password equals the old one", async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser() as any);
    compareMock.mockResolvedValue(true);

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", authHeader(ADMIN))
      .send({ oldPassword: "same123", newPassword: "same123" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      "New password must be different from the current password"
    );
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("returns 400 when the new password is too short", async () => {
    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", authHeader(ADMIN))
      .send({ oldPassword: "old123", newPassword: "123" });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/forgot-password", () => {
  it("stores a hashed token and emails a link when the account exists", async () => {
    const user = makeUser({ id: "u1", email: "user@example.com" });
    prismaMock.user.findUnique.mockResolvedValue(user as any);
    prismaMock.user.update.mockResolvedValue(user as any);

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "user@example.com" });

    expect(res.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledTimes(1);
    const updateArg = prismaMock.user.update.mock.calls[0]![0] as any;
    // Persisted token must be a SHA-256 hash (64 hex chars), never the raw token.
    expect(updateArg.data.resetToken).toMatch(/^[a-f0-9]{64}$/);
    expect(updateArg.data.resetTokenExpiry).toBeInstanceOf(Date);
    expect(resetEmailMock).toHaveBeenCalledTimes(1);
  });

  it("returns the same generic 200 when the account does NOT exist (no enumeration)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "ghost@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/If an account exists/i);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(resetEmailMock).not.toHaveBeenCalled();
  });

  it("still returns 200 when sending the email fails", async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser() as any);
    prismaMock.user.update.mockResolvedValue(makeUser() as any);
    resetEmailMock.mockRejectedValueOnce(new Error("smtp down"));

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "user@example.com" });

    expect(res.status).toBe(200);
  });

  it("returns 400 for an invalid email", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "nope" });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/reset-password", () => {
  it("resets the password for a valid, unexpired token", async () => {
    const rawToken = "raw-token-123";
    const user = makeUser({ id: "u1" });
    prismaMock.user.findFirst.mockResolvedValue(user as any);
    prismaMock.user.update.mockResolvedValue(user as any);

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken, newPassword: "brandnew1" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Password reset successfully");

    // Lookup must hash the raw token before matching, and check expiry.
    const findArg = prismaMock.user.findFirst.mock.calls[0]![0] as any;
    const expectedHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    expect(findArg.where.resetToken).toBe(expectedHash);
    expect(findArg.where.resetTokenExpiry.gte).toBeInstanceOf(Date);

    // Token fields are cleared on success.
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: {
        password: "hashed:brandnew1",
        resetToken: null,
        resetTokenExpiry: null,
        isPasswordReset: false,
      },
    });
  });

  it("returns 400 for an invalid or expired token", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "expired", newPassword: "brandnew1" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid or expired reset token");
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("returns 400 when the token is missing", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ newPassword: "brandnew1" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when the new password is too short", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "x", newPassword: "123" });

    expect(res.status).toBe(400);
  });
});

// keep imports referenced for type side-effects
void Prisma;
void hashMock;
