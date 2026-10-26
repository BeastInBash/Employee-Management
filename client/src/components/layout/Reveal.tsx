import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { EASE } from "@/lib/motion";

/**
 * Fades content in (with a 4px lift) when it first appears, e.g. when loaded
 * data replaces a skeleton, so it settles in instead of snapping. It only plays
 * on mount: refreshed data inside it updates in place without replaying.
 * Reduced motion keeps the fade and drops the lift (MotionConfig).
 */
export const Reveal = ({ children, className }: { children: ReactNode; className?: string }) => (
  <motion.div
    initial={{ opacity: 0, transform: "translateY(4px)" }}
    animate={{ opacity: 1, transform: "translateY(0px)" }}
    transition={{ duration: 0.28, ease: EASE }}
    className={className}
  >
    {children}
  </motion.div>
);
