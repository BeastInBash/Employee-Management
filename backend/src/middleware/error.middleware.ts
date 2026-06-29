import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import ApiError from "../utils/errors/ApiError";

export const handleError = (err: any, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: err.issues });
    }
    const status = err instanceof ApiError ? err.statusCode : 500;
    if (status === 500) console.error(err.stack);
    res.status(status).json({ message: err.message ?? "Something went wrong!" });
}
