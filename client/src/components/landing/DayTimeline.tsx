import { useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import type { MotionValue } from "framer-motion";
import { Check } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

// ─── the little scene on each card ──────────────────────────────────────────

const PlanScene = () => (
  <ul className="space-y-1.5">
    {["Open up and prep the counter", "Reply to the Hartley quote", "Update the stock sheet"].map((t, i) => (
      <motion.li
        key={t}
        initial={{ opacity: 0, transform: "translateX(-8px)" }}
        whileInView={{ opacity: 1, transform: "translateX(0px)" }}
        viewport={{ once: true, amount: 0.8 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.15 + i * 0.12 }}
        className="flex items-center gap-2.5 rounded-lg bg-surface px-3 py-2 text-sm"
      >
        <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-input bg-card" />
        {t}
      </motion.li>
    ))}
  </ul>
);

const AssignScene = () => (
  <div className="flex items-center gap-3">
    <motion.div
      initial={{ opacity: 0, transform: "translateY(10px) rotate(-3deg)" }}
      whileInView={{ opacity: 1, transform: "translateY(0px) rotate(-2deg)" }}
      viewport={{ once: true, amount: 0.8 }}
      transition={{ duration: 0.55, ease: EASE, delay: 0.15 }}
      className="min-w-0 flex-1 rounded-lg border border-border/80 bg-card px-3 py-2.5 shadow-[0_10px_24px_-16px_var(--shadow-ink)]"
    >
      <p className="truncate text-sm">Call the oat milk supplier</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Spring menu launch</p>
    </motion.div>
    <span className="text-muted-foreground" aria-hidden>
      to
    </span>
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
      SK
    </span>
  </div>
);

const CheckScene = () => (
  <div>
    <div className="flex items-baseline justify-between text-sm">
      <span>Spring menu launch</span>
      <span className="tabular text-muted-foreground">6 of 9 done</span>
    </div>
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
      <motion.div
        initial={{ width: "8%" }}
        whileInView={{ width: "67%" }}
        viewport={{ once: true, amount: 0.8 }}
        transition={{ duration: 1.1, ease: EASE, delay: 0.2 }}
        className="h-full rounded-full bg-honey"
      />
    </div>
    <p className="mt-2 text-xs text-muted-foreground">No status meeting needed.</p>
  </div>
);

const SettleScene = () => (
  <div className="flex flex-wrap gap-2">
    {[
      { label: "Present", tone: "bg-sage text-sage-foreground" },
      { label: "Partial", tone: "bg-honey-soft text-honey" },
      { label: "Absent", tone: "bg-destructive/10 text-destructive" },
    ].map((s, i) => (
      <motion.span
        key={s.label}
        initial={{ opacity: 0, transform: "scale(0.85)" }}
        whileInView={{ opacity: 1, transform: "scale(1)" }}
        viewport={{ once: true, amount: 0.8 }}
        transition={{ type: "spring", duration: 0.45, bounce: 0.3, delay: 0.15 + i * 0.12 }}
        className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium", s.tone)}
      >
        {i === 0 && <Check className="h-3.5 w-3.5" />}
        {s.label}
      </motion.span>
    ))}
  </div>
);

// The day as it really runs: 9 PM IST is when the backend's job settles attendance.
const STOPS = [
  {
    time: "9:00 AM",
    title: "Plan",
    body: "Everyone writes down what they'll get done today. It takes a minute or two.",
    Scene: PlanScene,
  },
  {
    time: "11:30 AM",
    title: "Hand out",
    body: "A project lead assigns the supplier call to Sam. It lands on Sam's list, not in a chat thread.",
    Scene: AssignScene,
  },
  {
    time: "3:00 PM",
    title: "Check in",
    body: "The lead opens the project and sees six of nine tasks done, without asking anyone.",
    Scene: CheckScene,
  },
  {
    time: "9:00 PM",
    title: "Settle",
    body: "Workzen closes the day. Everything done is present, some done is partial, nothing planned is absent.",
    Scene: SettleScene,
  },
];

/** `pinned` cards keep a fixed width so the row can ride sideways; stacked ones fill their cell. */
const Card = ({ stop, pinned }: { stop: (typeof STOPS)[number]; pinned?: boolean }) => (
  <article className={cn("flex shrink-0 flex-col rounded-[28px] border border-border/80 bg-card p-6 sm:p-7", pinned ? "w-[400px]" : "w-full")}>
    <span className="text-sm font-medium text-primary tabular">{stop.time}</span>
    <h3 className="mt-3 text-2xl tracking-tight">{stop.title}</h3>
    <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{stop.body}</p>
    <div className="mt-6 flex flex-1 flex-col justify-end">
      <stop.Scene />
    </div>
  </article>
);

const Header = () => (
  <div className="max-w-[40ch]">
    <h2 className="text-[34px] leading-[1.08] tracking-[-0.03em] sm:text-[48px]">One day, start to finish</h2>
    <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
      What a normal day looks like for a team on Workzen, from the morning plan to the moment attendance settles.
    </p>
  </div>
);

/** The pinned version: the cards ride sideways while a line marks the hour of the day. */
const Pinned = () => {
  const ref = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  useLayoutEffect(() => {
    const measure = () => {
      // How far the row must travel for its last card to come fully into view.
      if (track.current && viewport.current) setDistance(Math.max(0, track.current.offsetWidth - viewport.current.clientWidth));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const x = useTransform(scrollYProgress, [0.05, 0.95], [0, -distance]);
  const day = useTransform(scrollYProgress, [0.05, 0.95], [0, 1]);

  return (
    <section id="day" ref={ref} className="relative h-[300vh] scroll-mt-16">
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        <div className="mx-auto w-full max-w-[1180px] px-8">
          <Header />
        </div>
        <div ref={viewport} className="mt-12 overflow-hidden">
          <motion.div ref={track} style={{ x }} className="flex w-max gap-5 px-[max(2rem,calc((100vw-1180px)/2+2rem))]">
            {STOPS.map((s) => (
              <Card key={s.title} stop={s} pinned />
            ))}
          </motion.div>
        </div>
        <DayLine progress={day} />
      </div>
    </section>
  );
};

/** A thin line under the cards that fills from morning to night. */
const DayLine = ({ progress }: { progress: MotionValue<number> }) => (
  <div className="mx-auto mt-10 w-full max-w-[1180px] px-8" aria-hidden>
    <div className="relative h-px bg-border">
      <motion.div style={{ scaleX: progress }} className="absolute inset-0 origin-left bg-primary" />
    </div>
    <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular">
      <span>Morning</span>
      <span>Night</span>
    </div>
  </div>
);

/**
 * "A day in Workzen": four real moments of the product, in order. Wide screens
 * pin the section and scroll the day sideways; phones and reduced motion get
 * a plain stack.
 */
export const DayTimeline = () => {
  const wide = useMediaQuery("(min-width: 1024px)");
  const reduce = useReducedMotion();
  if (wide && !reduce) return <Pinned />;
  return (
    <section id="day" className="scroll-mt-16">
      <div className="mx-auto max-w-[1180px] px-5 py-24 sm:px-8">
        <Header />
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {STOPS.map((s) => (
            <Card key={s.title} stop={s} />
          ))}
        </div>
      </div>
    </section>
  );
};
