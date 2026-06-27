import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";

export function authenticate(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    try {
        const authHeader = req.headers.authorization;
        const cookieHeader = req.cookies;
        const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined
        const cookiesToken = cookieHeader.token


        const token = cookiesToken;
        const payload = verifyToken(token);

        req.user = payload;
        next();
    } catch (error) {
        res.status(401).json({ message: "Invalid or expired token" });
    }
}
