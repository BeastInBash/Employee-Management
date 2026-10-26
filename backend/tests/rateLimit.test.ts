import express from "express";
import request from "supertest";
import { prismaMock } from "./singleton";
import authRoutes from "../src/routes/auth.router";
import { makeUser } from "./helpers";
import { comparePassword } from "../src/utils/password";

// The limiters skip themselves under NODE_ENV=test; this file turns them on.
// Each test uses its own forwarded IP and email so counters don't leak between
// tests (the stores are module-level and in memory).
process.env.RATE_LIMIT_IN_TESTS = "1";

const app = express();
app.set("trust proxy", true);
app.use(express.json());
app.use("/api/auth", authRoutes);

const compareMock = comparePassword as jest.Mock;

const login = (ip: string, email: string, password = "wrong") =>
  request(app).post("/api/auth/login").set("X-Forwarded-For", ip).send({ email, password });

afterAll(() => {
  delete process.env.RATE_LIMIT_IN_TESTS;
});

describe("sign-in rate limits", () => {
  it("locks one account after 8 failed attempts, even from different networks", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null); // every attempt fails with 401

    for (let i = 0; i < 8; i++) {
      const res = await login(`10.1.0.${i + 1}`, "target@example.com");
      expect(res.status).toBe(401);
    }
    const blocked = await login("10.1.0.99", "Target@Example.com "); // same account, normalised

    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe("rate_limited");
    expect(blocked.body.limiter).toBe("login-email");
    expect(blocked.body.message).toMatch(/Try again in \d+ minutes?\./);
    expect(blocked.headers["retry-after"]).toBeDefined();
  });

  it("blocks one network after 20 failed attempts across many accounts", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    for (let i = 0; i < 20; i++) {
      expect((await login("10.2.0.1", `person${i}@example.com`)).status).toBe(401);
    }
    const blocked = await login("10.2.0.1", "someone-else@example.com");

    expect(blocked.status).toBe(429);
    expect(blocked.body.limiter).toBe("login-ip");
    // A different network is unaffected.
    expect((await login("10.2.0.2", "someone-else@example.com")).status).toBe(401);
  });

  it("doesn't count successful sign-ins, so a busy office isn't locked out", async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ email: "staff@example.com" }) as any);
    compareMock.mockResolvedValue(true);

    for (let i = 0; i < 30; i++) {
      expect((await login("10.3.0.1", "staff@example.com", "right")).status).toBe(200);
    }
  });
});

describe("password reset rate limits", () => {
  it("sends at most 3 reset emails an hour to one inbox", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const forgot = (ip: string) =>
      request(app).post("/api/auth/forgot-password").set("X-Forwarded-For", ip).send({ email: "inbox@example.com" });

    for (let i = 0; i < 3; i++) {
      expect((await forgot(`10.4.0.${i + 1}`)).status).toBe(200);
    }
    const blocked = await forgot("10.4.0.50");

    expect(blocked.status).toBe(429);
    expect(blocked.body.limiter).toBe("forgot-email");
  });
});
