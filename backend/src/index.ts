import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.router";
import memberRoutes from "./routes/members.router";
import taskRoutes from "./routes/tasks.router";
import attendanceRouter from "./routes/attendance.router";
import { startAttendanceCronJobs } from "./cron/attendancecron";
import { startKeepAliveCron } from "./cron/pingcron";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware

app.use(express.json());
app.use(cors({
    // origin: ['https://todo-app-212w.vercel.app'],
    origin: ["https://todo-app-z7g1.vercel.app", "http://localhost:5173"],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
// Routes
app.use("/api/auth", authRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/attendance", attendanceRouter);
// Health check
app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ message: "Something went wrong!" });
});

startAttendanceCronJobs();
startKeepAliveCron();
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
