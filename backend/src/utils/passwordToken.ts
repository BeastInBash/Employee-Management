import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { hashToken } from "./verification";

const prisma = new PrismaClient();

// One-time "choose a password" links, used for both resets and invites. The
// raw token goes in the email link; only its SHA-256 hash is stored (in
// User.resetToken), so a database leak can't be replayed.
export const RESET_TOKEN_TTL_MS = 4 * 24 * 60 * 60 * 1000; // 4 days
export const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
/** Minimum gap between unrequested set-password emails to one account. */
export const SETUP_EMAIL_COOLDOWN_MS = 60 * 1000;

/** Store a fresh token (replacing any earlier one) and return the raw value for the email. */
export async function issuePasswordToken(userId: string, ttlMs: number): Promise<string> {
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.user.update({
        where: { id: userId },
        data: { resetToken: hashToken(token), resetTokenExpiry: new Date(Date.now() + ttlMs) },
    });
    return token;
}

/** Whether a token issued with `ttlMs` and expiring at `expiry` was sent within the cooldown. */
export function sentRecently(expiry: Date | null, ttlMs: number): boolean {
    if (!expiry) return false;
    return Date.now() - (expiry.getTime() - ttlMs) < SETUP_EMAIL_COOLDOWN_MS;
}
