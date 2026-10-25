import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
/** Minimum gap between verification emails to one account. */
export const RESEND_COOLDOWN_MS = 60 * 1000;

export const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

/**
 * Create a fresh verification token for a user and store its hash. Returns the
 * raw token for the email link; it is never persisted.
 */
export async function issueVerificationToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.user.update({
        where: { id: userId },
        data: {
            emailVerificationToken: hashToken(token),
            emailVerificationExpiry: new Date(Date.now() + VERIFICATION_TTL_MS),
        },
    });
    return token;
}

/** Seconds until another verification email may be sent (0 = now). */
export function verificationCooldownLeft(expiry: Date | null): number {
    if (!expiry) return 0;
    const sentAt = expiry.getTime() - VERIFICATION_TTL_MS;
    return Math.max(0, Math.ceil((sentAt + RESEND_COOLDOWN_MS - Date.now()) / 1000));
}
