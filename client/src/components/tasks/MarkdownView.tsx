import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const MarkdownBody = lazy(() => import("./MarkdownBody"));

/**
 * A Markdown task description. `compact` is the card version: small text,
 * headings flattened, cut off after about three lines, with a fade only when
 * something was actually cut. While the renderer loads (first time only) the
 * plain text shows in its place.
 */
export const MarkdownView = ({
  text,
  compact = false,
  className,
}: {
  text: string;
  compact?: boolean;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [cut, setCut] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!compact || !el) return;
    const check = () => setCut(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    // The rendered Markdown replaces the fallback after mount; re-check then too.
    const mo = new MutationObserver(check);
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [compact, text]);

  return (
    <div
      ref={ref}
      className={cn(
        "markdown break-words",
        compact ? "markdown-compact max-h-[4.6em] overflow-hidden text-xs text-muted-foreground" : "text-sm",
        compact && cut && "markdown-fade",
        className,
      )}
    >
      <Suspense fallback={<p className="whitespace-pre-line">{text}</p>}>
        <MarkdownBody text={text} />
      </Suspense>
    </div>
  );
};
