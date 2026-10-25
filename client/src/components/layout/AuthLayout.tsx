import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Leaf } from "./Leaf";

/** Centred card on the canvas, used by sign-in and the password pages. */
export const AuthLayout = ({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
    <Link to="/" className="mb-8 flex items-center gap-2 text-lg font-semibold tracking-tight">
      <Leaf className="h-5 w-5 text-primary" />
      Crewly
    </Link>
    <motion.div
      initial={{ opacity: 0, transform: "translateY(8px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      className="w-full max-w-[400px]"
    >
      <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-[0_24px_64px_-40px_rgb(46_38_20/0.45)] sm:p-8">
        <div className="mb-6 space-y-1.5">
          <h1 className="text-2xl">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {children}
      </div>
      {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
    </motion.div>
  </div>
);
