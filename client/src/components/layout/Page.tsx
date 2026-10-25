import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The top of every page: an optional back link, the title, a one-line
 * description and the page's actions, right-aligned on wide screens.
 */
export const PageHeader = ({
  title,
  description,
  actions,
  back,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
  className?: string;
}) => (
  <div className={cn("mb-8 space-y-3", className)}>
    {back && (
      <Link
        to={back.to}
        className="-ml-1 inline-flex items-center gap-1 rounded-sm px-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ChevronLeft className="h-4 w-4" />
        {back.label}
      </Link>
    )}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-[28px] leading-tight sm:text-[32px]">{title}</h1>
        {description && <p className="max-w-[62ch] text-[15px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
    </div>
  </div>
);

/** A titled block within a page. */
export const Section = ({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <section className={cn("space-y-4", className)}>
    {(title || actions) && (
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-0.5">
          {title && <h2 className="text-base">{title}</h2>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
    )}
    {children}
  </section>
);

/** A white panel on the canvas — the default container for tables and lists. */
export const Panel = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("rounded-xl border border-border/80 bg-card", className)}>{children}</div>
);
