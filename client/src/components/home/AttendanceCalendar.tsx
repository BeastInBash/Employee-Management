import { dayStatus } from "@/lib/home";
import type { DayStatus } from "@/lib/home";
import { shiftDays } from "@/lib/reports";
import type { ReportDay } from "@/lib/reports";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

// Same soft tints as the Attendance page, so a day looks the same everywhere;
// the legend repeats them with an outline so the pale ones still read.
const cellTone: Record<DayStatus, string> = {
  present: "bg-sage-soft text-sage",
  partial: "bg-honey-soft text-honey",
  absent: "bg-destructive/10 text-destructive",
  none: "bg-surface text-muted-foreground",
};

const statusLabel: Record<DayStatus, string> = {
  present: "present",
  partial: "partial",
  absent: "absent",
  none: "no record",
};

const LEGEND: { status: DayStatus; label: string; swatch: string }[] = [
  { status: "present", label: "Present", swatch: "bg-sage-soft ring-sage/60" },
  { status: "partial", label: "Partial", swatch: "bg-honey-soft ring-honey/60" },
  { status: "absent", label: "Absent", swatch: "bg-destructive/10 ring-destructive/60" },
];

export const AttendanceLegend = () => (
  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
    {LEGEND.map((l) => (
      <span key={l.status} className="flex items-center gap-1.5">
        <span className={cn("inline-block h-3 w-3 rounded-[4px] ring-1 ring-inset", l.swatch)} />
        {l.label}
      </span>
    ))}
  </div>
);

/**
 * The current month as a Monday-first grid: each day tinted by its attendance,
 * weekends and the days still to come left quiet, today ringed.
 */
export const AttendanceCalendar = ({ days, today }: { days: ReportDay[]; today: string }) => {
  const month = today.slice(0, 7);
  const first = `${month}-01`;
  const byDate = new Map(days.map((d) => [d.date, d]));
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7; // blanks before the 1st
  const length = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const dates = Array.from({ length }, (_, i) => shiftDays(first, i));

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground" aria-hidden>
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="pb-1">
            {d}
          </span>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => (
          <li key={`blank-${i}`} aria-hidden />
        ))}
        {dates.map((date) => {
          const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
          const weekend = dow === 0 || dow === 6;
          const future = date > today;
          const status = dayStatus(byDate.get(date));
          const quiet = future || (weekend && status === "none");
          const day = Number(date.slice(8));
          return (
            <li
              key={date}
              title={`${day}: ${future ? "upcoming" : statusLabel[status]}`}
              aria-label={`${day}, ${future ? "upcoming" : statusLabel[status]}`}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md text-xs tabular",
                quiet ? "text-muted-foreground/50" : cellTone[status],
                date === today && "ring-2 ring-primary ring-offset-1 ring-offset-card",
              )}
            >
              {day}
            </li>
          );
        })}
      </ol>
    </div>
  );
};
