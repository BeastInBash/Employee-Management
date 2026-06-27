import express from "express";
import authRoutes from "../src/routes/auth.router";
import memberRoutes from "../src/routes/members.router";
import taskRoutes from "../src/routes/tasks.router";
import attendanceRouter from "../src/routes/attendance.router";

// Mirrors src/index.ts route wiring but without CORS, the cron jobs, or
// app.listen(), so the app can be exercised with supertest in-process.
export function createTestApp(): express.Express {
  const app = express();
  app.use(express.json());

  app.use("/api/auth", authRoutes);
  app.use("/api/members", memberRoutes);
  app.use("/api/tasks", taskRoutes);
  app.use("/api/attendance", attendanceRouter);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Same fallthrough error handler as production.
  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      res.status(500).json({ message: "Something went wrong!" });
    }
  );

  return app;
}
