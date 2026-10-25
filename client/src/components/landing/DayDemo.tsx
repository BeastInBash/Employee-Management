import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const demoTasks = [
    { id: "a", title: "Reply to the Hartley quote" },
    { id: "b", title: "Finish the spring menu photos" },
    { id: "c", title: "Update the stock sheet" },
];

/**
 * The hero's one interactive moment: tick off a teammate's day and watch her
 * attendance resolve itself, which is the whole idea of the product.
 */
export const DayDemo = () => {
    const [done, setDone] = useState<Record<string, boolean>>({ a: true });
    const count = demoTasks.filter((t) => done[t.id]).length;
    const status = count === demoTasks.length ? "present" : count > 0 ? "partial" : "absent";
    const label = { present: "Present", partial: "Partial", absent: "Not started" }[status];

    return (
        <div className="relative">
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-[0_32px_80px_-40px_rgb(46_38_20/0.45)] sm:p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                            PS
                        </span>
                        <div>
                            <p className="text-[15px] font-medium">Priya Shah</p>
                            <p className="text-sm text-muted-foreground">Today, 3 tasks planned</p>
                        </div>
                    </div>
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                            key={status}
                            initial={{ opacity: 0, transform: "scale(0.92)" }}
                            animate={{ opacity: 1, transform: "scale(1)" }}
                            exit={{ opacity: 0, transform: "scale(0.96)", transition: { duration: 0.1 } }}
                            transition={{ type: "spring", duration: 0.35, bounce: 0.25 }}
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium",
                                status === "present" && "bg-primary text-primary-foreground",
                                status === "partial" && "bg-honey-soft text-honey",
                                status === "absent" && "bg-muted text-muted-foreground"
                            )}
                            aria-live="polite"
                        >
                            {status === "present" && <Check className="h-3.5 w-3.5" />}
                            {label}
                        </motion.span>
                    </AnimatePresence>
                </div>
                <ul className="space-y-2">
                    {demoTasks.map((t) => {
                        const checked = !!done[t.id];
                        return (
                            <li key={t.id}>
                                <button
                                    onClick={() => setDone((d) => ({ ...d, [t.id]: !d[t.id] }))}
                                    aria-pressed={checked}
                                    className="flex w-full items-center gap-3 rounded-xl bg-surface px-3.5 py-3 text-left ring-1 ring-border/70 transition-colors hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-ring"
                                >
                                    <span
                                        className={cn(
                                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200",
                                            checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card"
                                        )}
                                    >
                                        <motion.span initial={false} animate={{ opacity: checked ? 1 : 0, scale: checked ? 1 : 0.6 }} transition={{ duration: 0.15 }}>
                                            <Check className="h-3 w-3" strokeWidth={3} />
                                        </motion.span>
                                    </span>
                                    <span className={cn("text-sm transition-colors", checked && "text-muted-foreground line-through decoration-muted-foreground/40")}>
                                        {t.title}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <motion.div
                        className="h-full rounded-full bg-honey"
                        initial={false}
                        animate={{ width: `${(count / demoTasks.length) * 100}%` }}
                        transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                    />
                </div>
            </div>
            <p className="mt-4 text-center text-sm text-muted-foreground">Tick off Priya's day and watch her attendance.</p>
        </div>
    );
};
