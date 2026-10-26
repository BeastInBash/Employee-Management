import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import ApiError from "../utils/errors/ApiError";

export const handleError = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: err.issues });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        // Unique constraint (e.g. adding someone twice) / record vanished mid-request.
        if (err.code === 'P2002') return res.status(409).json({ message: "That record already exists" });
        if (err.code === 'P2025') return res.status(404).json({ message: "Record not found" });
    }
    const status = err instanceof ApiError ? err.statusCode : 500;
    if (status === 500) console.error(err instanceof Error ? err.stack : err);
    res.status(status).json({ message: (err instanceof Error && err.message) || "Something went wrong!" });
}
