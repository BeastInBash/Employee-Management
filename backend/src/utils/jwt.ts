import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { UserRole } from "@prisma/client";

// Fail fast instead of silently signing tokens with a guessable fallback secret,
// which would let anyone forge a valid session.
if (!process.env.JWT_SECRET) {
    throw new Error(
        "JWT_SECRET environment variable is not set. Refusing to start with an insecure fallback."
    );
}

const JWT_SECRET: string = process.env.JWT_SECRET;

const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ||
    "7d") as NonNullable<SignOptions["expiresIn"]>;

export interface JwtPayload {
    userId: string;
    email: string;
    role: UserRole;
}

export function generateToken(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
