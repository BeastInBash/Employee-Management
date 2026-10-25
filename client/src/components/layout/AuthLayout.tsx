import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Leaf } from "./Leaf";

const EASE = [0.23, 1, 0.32, 1] as const;

// What the photo panel says while someone signs in — the product's idea in three beats.
const CAPTIONS = [
  { title: "Plan the day.", body: "Everyone writes down what they'll get done, in a minute or two." },
  { title: "Finish the list.", body: "Tasks move to done while leads see their projects come together." },
  { title: "Attendance takes care of itself.", body: "Finish what you planned and the day counts. No clock-ins." },
];

/** Cycles the captions every few seconds (static under reduced motion). */
function useCaption() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((n) => (n + 1) % CAPTIONS.length), 5200);
    return () => clearInterval(t);
  }, [reduce]);
  return { caption: CAPTIONS[i]!, index: i };
}

const Photo = ({ className }: { className?: string }) => (
  <img
    src="/images/auth-desk-900.webp"
    srcSet="/images/auth-desk-900.webp 900w, /images/auth-desk-1600.webp 1600w"
    sizes="(min-width: 1024px) 50vw, 100vw"
    alt=""
    className={className}
    fetchPriority="high"
  />
);

/**
 * Sign-in, sign-up and the password pages: a photo panel with slowly drifting
 * imagery and rotating captions beside the form on wide screens; a short photo
 * banner above it on phones.
 */
export const AuthLayout = ({
  title,
  description,
  children,
  footer,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) => {
  const { caption, index } = useCaption();

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* ── photo panel (wide screens) ── */}
      <motion.aside
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: EASE }}
        className="relative hidden overflow-hidden bg-[#2b2a22] lg:sticky lg:top-0 lg:block lg:h-screen"
      >
        {/* A slow push-in, like a held camera (disabled for reduced motion in CSS). */}
        <Photo className="absolute inset-0 h-full w-full animate-[kenburns_26s_ease-in-out_infinite_alternate] object-cover motion-reduce:animate-none" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(31_28_16/0.45)_0%,rgb(31_28_16/0.05)_30%,rgb(31_28_16/0.15)_55%,rgb(31_28_16/0.88)_100%)]" />

        <Link to="/" className="absolute left-10 top-9 flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
          <Leaf className="h-5 w-5 text-[#e9d9a8]" />
          Crewly
        </Link>

        <div className="absolute inset-x-10 bottom-10">
          <div className="relative min-h-[132px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, transform: "translateY(10px)", filter: "blur(4px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)", filter: "blur(0px)" }}
                exit={{ opacity: 0, transform: "translateY(-6px)", filter: "blur(4px)", transition: { duration: 0.25 } }}
                transition={{ duration: 0.6, ease: EASE }}
              >
                <p className="max-w-[18ch] text-[34px] font-semibold leading-[1.1] tracking-[-0.025em] text-white">{caption.title}</p>
                <p className="mt-3 max-w-[40ch] text-[15px] leading-relaxed text-white/75">{caption.body}</p>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="mt-6 flex items-center justify-between gap-4">
            {/* Progress through the three beats. */}
            <div className="flex gap-1.5" aria-hidden>
              {CAPTIONS.map((_, i) => (
                <span key={i} className="relative h-1 w-8 overflow-hidden rounded-full bg-white/25">
                  {i === index && (
                    <motion.span
                      key={index}
                      layoutId="caption-progress"
                      className="absolute inset-y-0 left-0 rounded-full bg-white"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 5.2, ease: "linear" }}
                    />
                  )}
                </span>
              ))}
            </div>
            <a
              href="https://unsplash.com/@dhony24?utm_source=crewly&utm_medium=referral"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-white/60 hover:text-white"
            >
              Photo: Dhony Koswara / Unsplash
            </a>
          </div>
        </div>
      </motion.aside>

      {/* ── form side ── */}
      <main className="flex min-h-screen flex-col lg:min-h-0">
        {/* Phones: the photo as a short banner that melts into the page. */}
        <div className="relative h-48 overflow-hidden lg:hidden">
          <Photo className="h-full w-full animate-[kenburns_26s_ease-in-out_infinite_alternate] object-cover object-[50%_62%] motion-reduce:animate-none" />
          <div className="absolute inset-0 bg-gradient-to-b from-[rgb(31_28_16/0.35)] via-transparent to-background" />
          <Link to="/" className="absolute left-5 top-5 flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
            <Leaf className="h-5 w-5 text-[#e9d9a8]" />
            Crewly
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-12 pt-2 sm:px-8 lg:py-12">
          <motion.div
            initial={{ opacity: 0, transform: "translateY(12px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
            className="w-full max-w-[400px]"
          >
            <div className="mb-7 space-y-1.5">
              <AnimatePresence mode="wait" initial={false}>
                <motion.h1
                  key={typeof title === "string" ? title : "title"}
                  initial={{ opacity: 0, transform: "translateY(6px)" }}
                  animate={{ opacity: 1, transform: "translateY(0px)" }}
                  exit={{ opacity: 0, transform: "translateY(-4px)", transition: { duration: 0.12 } }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="text-[28px] leading-tight"
                >
                  {title}
                </motion.h1>
              </AnimatePresence>
              {description && <p className="text-[15px] text-muted-foreground">{description}</p>}
            </div>
            {children}
            {footer && <div className="mt-8 text-center text-sm text-muted-foreground">{footer}</div>}
          </motion.div>
        </div>
      </main>
    </div>
  );
};
