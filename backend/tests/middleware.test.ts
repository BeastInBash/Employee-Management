import request from "supertest";
import jwt from "jsonwebtoken";
import { createTestApp } from "./testApp";
import { authHeader, ADMIN } from "./helpers";

const app = createTestApp();

describe("GET /health", () => {
  it("is public and returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.timestamp).toEqual(expect.any(String));
  });
});

describe("authenticate middleware", () => {
  it("rejects a request with no Authorization header", async () => {
    const res = await request(app).get("/api/members");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Authentication required");
  });

  it("rejects an Authorization header without the Bearer scheme", async () => {
    const res = await request(app)
      .get("/api/members")
      .set("Authorization", "Token abc.def.ghi");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Authentication required");
  });

  it("rejects a malformed / garbage token", async () => {
    const res = await request(app)
      .get("/api/members")
      .set("Authorization", "Bearer not-a-real-jwt");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid or expired token");
  });

  it("rejects a token signed with the wrong secret", async () => {
    const forged = jwt.sign(
      { userId: "x", email: "x@example.com", role: "admin" },
      "the-wrong-secret"
    );
    const res = await request(app)
      .get("/api/members")
      .set("Authorization", `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it("rejects an expired token", async () => {
    const expired = jwt.sign(
      { userId: "x", email: "x@example.com", role: "admin" },
      process.env.JWT_SECRET as string,
      { expiresIn: "-1h" }
    );
    const res = await request(app)
      .get("/api/members")
      .set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid or expired token");
  });

  it("accepts a validly signed token and reaches the handler", async () => {
    // No DB mock set → handler runs and (since member.findMany resolves to the
    // default deep-mock undefined) returns 200 with an empty body shape.
    const res = await request(app)
      .get("/api/members")
      .set("Authorization", authHeader(ADMIN));
    expect(res.status).toBe(200);
  });
});

describe("unknown routes", () => {
  it("returns 404 for an unmounted path", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
  });
});
