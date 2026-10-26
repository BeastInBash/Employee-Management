import crypto from "crypto";
import { Router, Request, Response, NextFunction } from "express";
import { processEODAttendance } from "../cron/attendancecron";

// Machine-to-machine endpoints, called by schedulers rather than the client.
// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when that env var is
// set on the project; any other scheduler can send the same header.
const router = Router();

function requireCronSecret(req: Request, res: Response, next: NextFunction): void {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        res.status(503).json({ message: "CRON_SECRET is not configured" });
        return;
    }
    const given = Buffer.from(req.headers.authorization ?? "");
    const expected = Buffer.from(`Bearer ${secret}`);
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    next();
}

/** End-of-day attendance (9:00 PM IST). GET for Vercel Cron, POST for a manual re-run. */
const runEOD = async (_req: Request, res: Response): Promise<void> => {
    try {
        res.json(await processEODAttendance());
    } catch (error) {
        console.error("EOD attendance processing error:", error);
        res.status(500).json({ message: "End-of-day attendance failed. Check the logs and re-run." });
    }
};

router.get("/cron/eod", requireCronSecret, runEOD);
router.post("/cron/eod", requireCronSecret, runEOD);

export default router;
