import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, Check, Clock, FolderKanban, KeyRound, ShieldCheck, UsersRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Leaf } from "@/components/layout/Leaf";
import { cn } from "@/lib/utils";

const features = [
    {
        icon: FolderKanban,
        title: "Projects with a lead",
        body: "Give every project an owner. Leads assign work and keep it moving without needing admin rights.",
    },
    {
        icon: UsersRound,
        title: "Teams",
        body: "Group people the way you already work, then bring a whole team onto a project in one step.",
    },
    {
        icon: BarChart3,
        title: "Reports you can hand over",
        body: "On-time rate, open work and attendance for any person, team or project. Export to CSV.",
    },
    {
        icon: Clock,
        title: "Submission hours",
        body: "Want plans in by 10 AM? Set the hours per workspace. Leave it off and people add tasks anytime.",
    },
    {
        icon: KeyRound,
        title: "Google sign-in",
        body: "People sign in with the work account they already have. No new password to forget.",
    },
    {
        icon: ShieldCheck,
        title: "Sensible access",
        body: "Admins see everything, leads see what they lead, everyone else sees their own work.",
    },
];

const demoTasks = [
    { id: "a", title: "Reply to the Hartley quote" },
    { id: "b", title: "Finish the spring menu photos" },
    { id: "c", title: "Update the stock sheet" },
];

/**
 * The hero's one interactive moment: tick off a teammate's day and watch her
 * attendance resolve itself, which is the whole idea of the product.
 */
const DayDemo = () => {
    const [done, setDone] = useState<Record<string, boolean>>({ a: true });
    const count = demoTasks.filter((t) => done[t.id]).length;
    const status = count === demoTasks.length ? "present" : count > 0 ? "partial" : "absent";
    const label = { present: "Present", partial: "Partial", absent: "Not started" }[status];

    return (
        <div className="relative">
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-[0_32px_80px_-40px_rgb(20_40_28/0.45)] sm:p-6">
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
                                status === "partial" && "bg-olive-soft text-olive",
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
                        className="h-full rounded-full bg-olive"
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

const Landing = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    // A signed-in visitor goes straight back into the app.
    useEffect(() => {
        if (!user) return;
        navigate(user.role === "admin" ? "/dashboard" : `/todos/${user.id}`, { replace: true });
    }, [user, navigate]);

    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-5 sm:px-8">
                <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
                    <Leaf className="h-5 w-5 text-primary" />
                    Crewly
                </Link>
                <nav className="flex items-center gap-1 sm:gap-2">
                    <a href="#how" className="hidden rounded-sm px-3 py-2 text-sm text-muted-foreground hover:text-foreground sm:block">
                        How it works
                    </a>
                    <a href="#features" className="hidden rounded-sm px-3 py-2 text-sm text-muted-foreground hover:text-foreground sm:block">
                        Features
                    </a>
                    <Button variant="ghost" asChild>
                        <Link to="/login">Sign in</Link>
                    </Button>
                    <Button asChild>
                        <Link to="/login?tab=signup">Get started</Link>
                    </Button>
                </nav>
            </header>

            <main>
                <section className="mx-auto grid max-w-[1180px] items-center gap-14 px-5 pb-24 pt-12 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
                    <motion.div
                        initial={{ opacity: 0, transform: "translateY(8px)" }}
                        animate={{ opacity: 1, transform: "translateY(0px)" }}
                        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                    >
                        <h1 className="max-w-[16ch] text-[44px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[60px]">
                            Attendance that takes care of itself.
                        </h1>
                        <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-muted-foreground">
                            Your team plans the day as a short list of tasks. Finish the list and Crewly marks you present. No
                            clock-ins, no timesheets, just the work, with projects, teams and leads for the people running a
                            small business.
                        </p>
                        <div className="mt-9 flex flex-wrap gap-3">
                            <Button size="lg" asChild>
                                <Link to="/login?tab=signup">Create your workspace</Link>
                            </Button>
                            <Button size="lg" variant="outline" asChild>
                                <Link to="/login">Sign in</Link>
                            </Button>
                        </div>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, transform: "translateY(12px)" }}
                        animate={{ opacity: 1, transform: "translateY(0px)" }}
                        transition={{ duration: 0.6, delay: 0.12, ease: [0.23, 1, 0.32, 1] }}
                    >
                        <DayDemo />
                    </motion.div>
                </section>

                <section id="how" className="border-y border-border/70 bg-card">
                    <div className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8">
                        <h2 className="max-w-[24ch] text-3xl tracking-tight sm:text-4xl">A working day, the way Crewly sees it</h2>
                        <ol className="mt-12 grid gap-10 md:grid-cols-3">
                            {[
                                ["Plan in the morning", "Each person adds what they'll get done today. Admins and leads can assign tasks too."],
                                ["Work through it", "Tasks move from to do to done. Leads see their project's progress as it happens."],
                                ["Attendance settles itself", "Everything done means present. Some of it means partial. Nothing planned means absent."],
                            ].map(([title, body], i) => (
                                <li key={title} className="relative pl-6">
                                    <span className={cn("absolute left-0 top-2 h-2.5 w-2.5 rounded-full", i === 2 ? "bg-primary" : "bg-olive/60")} />
                                    <h3 className="text-lg">{title}</h3>
                                    <p className="mt-2 max-w-[38ch] text-muted-foreground">{body}</p>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                <section id="features" className="mx-auto max-w-[1180px] px-5 py-24 sm:px-8">
                    <h2 className="max-w-[26ch] text-3xl tracking-tight sm:text-4xl">Everything a small team needs, and nothing it doesn't</h2>
                    <div className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                        {features.map((f) => (
                            <div key={f.title} className="flex gap-4">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                                    <f.icon className="h-5 w-5" />
                                </span>
                                <div>
                                    <h3 className="text-base">{f.title}</h3>
                                    <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{f.body}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="mx-auto max-w-[1180px] px-5 pb-24 sm:px-8">
                    <div className="flex flex-col items-start justify-between gap-6 rounded-[28px] bg-sidebar px-8 py-12 text-sidebar-foreground sm:flex-row sm:items-center sm:px-12">
                        <div>
                            <h2 className="text-2xl tracking-tight text-white sm:text-3xl">Set up your team this afternoon.</h2>
                            <p className="mt-2 text-sidebar-foreground/75">Create a workspace, add your people, and tomorrow's attendance takes care of itself.</p>
                        </div>
                        <Button size="lg" asChild className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90">
                            <Link to="/login?tab=signup">Get started</Link>
                        </Button>
                    </div>
                </section>
            </main>

            <footer className="border-t border-border/70">
                <div className="mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:px-8">
                    <span className="flex items-center gap-2">
                        <Leaf className="h-4 w-4 text-primary" />
                        Crewly
                    </span>
                    <span>© {new Date().getFullYear()} Crewly</span>
                    <a href="https://github.com/Thebeast01" target="_blank" rel="noreferrer" className="hover:text-foreground">
                        GitHub
                    </a>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
