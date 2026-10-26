import request from "supertest";
import { prismaMock } from "./singleton";
import { createTestApp } from "./testApp";
import { authHeader, MEMBER, makeUser } from "./helpers";
import { sendVerificationEmail } from "../src/utils/email";
import { hashToken, VERIFICATION_TTL_MS } from "../src/utils/verification";

const app = createTestApp();
const verificationMock = sendVerificationEmail as jest.Mock;
const TOKEN = "a".repeat(64);

describe("POST /api/auth/signup", () => {
  it("sends a verification email but signs the person in right away", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue(
      makeUser({
        id: "new-admin",
        email: "sam@example.com",
        name: "Sam Rivera",
        role: "admin",
        emailVerified: false,
      }) as any,
    );
    prismaMock.user.update.mockResolvedValue({} as any);

    const res = await request(app)
      .post("/api/auth/signup")
      .send({ name: "Sam Rivera", email: "Sam@Example.com", password: "Passw0rd!" });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.verificationSent).toBe(true);
    expect(res.body.user).not.toHaveProperty("password");
    expect(res.body.user).not.toHaveProperty("emailVerificationToken");

    // Only the hash is stored; the raw token goes in the email.
    const stored = (prismaMock.user.update.mock.calls[0]![0] as any).data;
    const [to, name, rawToken] = verificationMock.mock.calls[0]!;
    expect([to, name]).toEqual(["sam@example.com", "Sam Rivera"]);
    expect(stored.emailVerificationToken).toBe(hashToken(rawToken));
    expect(stored.emailVerificationToken).not.toBe(rawToken);
  });
});

describe("POST /api/auth/verify-email", () => {
  it("confirms the address for a valid, unexpired token", async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: "u1", email: "sam@example.com" } as any);
    prismaMock.user.update.mockResolvedValue({} as any);

    const res = await request(app).post("/api/auth/verify-email").send({ token: TOKEN });

    expect(res.status).toBe(200);
    const where = (prismaMock.user.findFirst.mock.calls[0]![0] as any).where;
    expect(where.emailVerificationToken).toBe(hashToken(TOKEN));
    expect(where.emailVerificationExpiry.gte).toBeInstanceOf(Date);
    expect((prismaMock.user.update.mock.calls[0]![0] as any).data).toEqual({
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpiry: null,
    });
  });

  it("rejects an expired or already-used token", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    const res = await request(app).post("/api/auth/verify-email").send({ token: TOKEN });
    expect(res.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("rejects a malformed token without touching the database", async () => {
    const res = await request(app).post("/api/auth/verify-email").send({ token: "abc" });
    expect(res.status).toBe(400);
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/resend-verification", () => {
  const unverified = (sentMsAgo: number | null) =>
    ({
      id: MEMBER.userId,
      email: MEMBER.email,
      name: "Lena Kim",
      emailVerified: false,
      emailVerificationExpiry: sentMsAgo === null ? null : new Date(Date.now() - sentMsAgo + VERIFICATION_TTL_MS),
    }) as any;

  it("sends a fresh link", async () => {
    prismaMock.user.findUnique.mockResolvedValue(unverified(5 * 60_000));
    prismaMock.user.update.mockResolvedValue({} as any);
    const res = await request(app).post("/api/auth/resend-verification").set("Authorization", authHeader(MEMBER));
    expect(res.status).toBe(200);
    expect(verificationMock).toHaveBeenCalledTimes(1);
  });

  it("asks people to wait a minute between emails", async () => {
    prismaMock.user.findUnique.mockResolvedValue(unverified(10_000));
    const res = await request(app).post("/api/auth/resend-verification").set("Authorization", authHeader(MEMBER));
    expect(res.status).toBe(429);
    expect(res.body.retryAfter).toBeGreaterThan(0);
    expect(verificationMock).not.toHaveBeenCalled();
  });

  it("does nothing for an already-confirmed address", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...unverified(null), emailVerified: true });
    const res = await request(app).post("/api/auth/resend-verification").set("Authorization", authHeader(MEMBER));
    expect(res.status).toBe(200);
    expect(res.body.alreadyVerified).toBe(true);
    expect(verificationMock).not.toHaveBeenCalled();
  });

  it("reports when the email provider refuses the send", async () => {
    prismaMock.user.findUnique.mockResolvedValue(unverified(null));
    prismaMock.user.update.mockResolvedValue({} as any);
    verificationMock.mockResolvedValueOnce(false);
    const res = await request(app).post("/api/auth/resend-verification").set("Authorization", authHeader(MEMBER));
    expect(res.status).toBe(502);
  });
});
