import type { Request, Response, NextFunction } from 'express'
import ApiError from "../utils/errors/ApiError";

export const handleError = (err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err instanceof ApiError ? err.statusCode : 500;
    if (status === 500) console.error(err.stack);
    res.status(status).json({ message: err.message ?? "Something went wrong!" });
}
