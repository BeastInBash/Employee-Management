import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { WeekRate } from "@/lib/home";
import { formatDay } from "@/lib/reports";

const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;

const WeekTooltip = ({ active, payload }: { active?: boolean; payload?: { payload?: WeekRate }[] }) => {
  const w = payload?.[0]?.payload;
  if (!active || !w) return null;
  return (
    <div className="space-y-0.5 rounded-lg border border-border/80 bg-popover px-3 py-2 text-xs text-popover-foreground shadow-[0_12px_32px_-12px_rgb(78_34_15/0.25)]">
      <div className="text-muted-foreground">Week of {formatDay(w.week)}</div>
      {w.rate === null ? (
        <div>No weekdays recorded</div>
      ) : (
        <div>
          <span className="font-semibold tabular">{w.rate}%</span>
          <span className="text-muted-foreground">
            {" "}
            over {w.recorded} {w.recorded === 1 ? "day" : "days"}
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * One series, so no legend: the title names it. Bars are the weekday
 * attendance rate per week; a visually hidden table carries the same numbers.
 */
export const WeeklyAttendance = ({ weeks }: { weeks: WeekRate[] }) => (
  <>
    <div className="min-h-48 flex-1" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={weeks} margin={{ top: 8, right: 4, bottom: 0, left: -8 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis {...axis} dataKey="week" tickFormatter={(d: string) => formatDay(d)} interval="preserveStartEnd" minTickGap={16} />
          <YAxis {...axis} domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v: number) => `${v}%`} width={44} />
          <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={<WeekTooltip />} isAnimationActive={false} />
          <Bar dataKey="rate" fill="var(--viz-present)" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
    <table className="sr-only">
      <caption>Attendance rate by week</caption>
      <thead>
        <tr>
          <th>Week of</th>
          <th>Rate</th>
        </tr>
      </thead>
      <tbody>
        {weeks.map((w) => (
          <tr key={w.week}>
            <td>{formatDay(w.week, true)}</td>
            <td>{w.rate === null ? "No record" : `${w.rate}%`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </>
);
