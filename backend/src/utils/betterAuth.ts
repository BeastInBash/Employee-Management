import "dotenv/config";
import { pathToFileURL } from "url";
import type { IncomingHttpHeaders } from "http";
import type { NextFunction, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
// Type-only imports are erased at compile time, so they never load the package.
import type { betterAuth as BetterAuthFn } from "better-auth";
import type { prismaAdapter as PrismaAdapterFn } from "better-auth/adapters/prisma";
import type { toNodeHandler as ToNodeHandlerFn } from "better-auth/node";

// Better Auth runs only the Google OAuth handshake (state, PKCE, code exchange,
// profile). It keeps its own tables (AuthUser/AuthSession/…); the app's User is
// resolved from the Google-verified email in utils/googleAuth.ts, and the app
// keeps issuing its own JWT.
//
// better-auth is ESM-only and this backend compiles to CommonJS. `require()` of
// an ES module only works on Node 20.19+/22.12+, and some hosts (e.g. older
// Vercel runtimes) refuse it — crashing the whole API at startup. So it is
// loaded lazily with a real dynamic `import()` on first use instead. Keep every
// value import of better-auth inside this file.

const prisma = new PrismaClient();

/** Public URL of this API — Google redirects back to `${API_URL}/api/better-auth/callback/google`. */
// Not BACKEND_URL: that one targets the keep-alive ping and points at prod even locally.
export const API_URL = (process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? 3000}`).replace(/\/$/, "");
export const CLIENT_URL = (process.env.CLIENT_URL ?? "http://localhost:5173").replace(/\/$/, "");

export const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

/**
 * A real `import()`. Written via `Function` because TypeScript's CommonJS output
 * would otherwise rewrite `import(x)` into `require(x)` — the exact call that fails.
 */
const esmImport = new Function("specifier", "return import(specifier)") as <T>(specifier: string) => Promise<T>;

/**
 * Import an ESM-only package from CommonJS. The path is resolved with
 * `require.resolve` (resolving never executes the module, so it is safe), which
 * also lets Vercel's file tracer see — and ship — the package.
 */
function importPackage<T>(resolved: string): Promise<T> {
    return esmImport<T>(pathToFileURL(resolved).href);
}

function buildAuth(betterAuth: typeof BetterAuthFn, prismaAdapter: typeof PrismaAdapterFn) {
    return betterAuth({
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
}

export type Auth = ReturnType<typeof buildAuth>;

let authPromise: Promise<Auth> | null = null;

/** The Better Auth instance, created on first use and shared afterwards. */
export function getAuth(): Promise<Auth> {
    authPromise ??= Promise.all([
        importPackage<{ betterAuth: typeof BetterAuthFn }>(require.resolve("better-auth")),
        importPackage<{ prismaAdapter: typeof PrismaAdapterFn }>(require.resolve("better-auth/adapters/prisma")),
    ])
        .then(([core, adapter]) => buildAuth(core.betterAuth, adapter.prismaAdapter))
        .catch((error) => {
            // Let the next request retry instead of caching a failure forever.
            authPromise = null;
            throw error;
        });
    return authPromise;
}

let handlerPromise: Promise<ReturnType<typeof ToNodeHandlerFn>> | null = null;

/**
 * Express middleware for Better Auth's own routes (/api/better-auth/*), loading
 * the library on the first request. A load failure becomes a normal error
 * response; the rest of the API keeps running.
 */
export async function betterAuthHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        handlerPromise ??= Promise.all([
            getAuth(),
            importPackage<{ toNodeHandler: typeof ToNodeHandlerFn }>(require.resolve("better-auth/node")),
        ]).then(([auth, node]) => node.toNodeHandler(auth));
        const handler = await handlerPromise;
        await handler(req, res);
    } catch (error) {
        handlerPromise = null;
        next(error);
    }
}

/** Node request headers → Fetch `Headers` (what Better Auth's API expects). */
export function toWebHeaders(headers: IncomingHttpHeaders): Headers {
    const out = new Headers();
    for (const [key, value] of Object.entries(headers)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) value.forEach((v) => out.append(key, v));
        else out.set(key, value);
    }
    return out;
}
