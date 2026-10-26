import { mondayOf, shiftDays } from "./reports";
import type { ReportDay } from "./reports";

// Attendance helpers for the signed-in person's Home dashboard, built on the
// `scope=me` report. A person with seats in several workspaces can have more
// than one row a day, so a day takes its best status.

export type DayStatus = "present" | "partial" | "absent" | "none";

export const dayStatus = (d: ReportDay | undefined): DayStatus => {
  if (!d) return "none";
  if (d.present > 0) return "present";
  if (d.partial > 0) return "partial";
  if (d.absent > 0) return "absent";
  return "none";
};

/** Weekday counts and the rate the reports use: (present + ½ partial) / recorded days. */
export const attendanceSummary = (days: ReportDay[]) => {
  let present = 0;
  let partial = 0;
  let absent = 0;
  for (const d of days) {
    if (d.weekend) continue;
    const s = dayStatus(d);
    if (s === "present") present++;
    else if (s === "partial") partial++;
    else if (s === "absent") absent++;
  }
  const recorded = present + partial + absent;
  const rate = recorded ? Math.round(((present + partial / 2) / recorded) * 100) : null;
  return { present, partial, absent, recorded, rate };
};

export type WeekRate = { week: string; rate: number | null; recorded: number };

/** The last `weeks` IST weeks (Monday keys, oldest first) with each week's weekday rate. */
export const weeklyAttendance = (days: ReportDay[], today: string, weeks = 8): WeekRate[] => {
  const byWeek = new Map<string, ReportDay[]>();
  for (const d of days) {
    const key = mondayOf(d.date);
    byWeek.set(key, [...(byWeek.get(key) ?? []), d]);
  }
  const current = mondayOf(today);
  return Array.from({ length: weeks }, (_, i) => {
    const week = shiftDays(current, -7 * (weeks - 1 - i));
    const { rate, recorded } = attendanceSummary(byWeek.get(week) ?? []);
    return { week, rate, recorded };
  });
};
