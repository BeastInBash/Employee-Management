import { useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const EASE = [0.23, 1, 0.32, 1] as const;

const tasks = [
  { id: "a", title: "Reply to the Hartley quote" },
  { id: "b", title: "Finish the spring menu photos" },
  { id: "c", title: "Update the stock sheet" },
];

// Earlier days this week; Friday is today and follows the list.
const week = [
  { day: "Mon", status: "present" },
  { day: "Tue", status: "present" },
  { day: "Wed", status: "partial" },
  { day: "Thu", status: "present" },
] as const;

// Same rules as the backend's end-of-day job (attendancecron.ts).
const rules = [
  { status: "present", swatch: "bg-sage", text: "Everything ticked off counts as present." },
  { status: "partial", swatch: "bg-honey", text: "Anything left open counts as partial." },
  { status: "absent", swatch: "bg-destructive", text: "Nothing planned counts as absent." },
] as const;

// Geometry shared by the task rows and the connectors: 56px rows, 8px apart,
// converging on the middle of the 184px-tall "today" tile.
const ROW = 56;
const GAP = 8;
const HEIGHT = ROW * tasks.length + GAP * (tasks.length - 1);
const rowY = (i: number) => ROW / 2 + i * (ROW + GAP);
const connector = (i: number) => `M0 ${rowY(i)} C48 ${rowY(i)} 48 ${HEIGHT / 2} 96 ${HEIGHT / 2}`;

/**
 * The About section's working demo: tick off a teammate's tasks and watch
 * each one feed today's attendance, which settles to present when the list is done.
 */
export const AttendanceFlow = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduce = useReducedMotion();
  const [done, setDone] = useState<Record<string, boolean>>({ a: true });

  const count = tasks.filter((t) => done[t.id]).length;
  const status = count === tasks.length ? "present" : "partial";

  return (
    <div ref={ref}>
      <div className="rounded-[28px] border border-border/80 bg-card p-5 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
            PS
          </span>
          <div>
            <p className="text-[15px] font-medium">Priya Shah</p>
            <p className="text-sm text-muted-foreground">Friday, {tasks.length} tasks planned</p>
          </div>
        </div>

        <div className="grid items-start md:grid-cols-[minmax(0,1fr)_96px_minmax(0,0.6fr)]">
          <ul className="space-y-2">
            {tasks.map((t) => {
              const checked = !!done[t.id];
              return (
                <li key={t.id}>
                  <button
                    onClick={() => setDone((d) => ({ ...d, [t.id]: !d[t.id] }))}
                    aria-pressed={checked}
                    style={{ height: ROW }}
                    className="flex w-full items-center gap-3 rounded-xl bg-surface px-4 text-left ring-1 ring-border/70 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200",
                        checked ? "border-sage bg-sage text-sage-foreground" : "border-input bg-card",
                      )}
                    >
                      <motion.span
                        initial={false}
                        animate={{ opacity: checked ? 1 : 0, scale: checked ? 1 : 0.6 }}
                        transition={{ duration: 0.15 }}
                      >
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </motion.span>
                    </span>
                    <span
                      className={cn(
                        "truncate text-sm transition-colors",
                        checked && "text-muted-foreground line-through decoration-muted-foreground/40",
                      )}
                    >
                      {t.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Each task feeds today: dashed while open, drawn solid in sage once done. */}
          <svg
            viewBox={`0 0 96 ${HEIGHT}`}
            preserveAspectRatio="none"
            className="hidden w-full md:block"
            style={{ height: HEIGHT }}
            aria-hidden
          >
            {tasks.map((t, i) => (
              <g key={t.id}>
                <path
                  d={connector(i)}
                  fill="none"
                  stroke="var(--input)"
                  strokeWidth={1.5}
                  strokeDasharray="3 4"
                  vectorEffect="non-scaling-stroke"
                />
                <motion.path
                  d={connector(i)}
                  fill="none"
                  stroke="var(--sage)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: inView && done[t.id] ? 1 : 0 }}
                  transition={{ duration: reduce ? 0 : 0.5, ease: EASE, delay: reduce ? 0 : i * 0.08 }}
                />
              </g>
            ))}
          </svg>
          {/* Phones stack the columns; a short stem stands in for the connectors. */}
          <span aria-hidden className="mx-auto my-2 block h-8 w-px bg-input md:hidden" />

          <div>
            <div
              className={cn(
                // md: exactly the task list's height, so the connectors meet its middle.
                "flex min-h-40 flex-col justify-between rounded-2xl p-5 transition-colors duration-300 md:h-[184px] md:min-h-0",
                status === "present" ? "bg-sage text-sage-foreground" : "bg-honey-soft text-honey",
              )}
            >
              <p className="text-sm opacity-80">Today</p>
              <div aria-live="polite">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={status}
                    initial={{ opacity: 0, transform: "translateY(8px)" }}
                    animate={{ opacity: 1, transform: "translateY(0px)" }}
                    exit={{ opacity: 0, transform: "translateY(-6px)", transition: { duration: 0.12 } }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="text-3xl font-semibold tracking-tight"
                  >
                    {status === "present" ? "Present" : "Partial"}
                  </motion.p>
                </AnimatePresence>
                <p className="mt-1 text-sm opacity-80 tabular">
                  {count} of {tasks.length} tasks done
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-5 gap-1.5" aria-label="This week">
              {week.map((d) => (
                <div key={d.day} className="text-center">
                  <span className={cn("block h-1.5 rounded-full", d.status === "present" ? "bg-sage" : "bg-honey")} />
                  <span className="mt-1.5 block text-xs text-muted-foreground">{d.day}</span>
                </div>
              ))}
              <div className="text-center">
                <span
                  className={cn(
                    "block h-1.5 rounded-full transition-colors duration-300",
                    status === "present" ? "bg-sage" : "bg-honey",
                  )}
                />
                <span className="mt-1.5 block text-xs font-medium text-foreground">Fri</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ul className="mt-8 grid gap-3 sm:grid-cols-3 sm:gap-6">
        {rules.map((r) => (
          <li
            key={r.status}
            className={cn(
              "flex items-baseline gap-2.5 text-[15px] transition-colors duration-300",
              r.status === status ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <span className={cn("h-2 w-2 shrink-0 translate-y-[-1px] rounded-full", r.swatch)} />
            {r.text}
          </li>
        ))}
      </ul>
    </div>
  );
};
