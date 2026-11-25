import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";

export function authenticate(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    const cookiesToken: string | undefined = req.cookies?.token;

    // Prefer the cookie, but fall back to the Authorization: Bearer header so the
    // client (which stores the JWT in localStorage) works cross-site, where a
    // sameSite=lax cookie would never be sent.
    const token = cookiesToken ?? bearerToken;
    if (!token) {
        res.status(401).json({ message: "Authentication required" });
        return;
    }

    try {
        req.user = verifyToken(token);
    } catch {
        // Bad signature, malformed or expired: all mean "sign in again", never a 500.
        res.status(401).json({ message: "Invalid or expired token" });
        return;
    }
    next();
}
