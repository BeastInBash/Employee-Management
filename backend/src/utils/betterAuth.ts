import "dotenv/config";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";

// Better Auth runs only the Google OAuth handshake (state, PKCE, code exchange,
// profile). It keeps its own tables (AuthUser/AuthSession/…); the app's User is
// resolved from the Google-verified email in utils/googleAuth.ts, and the app
// keeps issuing its own JWT. better-auth is ESM-only — Node 22.12+ loads it from
// this CommonJS build via require(esm). Keep imports of it confined to this
// file and routes/google.router.ts so the Jest suite never loads it.

const prisma = new PrismaClient();

/** Public URL of this API — Google redirects back to `${API_URL}/api/better-auth/callback/google`. */
// Not BACKEND_URL: that one targets the keep-alive ping and points at prod even locally.
export const API_URL = (process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? 3000}`).replace(/\/$/, "");
export const CLIENT_URL = (process.env.CLIENT_URL ?? "http://localhost:5173").replace(/\/$/, "");

export const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
    appName: "Crewly",
    baseURL: API_URL,
    basePath: "/api/better-auth",
    // Falls back to the JWT secret so existing deployments keep booting; set a
    // dedicated BETTER_AUTH_SECRET in production.
    secret: process.env.BETTER_AUTH_SECRET ?? process.env.JWT_SECRET!,
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    user: { modelName: "authUser" },
    session: { modelName: "authSession" },
    account: { modelName: "authAccount" },
    verification: { modelName: "authVerification" },
    emailAndPassword: { enabled: false },
    socialProviders: googleEnabled
        ? {
              google: {
                  clientId: process.env.GOOGLE_CLIENT_ID!,
                  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
                  // Let people pick which Google account to use every time.
                  prompt: "select_account",
              },
          }
        : {},
    // The client is a different origin; it's where errors and the final redirect go.
    trustedOrigins: [CLIENT_URL],
    onAPIError: { errorURL: `${CLIENT_URL}/login?error=google_failed` },
    advanced: { database: { generateId: "uuid" } },
});
