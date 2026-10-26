import crypto from "crypto";
import { Router, Request, Response, NextFunction } from "express";
import { processEODAttendance } from "../cron/attendancecron";

// Machine-to-machine endpoints, called by schedulers rather than the client.
// The scheduler (cron-job.org in production) must send
// `Authorization: Bearer <CRON_SECRET>`, matching the env var on the backend.
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

/**
 * End-of-day attendance (9:00 PM IST). GET for the scheduler, POST for a manual
 * re-run. `?dryRun=1` checks the whole path (auth, database, counts) without
 * writing anything — use it to test outside 9 PM.
 */
const runEOD = async (req: Request, res: Response): Promise<void> => {
    const dryRun = req.query.dryRun === "1" || req.query.dryRun === "true";
    try {
        res.json(await processEODAttendance({ dryRun }));
    } catch (error) {
        console.error("EOD attendance processing error:", error);
        res.status(500).json({ message: "End-of-day attendance failed. Check the logs and re-run." });
    }
};

router.get("/cron/eod", requireCronSecret, runEOD);
router.post("/cron/eod", requireCronSecret, runEOD);

export default router;
