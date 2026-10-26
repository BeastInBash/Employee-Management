import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { EASE } from "@/lib/motion";
import { LineReveal } from "./LineReveal";

// A real sequence, so the steps are numbered.
const STEPS = [
  { title: "Create your workspace", body: "Sign up, then name your organisation and its first workspace. One per shop, office or department." },
  { title: "Add your people", body: "Each person gets an email with their sign-in details, or signs in with Google." },
  { title: "Plan tomorrow", body: "Everyone writes their first list. From then on, attendance takes care of itself." },
];

/** Three steps to a working team, joined by a line that draws as you scroll. */
export const SetupSteps = () => {
  const ref = useRef<HTMLOListElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.6"] });
  const line = useTransform(scrollYProgress, [0, 1], [reduce ? 1 : 0, 1]);

  return (
    <section id="setup" className="scroll-mt-16 border-y border-border/70 bg-card">
      <div className="mx-auto max-w-[1180px] px-5 py-24 sm:px-8 sm:py-28">
        <LineReveal lines={["Up and running", "this afternoon."]} className="text-[34px] leading-[1.08] tracking-[-0.03em] sm:text-[48px]" />
        <ol ref={ref} className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {/* The connecting line, circle to circle: across on wide screens, down the side on
              phones. On md the third circle starts one column + gap in from the right. */}
          <span aria-hidden className="absolute left-[19px] top-5 bottom-5 w-px bg-border md:bottom-auto md:left-5 md:right-[calc((100%-4rem)/3-20px)] md:top-[19px] md:h-px md:w-auto" />
          <motion.span
            aria-hidden
            style={{ scaleX: line }}
            className="absolute left-5 right-[calc((100%-4rem)/3-20px)] top-[19px] hidden h-px origin-left bg-primary md:block"
          />
          <motion.span aria-hidden style={{ scaleY: line }} className="absolute bottom-5 left-[19px] top-5 w-px origin-top bg-primary md:hidden" />
          {STEPS.map((s, i) => (
            <motion.li
              key={s.title}
              initial={{ opacity: 0, transform: "translateY(12px)" }}
              whileInView={{ opacity: 1, transform: "translateY(0px)" }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.5, ease: EASE, delay: i * 0.12 }}
              className="relative flex gap-5 md:block"
            >
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-card text-sm font-semibold text-primary">
                {i + 1}
              </span>
              <div className="md:mt-6">
                <h3 className="text-lg">{s.title}</h3>
                <p className="mt-1.5 max-w-[36ch] text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
};
