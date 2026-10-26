import cron from "node-cron";
import { PrismaClient, AttendanceStatus, TaskStatus, Prisma } from "@prisma/client";
import { getTodayISTDate } from "../utils/attendance";

const prisma = new PrismaClient();

/** Upserts per transaction, so a large team doesn't build one huge statement. */
const WRITE_CHUNK = 100;

export type EODSummary = {
  date: string;
  members: number;
  present: number;
  partial: number;
  absent: number;
  /** Already present before the run (finished their list during the day). */
  alreadyPresent: number;
};

/**
 * Schedule the 9:00 PM IST run in-process. Only for always-on hosts (Render,
 * local dev): a serverless function isn't running at 9 PM, so on Vercel the
 * run comes from Vercel Cron calling GET /api/internal/cron/eod instead.
 */
export function startAttendanceCronJobs(): void {
  if (process.env.VERCEL) {
    console.log("Attendance cron: running on Vercel, scheduled by Vercel Cron instead");
    return;
  }
  // Fires at 9:00 PM IST = 3:30 PM UTC
  cron.schedule(
    "30 15 * * *",
    () => {
      processEODAttendance().catch((error) => console.error("EOD attendance processing error:", error));
    },
    { timezone: "UTC" }
  );
  console.log("Attendance cron jobs scheduled");
}

/**
 * Settle today's attendance for every member: no tasks → absent, some open →
 * partial, all done → present. Rows already marked present are left alone.
 * Safe to run more than once a day. Throws on failure so the caller can report it.
 */
export async function processEODAttendance(): Promise<EODSummary> {
  console.log("Processing EOD attendance...");

  const today = getTodayISTDate();
  const tomorrow = new Date(today.getTime() + 86400000);

  // Three reads for the whole day instead of two per member.
  const [members, tasks, records] = await Promise.all([
    prisma.member.findMany({ select: { id: true } }),
    prisma.task.findMany({
      where: { createdAt: { gte: today, lt: tomorrow } },
      select: { memberId: true, status: true, createdAt: true },
    }),
    prisma.dailyAttendance.findMany({
      where: { date: today },
      select: { memberId: true, status: true, taskSubmittedAt: true },
    }),
  ]);

  const tasksByMember = new Map<string, { status: TaskStatus; createdAt: Date }[]>();
  for (const t of tasks) {
    const list = tasksByMember.get(t.memberId);
    if (list) list.push(t);
    else tasksByMember.set(t.memberId, [t]);
  }
  const recordByMember = new Map(records.map((r) => [r.memberId, r]));

  const summary: EODSummary = {
    date: today.toISOString().slice(0, 10),
    members: members.length,
    present: 0,
    partial: 0,
    absent: 0,
    alreadyPresent: 0,
  };
  const writes: Prisma.PrismaPromise<unknown>[] = [];
  const now = new Date();

  for (const { id: memberId } of members) {
    const existing = recordByMember.get(memberId);

    // Already finalized as present — skip
    if (existing?.status === AttendanceStatus.present) {
      summary.alreadyPresent++;
      continue;
    }

    const where = { memberId_date: { memberId, date: today } };
    const todaysTasks = tasksByMember.get(memberId) ?? [];

    // No tasks submitted today → absent
    if (todaysTasks.length === 0) {
      summary.absent++;
      writes.push(
        prisma.dailyAttendance.upsert({
          where,
          update: { status: AttendanceStatus.absent },
          create: { memberId, date: today, status: AttendanceStatus.absent },
        })
      );
      continue;
    }

    const firstSubmitted = todaysTasks.reduce((min, t) => (t.createdAt < min ? t.createdAt : min), todaysTasks[0]!.createdAt);
    const taskSubmittedAt = existing?.taskSubmittedAt ?? firstSubmitted;

    if (!todaysTasks.every((t) => t.status === TaskStatus.completed)) {
      summary.partial++;
      writes.push(
        prisma.dailyAttendance.upsert({
          where,
          update: { status: AttendanceStatus.partial },
          create: { memberId, date: today, status: AttendanceStatus.partial, taskSubmittedAt },
        })
      );
      continue;
    }

    // All tasks completed → present
    summary.present++;
    writes.push(
      prisma.dailyAttendance.upsert({
        where,
        update: { status: AttendanceStatus.present, allTasksCompletedAt: now },
        create: { memberId, date: today, status: AttendanceStatus.present, taskSubmittedAt, allTasksCompletedAt: now },
      })
    );
  }

  for (let i = 0; i < writes.length; i += WRITE_CHUNK) {
    await prisma.$transaction(writes.slice(i, i + WRITE_CHUNK));
  }

  console.log("EOD attendance processing complete", summary);
  return summary;
}
