import { motion } from "framer-motion";
import type { Variants } from "framer-motion";

const EASE = [0.23, 1, 0.32, 1] as const;

const line: Variants = {
    hidden: { transform: "translateY(110%)" },
    show: (i: number) => ({ transform: "translateY(0%)", transition: { duration: 0.75, ease: EASE, delay: i * 0.09 } }),
};

/**
 * A headline whose lines rise into place from behind their own baseline, one
 * after another, the first time it scrolls into view. The heading itself watches
 * the viewport: the lines start clipped out of sight, so they can't. Reduced
 * motion skips the transform (MotionConfig) so the text simply appears.
 */
export const LineReveal = ({
    lines,
    as = "h2",
    className,
}: {
    lines: string[];
    as?: "h1" | "h2" | "h3";
    className?: string;
}) => {
    const Tag = motion[as];
    return (
        <Tag initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.6 }} className={className}>
            {lines.map((text, i) => (
                // The bottom padding keeps descenders from being clipped by the mask.
                <span key={text} className="-mb-[0.1em] block overflow-hidden pb-[0.1em]">
                    <motion.span className="block" variants={line} custom={i}>
                        {text}
                    </motion.span>
                    {/* Keeps the lines apart when read as one string (screen readers, copy). */}
                    {i < lines.length - 1 && " "}
                </span>
            ))}
        </Tag>
    );
};
