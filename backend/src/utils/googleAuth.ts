import { PrismaClient, UserRole, type User } from "@prisma/client";

const prisma = new PrismaClient();

export interface GoogleProfile {
    email: string;
    name: string;
    image?: string | null | undefined;
    emailVerified: boolean;
}

export type GoogleSignInResult =
    { ok: true; user: User; created: boolean; passwordDisabled: boolean } | { ok: false; reason: "email_unverified" };

/**
 * Map a Google identity onto the app's User, keyed by the verified email.
 *
 * - Unknown email → a new **admin** (same as the Sign up tab), with no password.
 * - Known email, first Google sign-in (`emailVerified` still false) → the email
 *   is now proven, so any existing password is switched off. That covers the
 *   default `123456` handed to new members, and stops someone who signed up
 *   with another person's address from keeping a password into the account
 *   that person now signs into. A password can be set again via "Forgot password".
 * - Known, already-verified email → plain sign-in.
 */
export async function resolveGoogleUser(profile: GoogleProfile): Promise<GoogleSignInResult> {
    if (!profile.emailVerified) return { ok: false, reason: "email_unverified" };

    const email = profile.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });

    if (!existing) {
        const user = await prisma.user.create({
            data: {
                email,
                name: profile.name.trim() || email.split("@")[0]!,
                password: null,
                role: UserRole.admin,
                emailVerified: true,
                image: profile.image ?? null,
            },
        });
        return { ok: true, user, created: true, passwordDisabled: false };
    }

    if (!existing.emailVerified) {
        const user = await prisma.user.update({
            where: { id: existing.id },
            data: {
                emailVerified: true,
                password: null,
                isPasswordReset: false,
                resetToken: null,
                resetTokenExpiry: null,
                ...(!existing.image && profile.image && { image: profile.image }),
            },
        });
        return { ok: true, user, created: false, passwordDisabled: existing.password !== null };
    }

    const user =
        !existing.image && profile.image
            ? await prisma.user.update({ where: { id: existing.id }, data: { image: profile.image } })
            : existing;
    return { ok: true, user, created: false, passwordDisabled: false };
}
