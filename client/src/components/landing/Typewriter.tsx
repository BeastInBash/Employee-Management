import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Types `text` out one character at a time, with a blinking caret, once it
 * scrolls into view. Screen readers get the whole sentence straight away
 * (the animated copy is aria-hidden), and reduced-motion users see it typed.
 */
export const Typewriter = ({
  text,
  as: Tag = "span",
  className,
  speed = 42,
  startDelay = 250,
  onDone,
}: {
  text: string;
  as?: "span" | "h1" | "h2" | "p";
  className?: string;
  /** Milliseconds per character. */
  speed?: number;
  startDelay?: number;
  onDone?: () => void;
}) => {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const [count, setCount] = useState(reduce ? text.length : 0);
  const done = count >= text.length;

  useEffect(() => {
    if (reduce) {
      setCount(text.length);
      return;
    }
    if (!inView) return;
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i += 1;
      setCount(i);
      // A slightly longer beat after punctuation reads more like a person typing.
      if (i < text.length) timer = setTimeout(tick, /[.,]/.test(text[i - 1]!) ? speed * 6 : speed);
    };
    timer = setTimeout(tick, startDelay);
    return () => clearTimeout(timer);
  }, [inView, reduce, text, speed, startDelay]);

  useEffect(() => {
    if (done) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  return (
    <Tag ref={ref as never} className={cn("relative", className)} aria-label={text}>
      {/* Reserve the final size so the layout doesn't grow line by line. */}
      <span aria-hidden className="invisible">
        {text}
      </span>
      <span aria-hidden className="absolute inset-0">
        {text.slice(0, count)}
        <span
          className={cn(
            "ml-[0.04em] inline-block h-[0.9em] w-[0.06em] translate-y-[0.08em] bg-current align-baseline",
            done ? "animate-[caret_1.1s_steps(1)_infinite]" : "opacity-100"
          )}
        />
      </span>
    </Tag>
  );
};
