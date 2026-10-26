import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import type { MotionValue, Variants } from "framer-motion";
import { Check, X } from "lucide-react";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { LineReveal } from "./LineReveal";

const before = [
  "A punch-in app that says someone was in, not what they did",
  "Chasing timesheets at the end of every month",
  "Plans that live in chat threads and people's heads",
  "No way to tell a busy day from a quiet one",
];

const after = [
  "Each person writes a short plan for the day",
  "Finishing it marks them present, with nothing to clock",
  "Leads watch their project move as tasks get done",
  "Attendance and on-time rate, ready to export as CSV",
];

const list: Variants = { show: { transition: { staggerChildren: 0.08, delayChildren: 0.25 } } };
const item: Variants = {
  hidden: { opacity: 0, transform: "translateY(8px)" },
  show: { opacity: 1, transform: "translateY(0px)", transition: { duration: 0.45, ease: EASE } },
};

const Panel = ({
  tone,
  title,
  items,
  from,
  progress,
}: {
  tone: "before" | "after";
  title: string;
  items: string[];
  from: number;
  progress: MotionValue<number>;
}) => {
  const Icon = tone === "before" ? X : Check;
  return (
    <motion.div
      initial={{ opacity: 0, transform: `translateX(${from}px)` }}
      whileInView={{ opacity: 1, transform: "translateX(0px)" }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.7, ease: EASE }}
      className={cn(
        "rounded-[28px] border p-6 sm:p-8",
        tone === "before" ? "border-destructive/20 bg-destructive/[0.05]" : "border-sage/25 bg-sage-soft/70"
      )}
    >
      <div className="mb-6 flex items-center gap-3">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full",
            tone === "before" ? "bg-destructive/12 text-destructive" : "bg-sage text-sage-foreground"
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={2.5} />
        </span>
        <h3 className="text-lg">{title}</h3>
      </div>
      <div className="relative">
        {/* The dotted spine draws down the list as the section scrolls through. */}
        <span aria-hidden className="absolute bottom-3 left-[11px] top-3 w-px border-l border-dashed border-current opacity-15" />
        <motion.span
          aria-hidden
          style={{ scaleY: progress }}
          className={cn(
            "absolute bottom-3 left-[11px] top-3 w-px origin-top border-l border-dashed",
            tone === "before" ? "border-destructive/60" : "border-sage"
          )}
        />
        <motion.ul variants={list} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} className="space-y-5">
          {items.map((text) => (
            <motion.li key={text} variants={item} className="relative flex items-start gap-4">
              <span
                className={cn(
                  "relative mt-1 h-[23px] w-[23px] shrink-0 rounded-full border-2 bg-card",
                  tone === "before" ? "border-destructive/40" : "border-sage"
                )}
              />
              <span className={cn("text-[15px] leading-relaxed", tone === "before" ? "text-muted-foreground" : "text-foreground")}>{text}</span>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </motion.div>
  );
};

/** "Clocking in" against Workzen: the case for the product in two short lists. */
export const BeforeAfter = () => {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.8", "end 0.55"] });
  const progress = useTransform(scrollYProgress, [0, 1], [reduce ? 1 : 0, 1]);

  return (
    <section id="why" className="scroll-mt-16">
      <div className="mx-auto max-w-[1180px] px-5 py-24 sm:px-8 sm:py-32">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
          <LineReveal
            lines={["Clocking in tells you who showed up.", "Workzen tells you what got done."]}
            className="text-[34px] leading-[1.08] tracking-[-0.03em] sm:text-[48px]"
          />
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="max-w-[44ch] text-lg leading-relaxed text-muted-foreground lg:pt-3"
          >
            Punch-in apps and timesheets measure hours at a desk. For a small team, the question that matters is simpler:
            did today's work get done?
          </motion.p>
        </div>
        <div ref={ref} className="mt-14 grid gap-5 md:grid-cols-2">
          <Panel tone="before" title="Clocking in" items={before} from={-40} progress={progress} />
          <Panel tone="after" title="Workzen" items={after} from={40} progress={progress} />
        </div>
      </div>
    </section>
  );
};
