import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";

export function authenticate(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    const authHeader = req.headers.authorization;
    const cookieHeader = req.cookies;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined
    const cookiesToken = cookieHeader?.token

    // Prefer the cookie, but fall back to the Authorization: Bearer header so the
    // client (which stores the JWT in localStorage) works cross-site, where a
    // sameSite=lax cookie would never be sent.
    const token = cookiesToken ?? bearerToken;
    const payload = verifyToken(token);

    req.user = payload;
    next();
}
