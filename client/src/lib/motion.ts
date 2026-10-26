import type { Variants } from "framer-motion";

/** The app's ease-out curve (matches --ease-out in index.css). */
export const EASE = [0.23, 1, 0.32, 1] as const;

/** A grid that enters once: children fade up 6px, 40ms apart. */
export const gridIn: Variants = { show: { transition: { staggerChildren: 0.04 } } };
export const tileIn: Variants = {
  hidden: { opacity: 0, transform: "translateY(6px)" },
  show: { opacity: 1, transform: "translateY(0px)", transition: { duration: 0.3, ease: EASE } },
};
