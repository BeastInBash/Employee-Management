import cron from "node-cron";
import { PrismaClient, AttendanceStatus, TaskStatus } from "@prisma/client";
import { getTodayISTDate } from "../utils/attendance";

const prisma = new PrismaClient();

// Fires at 9:00 PM IST = 3:30 PM UTC
export function startAttendanceCronJobs(): void {
  cron.schedule("30 15 * * *", processEODAttendance, { timezone: "UTC" });
  console.log("Attendance cron jobs scheduled");
}

export async function processEODAttendance(): Promise<void> {
  console.log("Processing EOD attendance...");

  const today = getTodayISTDate();
  const tomorrow = new Date(today.getTime() + 86400000);

  try {
    const allMembers = await prisma.member.findMany({ select: { id: true } });

    for (const member of allMembers) {
      const todaysTasks = await prisma.task.findMany({
        where: {
          memberId: member.id,
          createdAt: { gte: today, lt: tomorrow },
        },
        select: { status: true, createdAt: true },
      });

      const existingRecord = await prisma.dailyAttendance.findUnique({
        where: { memberId_date: { memberId: member.id, date: today } },
        select: { taskSubmittedAt: true, status: true },
      });

      // Already finalized as present — skip
      if (existingRecord?.status === AttendanceStatus.present) continue;

      // No tasks submitted today → absent
      if (todaysTasks.length === 0) {
        await prisma.dailyAttendance.upsert({
          where: { memberId_date: { memberId: member.id, date: today } },
          update: { status: AttendanceStatus.absent },
          create: { memberId: member.id, date: today, status: AttendanceStatus.absent },
        });
        continue;
      }

      // Narrow todaysTasks[0] so TypeScript is satisfied
      const firstTask = todaysTasks[0];
      if (!firstTask) continue;

      const taskSubmittedAt = existingRecord?.taskSubmittedAt ?? firstTask.createdAt;
      const allCompleted = todaysTasks.every((t) => t.status === TaskStatus.completed);

      if (!allCompleted) {
        await prisma.dailyAttendance.upsert({
          where: { memberId_date: { memberId: member.id, date: today } },
          update: { status: AttendanceStatus.partial },
          create: {
            memberId: member.id,
            date: today,
            status: AttendanceStatus.partial,
            taskSubmittedAt,
          },
        });
        continue;
      }

      // All tasks completed → present
      await prisma.dailyAttendance.upsert({
        where: { memberId_date: { memberId: member.id, date: today } },
        update: { status: AttendanceStatus.present, allTasksCompletedAt: new Date() },
        create: {
          memberId: member.id,
          date: today,
          status: AttendanceStatus.present,
          taskSubmittedAt,
          allTasksCompletedAt: new Date(),
        },
      });
    }

    console.log("EOD attendance processing complete");
  } catch (error) {
    console.error("EOD attendance processing error:", error);
  }
}
