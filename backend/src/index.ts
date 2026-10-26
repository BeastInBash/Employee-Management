import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.router";
import memberRoutes from "./routes/members.router";
import taskRoutes from "./routes/tasks.router";
import attendanceRouter from "./routes/attendance.router";
import { startAttendanceCronJobs } from "./cron/attendancecron";
import orgRouter from "./routes/organization.router";
// import { startKeepAliveCron } from "./cron/pingcron";
import cookieParser from 'cookie-parser'
import workspaceRouter from "./routes/workspace.router";
import projectsRouter from "./routes/projects.router";
import teamsRouter from "./routes/teams.router";
import reportsRouter from "./routes/reports.router";
import internalRouter from "./routes/internal.router";
import googleRouter from "./routes/google.router";
import { betterAuthHandler } from "./utils/betterAuth";
import { apiByIp } from "./middleware/rateLimit";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware

// Vercel and Render sit one proxy in front of the app; trusting that hop makes
// req.ip the visitor's address (rate limits key on it) instead of the proxy's.
app.set("trust proxy", 1);
// Security headers. The client lives on another origin, so let it read responses.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// Better Auth parses its own bodies, so it must be mounted before express.json().
app.all("/api/better-auth/*splat", betterAuthHandler);
app.use(express.json());
app.use(cookieParser())
app.use(cors({
    // origin: ['https://todo-app-212w.vercel.app'],
    origin: ["https://todo-app-z7g1.vercel.app", "https://employee-management-uzdd.vercel.app", "http://localhost:5173"],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
// Routes
app.use("/api", apiByIp);
app.use("/api/auth", googleRouter);
app.use("/api/auth", authRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/attendance", attendanceRouter);
app.use('/api/org', orgRouter)
app.use('/api/workspace',workspaceRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/teams', teamsRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/internal', internalRouter)
// Health check
app.get("/health", (req, res) => {
    console.log("Working Fine ....")

    res.json({ status: "ok", timestamp: new Date().toISOString() });

});

// Error handling middleware
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err instanceof Error ? err.stack : err);
    res.status(500).json({ message: "Something went wrong!" });
});

startAttendanceCronJobs();
// startKeepAliveCron();
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
