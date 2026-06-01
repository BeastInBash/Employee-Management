import { Router } from "express";
import { requireAdmin } from "../middleware/roleCheck";
import {
    getMyAttendance,
    getMemberAttendanceReport,
    getAllMembersAttendanceReport,
    getTodayAttendanceOverview,
} from "../controllers/attendance.controller";
import { authenticate } from "../middleware/auth.middleware";

const attendanceRouter = Router();

attendanceRouter.use(authenticate);
attendanceRouter.get("/me", getMyAttendance);
attendanceRouter.get("/today", requireAdmin, getTodayAttendanceOverview);
attendanceRouter.get("/report", requireAdmin, getAllMembersAttendanceReport);
attendanceRouter.get("/report/:memberId", requireAdmin, getMemberAttendanceReport);

export default attendanceRouter;
