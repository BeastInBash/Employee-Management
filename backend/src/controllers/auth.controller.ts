import { Request, Response } from "express";
import { PrismaClient, UserRole } from "@prisma/client";
import { ZodError } from "zod";
import {
    loginSchema,
    signupSchema,
    changePasswordSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
} from "../validation/authValidation";
import { hashPassword, comparePassword, DEFAULT_PASSWORD } from "../utils/password";
import { generateToken } from "../utils/jwt";
import type { UserPayload } from "../config";
import { sendPasswordResetEmail, sendPasswordSetupEmail, sendVerificationEmail } from "../utils/email";
import { hashToken, issueVerificationToken, verificationCooldownLeft } from "../utils/verification";
import { INVITE_TOKEN_TTL_MS, RESET_TOKEN_TTL_MS, issuePasswordToken, sentRecently } from "../utils/passwordToken";

const prisma = new PrismaClient();

/** The login cookie mirrors the JWT's 7-day lifetime. */
export function setAuthCookie(res: Response, token: string): void {
    res.cookie("token", token, {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: process.env.NODE_ENV === "production",
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
    });
}

declare global {
    namespace Express {
        interface Request {
            /** The verified JWT payload, set by `authenticate`. */
            user?: UserPayload;
        }
    }
}
export async function login(req: Request, res: Response): Promise<void> {
    try {
        const validatedData = loginSchema.parse(req.body);

        const user = await prisma.user.findUnique({
            where: { email: validatedData.email.trim().toLowerCase() },
        });

        if (!user) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }

        // No password yet: an invited member who hasn't opened their invite, or
        // a Google-only account.
        if (!user.password) {
            res.status(401).json({
                message: user.isPasswordReset
                    ? 'You haven\'t chosen a password yet. Use the link in your invite email, or "Forgot password" to get a new one. You can also continue with Google.'
                    : 'This account signs in with Google. Use "Continue with Google" or reset your password.',
            });
            return;
        }

        const isPasswordValid = await comparePassword(validatedData.password, user.password);

        if (!isPasswordValid) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }

        // Members added before invites were given a shared temporary password,
        // so knowing someone's address was enough to get into their account.
        // Refuse it, and email the owner a link to choose their own instead.
        if (user.isPasswordReset && validatedData.password === DEFAULT_PASSWORD) {
            if (!sentRecently(user.resetTokenExpiry, INVITE_TOKEN_TTL_MS)) {
                const setupToken = await issuePasswordToken(user.id, INVITE_TOKEN_TTL_MS);
                await sendPasswordSetupEmail(user.email, user.name, setupToken, INVITE_TOKEN_TTL_MS / 86_400_000);
            }
            res.status(403).json({
                code: "password_setup_required",
                message: "Temporary passwords no longer work. We've emailed you a link to choose your own password.",
            });
            return;
        }

        const token = generateToken({
            userId: user.id,
            email: user.email,
            role: user.role,
        });

        // Never send credentials or token hashes to the client.
        const {
            password,
            resetToken,
            resetTokenExpiry,
            emailVerificationToken,
            emailVerificationExpiry,
            ...userWithoutPassword
        } = user;

        setAuthCookie(res, token);
        res.json({
            token,
            user: userWithoutPassword,
            requiresPasswordChange: user.isPasswordReset,
        });
    } catch (error) {
        console.error("Login error:", error);
        if (error instanceof ZodError) {
            res.status(400).json({ message: "Invalid input", errors: error.issues });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function signup(req: Request, res: Response): Promise<void> {
    try {
        const validatedData = signupSchema.parse(req.body);
        const email = validatedData.email.trim().toLowerCase();

        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            res.status(400).json({ message: "User already exists with this email" });
            return;
        }

        const hashedPassword = await hashPassword(validatedData.password);

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name: validatedData.name,
                role: UserRole.admin,
            },
        });

        const token = generateToken({
            userId: user.id,
            email: user.email,
            role: user.role,
        });

        // Verification is soft: the account works right away, and the app
        // nudges until the link is clicked.
        const verificationToken = await issueVerificationToken(user.id);
        const verificationSent = await sendVerificationEmail(user.email, user.name, verificationToken);

        const {
            password,
            emailVerificationToken,
            emailVerificationExpiry,
            resetToken,
            resetTokenExpiry,
            ...userWithoutPassword
        } = user;

        res.status(201).json({
            token,
            user: userWithoutPassword,
            verificationSent,
        });
    } catch (error) {
        console.error("Signup error:", error);
        if (error instanceof ZodError) {
            res.status(400).json({ message: "Invalid input", errors: error.issues });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function changePassword(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Authentication required" });
            return;
        }

        const validatedData = changePasswordSchema.parse(req.body);

        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
        });

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        if (!user.password) {
            res.status(400).json({
                message: 'Your account signs in with Google. Use "Forgot password" to set a password.',
            });
            return;
        }

        const isOldPasswordValid = await comparePassword(validatedData.oldPassword, user.password);

        if (!isOldPasswordValid) {
            res.status(400).json({ message: "Current password is incorrect" });
            return;
        }

        if (validatedData.oldPassword === validatedData.newPassword) {
            res.status(400).json({
                message: "New password must be different from the current password",
            });
            return;
        }

        const hashedNewPassword = await hashPassword(validatedData.newPassword);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedNewPassword,
                isPasswordReset: false, // Mark that password has been changed
            },
        });

        res.json({ message: "Password changed successfully" });
    } catch (error) {
        console.error("Change password error:", error);
        if (error instanceof ZodError) {
            res.status(400).json({ message: "Invalid input", errors: error.issues });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
    try {
        const validatedData = forgotPasswordSchema.parse(req.body);

        const user = await prisma.user.findUnique({
            where: { email: validatedData.email.trim().toLowerCase() },
        });

        // Always respond the same way whether or not the account exists, so this
        // endpoint can't be used to enumerate registered email addresses.
        if (user) {
            const rawToken = await issuePasswordToken(user.id, RESET_TOKEN_TTL_MS);

            // Never surface a send failure: the response must not reveal
            // whether the account exists.
            try {
                await sendPasswordResetEmail(user.email, user.name, rawToken, RESET_TOKEN_TTL_MS / 3_600_000);
            } catch (emailError) {
                console.error("Failed to send password reset email:", emailError);
            }
        }

        res.json({
            message: "If an account exists for that email, a password reset link has been sent.",
        });
    } catch (error) {
        console.error("Forgot password error:", error);
        if (error instanceof ZodError) {
            res.status(400).json({ message: "Invalid input", errors: error.issues });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
    try {
        const validatedData = resetPasswordSchema.parse(req.body);

        const tokenHash = hashToken(validatedData.token);

        const user = await prisma.user.findFirst({
            where: {
                resetToken: tokenHash,
                resetTokenExpiry: { gte: new Date() },
            },
        });

        if (!user) {
            res.status(400).json({ message: "Invalid or expired reset token" });
            return;
        }

        const hashedPassword = await hashPassword(validatedData.newPassword);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetToken: null,
                resetTokenExpiry: null,
                isPasswordReset: false,
                // The link only reached this inbox, so using it proves the
                // address (this is how invited members confirm theirs).
                emailVerified: true,
                emailVerificationToken: null,
                emailVerificationExpiry: null,
            },
        });

        res.json({ message: "Password reset successfully" });
    } catch (error) {
        console.error("Reset password error:", error);
        if (error instanceof ZodError) {
            res.status(400).json({ message: "Invalid input", errors: error.issues });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
    }
}

/** GET /api/auth/me — the signed-in user (used after Google sign-in to load the profile). */
export async function getMe(req: Request, res: Response): Promise<void> {
    if (!req.user) {
        res.status(401).json({ message: "Authentication required" });
        return;
    }
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                image: true,
                emailVerified: true,
                isPasswordReset: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        res.json({ user, requiresPasswordChange: user.isPasswordReset });
    } catch (error) {
        console.error("Get me error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

/**
 * POST /api/auth/verify-email { token } — public, since the link may be opened
 * on a device where the person isn't signed in.
 */
export async function verifyEmail(req: Request, res: Response): Promise<void> {
    try {
        const token = typeof req.body?.token === "string" ? req.body.token : "";
        if (!/^[a-f0-9]{64}$/.test(token)) {
            res.status(400).json({
                message: "This confirmation link is incomplete. Open the newest email and try again.",
            });
            return;
        }

        const user = await prisma.user.findFirst({
            where: { emailVerificationToken: hashToken(token), emailVerificationExpiry: { gte: new Date() } },
            select: { id: true, email: true },
        });
        if (!user) {
            res.status(400).json({
                message: "This confirmation link has expired or was already used. Sign in and send yourself a new one.",
            });
            return;
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { emailVerified: true, emailVerificationToken: null, emailVerificationExpiry: null },
        });
        res.json({ message: "Email confirmed", email: user.email });
    } catch (error) {
        console.error("Verify email error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

/** POST /api/auth/resend-verification (auth) — at most one email a minute. */
export async function resendVerification(req: Request, res: Response): Promise<void> {
    if (!req.user) {
        res.status(401).json({ message: "Authentication required" });
        return;
    }
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { id: true, email: true, name: true, emailVerified: true, emailVerificationExpiry: true },
        });
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        if (user.emailVerified) {
            res.json({ message: "Your email is already confirmed", alreadyVerified: true });
            return;
        }

        const wait = verificationCooldownLeft(user.emailVerificationExpiry);
        if (wait > 0) {
            res.status(429).json({
                message: `We just sent one. You can ask again in ${wait} seconds.`,
                retryAfter: wait,
            });
            return;
        }

        const token = await issueVerificationToken(user.id);
        if (!(await sendVerificationEmail(user.email, user.name, token))) {
            res.status(502).json({ message: "The email couldn't be sent right now. Try again in a few minutes." });
            return;
        }
        res.json({ message: `Confirmation email sent to ${user.email}` });
    } catch (error) {
        console.error("Resend verification error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}
