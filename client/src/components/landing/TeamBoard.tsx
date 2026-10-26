import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Check } from "lucide-react";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { LineReveal } from "./LineReveal";

type Row = { name: string; role: string; done: number; planned: number };

const ROWS: Row[] = [
  { name: "Priya Shah", role: "Kitchen lead", done: 3, planned: 3 },
  { name: "Sam Kofi", role: "Barista", done: 2, planned: 4 },
  { name: "Lena Ortiz", role: "Front of house", done: 4, planned: 4 },
  { name: "Tom Reyes", role: "Deliveries", done: 1, planned: 3 },
  { name: "Mia Chen", role: "Accounts", done: 0, planned: 0 },
];

const statusOf = (r: Row) => (r.planned === 0 ? "none" : r.done === r.planned ? "present" : "partial");

const pill = {
  present: { label: "Present", tone: "bg-sage text-sage-foreground" },
  partial: { label: "Partial so far", tone: "bg-honey-soft text-honey" },
  none: { label: "Nothing planned", tone: "bg-muted text-muted-foreground" },
} as const;

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("");

/**
 * The admin's view of a day, as a preview: it tilts upright as it scrolls in,
 * then each row's progress fills and its attendance resolves.
 */
export const TeamBoard = () => {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 0.3"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 16, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [reduce ? 1 : 0.92, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 60, 0]);

  const counts = ROWS.reduce(
    (acc, r) => ({ ...acc, [statusOf(r)]: acc[statusOf(r)] + 1 }),
    { present: 0, partial: 0, none: 0 } as Record<ReturnType<typeof statusOf>, number>
  );

  return (
    <section id="team" className="scroll-mt-16 bg-sidebar text-sidebar-foreground">
      <div className="mx-auto max-w-[1180px] px-5 py-24 sm:px-8 sm:py-32">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
          <LineReveal
            lines={["See the whole team's day", "without a status meeting."]}
            className="text-[34px] leading-[1.08] tracking-[-0.03em] text-white sm:text-[48px]"
          />
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="max-w-[44ch] text-lg leading-relaxed text-sidebar-foreground/80 lg:pt-3"
          >
            Admins get one board with everyone's plan and progress. Leads see the projects and teams they run, and
            everyone else sees their own work.
          </motion.p>
        </div>

        <div className="mt-14 [perspective:1400px]">
          <motion.div
            ref={ref}
            style={{ rotateX, scale, y, transformOrigin: "50% 0%" }}
            className="overflow-hidden rounded-[28px] bg-card text-card-foreground shadow-[0_40px_80px_-40px_rgb(0_0_0/0.6)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 px-5 py-4 sm:px-7">
              <div>
                <p className="text-[15px] font-medium">Today at the café</p>
                <p className="text-sm text-muted-foreground">5 people, 14 tasks planned</p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-sage-soft px-3 py-1 text-sage">{counts.present} present</span>
                <span className="rounded-full bg-honey-soft px-3 py-1 text-honey">{counts.partial} in progress</span>
                <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">{counts.none} not planned</span>
              </div>
            </div>
            <ul className="divide-y divide-border/70">
              {ROWS.map((r, i) => {
                const status = statusOf(r);
                const pct = r.planned ? (r.done / r.planned) * 100 : 0;
                return (
                  <li key={r.name} className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 px-5 py-4 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.1fr)_9.5rem] sm:px-7">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                      {initials(r.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium">{r.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{r.role}</p>
                    </div>
                    <div className="col-span-2 flex items-center gap-3 sm:col-span-1">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <motion.div
                          initial={{ width: "0%" }}
                          whileInView={{ width: `${pct}%` }}
                          viewport={{ once: true, amount: 0.9 }}
                          transition={{ duration: 0.9, ease: EASE, delay: 0.2 + i * 0.12 }}
                          className={cn("h-full rounded-full", status === "present" ? "bg-sage" : "bg-honey")}
                        />
                      </div>
                      <span className="w-10 text-right text-xs text-muted-foreground tabular">
                        {r.planned ? `${r.done}/${r.planned}` : "–"}
                      </span>
                    </div>
                    <motion.span
                      initial={{ opacity: 0, transform: "scale(0.9)" }}
                      whileInView={{ opacity: 1, transform: "scale(1)" }}
                      viewport={{ once: true, amount: 0.9 }}
                      transition={{ type: "spring", duration: 0.45, bounce: 0.3, delay: 0.9 + i * 0.12 }}
                      className={cn(
                        "col-span-2 inline-flex w-fit items-center gap-1.5 justify-self-start rounded-full px-3 py-1 text-sm font-medium sm:col-span-1 sm:justify-self-end",
                        pill[status].tone
                      )}
                    >
                      {status === "present" && <Check className="h-3.5 w-3.5" />}
                      {pill[status].label}
                    </motion.span>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
