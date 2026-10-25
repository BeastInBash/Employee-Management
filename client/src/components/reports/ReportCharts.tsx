import { useState } from "react";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Table2, LineChart as LineChartIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDay } from "@/lib/reports";
import type { ReportDay } from "@/lib/reports";

// ─── stat tile ──────────────────────────────────────────────────────────────

export const StatTile = ({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "warn";
}) => (
  <div className="bg-background border border-border px-4 py-3 min-w-0">
    <div className="text-xs text-muted-foreground truncate">{label}</div>
    <div className={cn("font-display text-2xl sm:text-3xl mt-1", tone === "warn" && "text-destructive")}>{value}</div>
    {hint && <div className="text-[11px] text-muted-foreground mt-1 truncate">{hint}</div>}
  </div>
);

// ─── chart frame with a chart/table toggle ──────────────────────────────────

type Series = { key: keyof ReportDay; label: string; color: string; mark: "line" | "rect" };

/** Legend mirrors the mark: a short stroke for lines, a square for bars. */
const Legend = ({ series }: { series: Series[] }) => (
  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
    {series.map((s) => (
      <span key={s.key} className="flex items-center gap-1.5">
        {s.mark === "line" ? (
          <span className="inline-block h-0.5 w-3" style={{ backgroundColor: s.color }} />
        ) : (
          <span className="inline-block h-2.5 w-2.5" style={{ backgroundColor: s.color }} />
        )}
        {s.label}
      </span>
    ))}
  </div>
);

const ChartFrame = ({
  title,
  subtitle,
  series,
  days,
  children,
}: {
  title: string;
  subtitle: string;
  series: Series[];
  days: ReportDay[];
  children: ReactNode;
}) => {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="bg-background border border-border p-4 space-y-3 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setAsTable((v) => !v)}
          aria-label={asTable ? "Show chart" : "Show as table"}
          title={asTable ? "Show chart" : "Show as table"}
        >
          {asTable ? <LineChartIcon className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
        </Button>
      </div>
      <Legend series={series} />
      {asTable ? (
        <div className="h-64 overflow-auto border border-border">
          <table className="w-full text-xs tabular-nums">
            <thead className="sticky top-0 bg-background text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left font-normal px-3 py-2">Day</th>
                {series.map((s) => (
                  <th key={s.key} className="text-right font-normal px-3 py-2">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {days.map((d) => (
                <tr key={d.date}>
                  <td className="px-3 py-1.5">
                    {formatDay(d.date)}
                    {d.weekend && <span className="text-muted-foreground"> · wknd</span>}
                  </td>
                  {series.map((s) => (
                    <td key={s.key} className="text-right px-3 py-1.5">
                      {String(d[s.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-64">{children}</div>
      )}
    </section>
  );
};

// ─── tooltip: values lead, line keys, every series at that X ────────────────

const DayTooltip = ({
  active,
  payload,
  label,
  series,
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number }[];
  label?: string;
  series: Series[];
}) => {
  if (!active || !payload?.length || !label) return null;
  const values = new Map(payload.map((p) => [p.dataKey, p.value]));
  return (
    <div className="bg-popover text-popover-foreground border border-border px-3 py-2 text-xs shadow-sm space-y-1 min-w-36">
      <div className="text-muted-foreground">{formatDay(label, true)}</div>
      {series.map((s) => (
        <div key={s.key} className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-3" style={{ backgroundColor: s.color }} />
          <span className="font-semibold tabular-nums">{values.get(s.key) ?? 0}</span>
          <span className="text-muted-foreground">{s.label}</span>
        </div>
      ))}
    </div>
  );
};

const axisProps = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

const xAxisFor = (days: ReportDay[]) => ({
  ...axisProps,
  dataKey: "date",
  tickFormatter: (d: string) => formatDay(d),
  minTickGap: 24,
  interval: "preserveStartEnd" as const,
  // A single day has no "end" to preserve; keep its label.
  ...(days.length === 1 && { interval: 0 as const }),
});

// ─── throughput: completed (accent) vs created (context gray) ───────────────

const THROUGHPUT: Series[] = [
  { key: "completed", label: "Completed", color: "var(--viz-completed)", mark: "line" },
  { key: "created", label: "Created", color: "var(--viz-created)", mark: "line" },
];

export const ThroughputChart = ({ days }: { days: ReportDay[] }) => (
  <ChartFrame title="Task throughput" subtitle="Tasks created and completed per day" series={THROUGHPUT} days={days}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis {...xAxisFor(days)} />
        <YAxis {...axisProps} allowDecimals={false} width={40} />
        <Tooltip
          cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
          content={<DayTooltip series={THROUGHPUT} />}
          isAnimationActive={false}
        />
        {/* Context first so the accent line draws on top. */}
        {[...THROUGHPUT].reverse().map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            name={s.label}
            type="monotone"
            stroke={s.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            activeDot={{ r: 4, fill: s.color, stroke: "var(--background)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  </ChartFrame>
);

// ─── attendance: present / partial / absent stacked per day ─────────────────

const ATTENDANCE: Series[] = [
  { key: "present", label: "Present", color: "var(--viz-present)", mark: "rect" },
  { key: "partial", label: "Partial", color: "var(--viz-partial)", mark: "rect" },
  { key: "absent", label: "Absent", color: "var(--viz-absent)", mark: "rect" },
];

export const AttendanceChart = ({ days, excludeWeekends }: { days: ReportDay[]; excludeWeekends: boolean }) => {
  const data = excludeWeekends ? days.filter((d) => !d.weekend) : days;
  return (
    <ChartFrame
      title="Daily attendance"
      subtitle={`People present, partial and absent each day${excludeWeekends ? " (weekdays)" : ""}`}
      series={ATTENDANCE}
      days={data}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap="20%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis {...xAxisFor(data)} />
          <YAxis {...axisProps} allowDecimals={false} width={40} />
          <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={<DayTooltip series={ATTENDANCE} />} isAnimationActive={false} />
          {ATTENDANCE.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="attendance"
              fill={s.color}
              maxBarSize={24}
              // 2px surface gap between stacked segments.
              stroke="var(--background)"
              strokeWidth={2}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
};
