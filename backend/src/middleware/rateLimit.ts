import { Request } from "express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import type { Options } from "express-rate-limit";

// Limits for the endpoints people could abuse: guessing passwords, flooding
// inboxes with reset/verification emails, mass sign-ups. Each is keyed by IP
// and, where the request names an account, by that email as well, so neither
// one machine nor many machines aimed at one account get far.
//
// The counters live in memory. On Vercel each warm instance keeps its own, so
// these are a per-instance ceiling rather than a global one; a shared store
// (e.g. Redis) would make them exact.

const MINUTE = 60 * 1000;

const minutes = (ms: number) => Math.max(1, Math.ceil(ms / MINUTE));

/** The email a request is about, normalised the way the controllers look it up. */
const emailKey = (req: Request) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    return email ? `email:${email}` : `ip:${ipKeyGenerator(req.ip ?? "")}`;
};

function limiter(
    name: string,
    { windowMs, limit, message, ...rest }: { windowMs: number; limit: number; message: string } & Partial<Options>
) {
    return rateLimit({
        windowMs,
        limit,
        standardHeaders: "draft-8", // RateLimit + Retry-After headers
        legacyHeaders: false,
        // Every test request comes from one address, so the suite would trip these.
        // tests/rateLimit.test.ts turns them on with RATE_LIMIT_IN_TESTS.
        skip: () => process.env.NODE_ENV === "test" && !process.env.RATE_LIMIT_IN_TESTS,
        handler: (req, res, _next, options) => {
            // Minutes until this counter resets (at most the whole window).
            const resetTime = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
            const retryAfter = minutes(resetTime ? resetTime.getTime() - Date.now() : options.windowMs);
            res.status(429).json({
                message: `${message} Try again in ${retryAfter} ${retryAfter === 1 ? "minute" : "minutes"}.`,
                code: "rate_limited",
                limiter: name,
            });
        },
        ...rest,
    });
}

// ─── sign-in ────────────────────────────────────────────────────────────────

/** Failed sign-ins from one address. Successful ones don't count, so a busy office isn't locked out. */
export const loginByIp = limiter("login-ip", {
    windowMs: 15 * MINUTE,
    limit: 20,
    skipSuccessfulRequests: true,
    message: "Too many failed sign-in attempts from this network.",
});

/** Failed sign-ins against one account, from anywhere. */
export const loginByEmail = limiter("login-email", {
    windowMs: 15 * MINUTE,
    limit: 8,
    skipSuccessfulRequests: true,
    keyGenerator: emailKey,
    message: "Too many failed sign-in attempts for this account.",
});

// ─── emails we send on request ──────────────────────────────────────────────

/** Reset links from one address. The response stays generic, so this reveals nothing about accounts. */
export const forgotByIp = limiter("forgot-ip", {
    windowMs: 60 * MINUTE,
    limit: 10,
    message: "Too many password reset requests from this network.",
});

/** Reset links to one inbox. */
export const forgotByEmail = limiter("forgot-email", {
    windowMs: 60 * MINUTE,
    limit: 3,
    keyGenerator: emailKey,
    message: "Too many password reset requests for this email.",
});

/** New verification links (already capped at one a minute per account in the controller). */
export const resendVerificationByIp = limiter("resend-ip", {
    windowMs: 60 * MINUTE,
    limit: 10,
    message: "Too many verification emails requested.",
});

// ─── accounts and tokens ────────────────────────────────────────────────────

export const signupByIp = limiter("signup-ip", {
    windowMs: 60 * MINUTE,
    limit: 5,
    message: "Too many accounts created from this network.",
});

/** Reset/invite and verification tokens are 256-bit, so this only stops noise. */
export const tokenByIp = limiter("token-ip", {
    windowMs: 15 * MINUTE,
    limit: 20,
    message: "Too many attempts with this link.",
});

/** A wide ceiling for the whole API, well above what a team in one office generates. */
export const apiByIp = limiter("api-ip", {
    windowMs: 5 * MINUTE,
    limit: 1500,
    message: "Too many requests from this network.",
});
