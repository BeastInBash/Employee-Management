import request from "supertest";
import { UserRole } from "@prisma/client";
import { prismaMock } from "./singleton";
import { createTestApp } from "./testApp";
import { makeUser } from "./helpers";
import { resolveGoogleUser } from "../src/utils/googleAuth";

const app = createTestApp();

const profile = { email: "Ada@Example.com", name: "Ada Lovelace", image: "https://img/ada.png", emailVerified: true };

describe("resolveGoogleUser", () => {
  it("refuses a Google account whose email isn't verified", async () => {
    const result = await resolveGoogleUser({ ...profile, emailVerified: false });
    expect(result).toEqual({ ok: false, reason: "email_unverified" });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("creates an admin without a password for an unknown email", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockImplementation((async (args: any) => makeUser({ ...args.data, id: "new" })) as any);

    const result = await resolveGoogleUser(profile);

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: "ada@example.com" } });
    expect(prismaMock.user.create.mock.calls[0]![0].data).toEqual({
      email: "ada@example.com",
      name: "Ada Lovelace",
      password: null,
      role: UserRole.admin,
      emailVerified: true,
      image: "https://img/ada.png",
    });
    expect(result).toEqual(expect.objectContaining({ ok: true, created: true, passwordDisabled: false }));
  });

  it("switches off the default password on a member's first Google sign-in", async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      makeUser({ email: "ada@example.com", password: "hashed:123456", isPasswordReset: true, emailVerified: false }) as any
    );
    prismaMock.user.update.mockImplementation((async (args: any) => makeUser({ ...args.data })) as any);

    const result = await resolveGoogleUser(profile);

    expect(prismaMock.user.update.mock.calls[0]![0].data).toEqual({
      emailVerified: true,
      password: null,
      isPasswordReset: false,
      resetToken: null,
      resetTokenExpiry: null,
      image: "https://img/ada.png",
    });
    expect(result).toEqual(expect.objectContaining({ ok: true, created: false, passwordDisabled: true }));
  });

  it("leaves an already-verified account's password alone", async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      makeUser({ email: "ada@example.com", password: "hashed:mine", emailVerified: true, image: "https://img/old.png" }) as any
    );

    const result = await resolveGoogleUser(profile);

    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ ok: true, created: false, passwordDisabled: false }));
  });
});

describe("password login for Google-only accounts", () => {
  it("explains that the account uses Google instead of comparing a null password", async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ email: "ada@example.com", password: null }) as any);

    const res = await request(app).post("/api/auth/login").send({ email: "ada@example.com", password: "whatever1" });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Google/);
  });
});
