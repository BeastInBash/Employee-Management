import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-provider";
import {
    Users,
    ListChecks,
    CalendarCheck,
    ShieldCheck,
    ArrowRight,
    Github,
    LayoutDashboard,
    Bell,
    Clock,
    CheckCircle2,
} from "lucide-react";

// Subtle, reusable motion primitives — short distance, gentle easing.
const fadeUp: Variants = {
    hidden: { opacity: 0, y: 16 },
    show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
    },
};

const stagger: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08 } },
};

// Reveal-on-scroll wrapper used across sections.
const inView = {
    initial: "hidden",
    whileInView: "show",
    viewport: { once: true, amount: 0.2 },
} as const;

const features = [
    {
        icon: Users,
        title: "Team management",
        description:
            "Add team members, assign roles, and keep your whole org in one tidy roster. New members are onboarded with email invites.",
    },
    {
        icon: ListChecks,
        title: "Task tracking",
        description:
            "Move work from To-do to In progress, Review, and Done. Set priorities from low to urgent and never lose sight of due dates.",
    },
    {
        icon: CalendarCheck,
        title: "Attendance",
        description:
            "Members mark attendance daily; admins get a clear panel to review presence across the team at a glance.",
    },
    {
        icon: ShieldCheck,
        title: "Role-based access",
        description:
            "Admins see and manage everything. Members focus on their own tasks and attendance. Secure JWT auth throughout.",
    },
    {
        icon: LayoutDashboard,
        title: "Clean dashboards",
        description:
            "Purpose-built views for admins and members, so everyone lands exactly where they need to be after signing in.",
    },
    {
        icon: Bell,
        title: "Stay in the loop",
        description:
            "Instant feedback on every action with lightweight toasts, plus password self-service for members.",
    },
];

const steps = [
    {
        step: "01",
        title: "Create your team",
        description:
            "Sign up as an admin and invite members with a single click. They receive credentials by email.",
    },
    {
        step: "02",
        title: "Assign the work",
        description:
            "Break work into tasks, set priorities and due dates, and assign them to the right people.",
    },
    {
        step: "03",
        title: "Track & deliver",
        description:
            "Watch tasks flow to done and keep attendance in check — all from one dashboard.",
    },
];

const stats = [
    { value: "4", label: "Task stages", icon: ListChecks },
    { value: "2", label: "Roles built in", icon: ShieldCheck },
    { value: "Daily", label: "Attendance check", icon: Clock },
    { value: "1", label: "Dashboard to rule them", icon: LayoutDashboard },
];

const faqs = [
    {
        q: "Who can add team members?",
        a: "Admins. They invite members, who receive login credentials by email and can change their password on first sign-in.",
    },
    {
        q: "What task stages are supported?",
        a: "To-do, In progress, Review, and Completed — each with a priority of low, medium, high, or urgent.",
    },
    {
        q: "How does attendance work?",
        a: "Members mark their attendance, and admins review the whole team from a dedicated attendance panel.",
    },
    {
        q: "Is my data secure?",
        a: "Access is gated by role and protected with token-based authentication on every request.",
    },
];

const Landing = () => {
    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Header */}
            <motion.header
                initial={{ y: -24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
            >
                <div className="container mx-auto flex h-16 items-center justify-between px-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center bg-primary text-primary-foreground">
                            <Users className="h-5 w-5" />
                        </div>
                        <span className="font-display text-lg tracking-tight">Task Tracker</span>
                    </div>

                    <nav className="hidden items-center gap-8 md:flex">
                        <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                            Features
                        </a>
                        <a href="#how-it-works" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                            How it works
                        </a>
                        <a href="#faq" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                            FAQ
                        </a>
                    </nav>

                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <Button variant="ghost" asChild className="hidden sm:inline-flex">
                            <Link to="/login">Sign in</Link>
                        </Button>
                        <Button asChild>
                            <Link to="/login">Get started</Link>
                        </Button>
                    </div>
                </div>
            </motion.header>

            {/* Hero */}
            <section className="relative overflow-hidden">
                {/* decorative gradient glow */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 -top-40 -z-10 mx-auto h-[28rem] max-w-5xl bg-gradient-to-tr from-chart-1/30 via-chart-4/20 to-chart-2/30 blur-3xl"
                />
                <motion.div
                    variants={stagger}
                    initial="hidden"
                    animate="show"
                    className="container mx-auto px-4 py-20 text-center md:py-28"
                >
                    <motion.div variants={fadeUp} className="flex justify-center">
                        <Badge variant="secondary" className="mb-6 gap-1.5 px-3 py-1">
                            <span className="inline-block h-2 w-2 bg-chart-2" />
                            Tasks &amp; attendance, in one place
                        </Badge>
                    </motion.div>

                    <motion.h1
                        variants={fadeUp}
                        className="mx-auto max-w-3xl text-balance text-4xl tracking-tight sm:text-5xl md:text-6xl"
                    >
                        Keep your team{" "}
                        <span className="bg-gradient-to-r from-chart-1 to-chart-4 bg-clip-text text-transparent">
                            on task
                        </span>{" "}
                        and on time
                    </motion.h1>

                    <motion.p
                        variants={fadeUp}
                        className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground"
                    >
                        Task Tracker brings team management, task assignment, and daily
                        attendance together — so admins stay in control and members always
                        know what's next.
                    </motion.p>

                    <motion.div
                        variants={fadeUp}
                        className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
                    >
                        <Button size="lg" asChild className="gap-2">
                            <Link to="/login">
                                Start tracking
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </Button>
                        <Button size="lg" variant="outline" asChild>
                            <a href="#features">See features</a>
                        </Button>
                    </motion.div>

                    {/* App preview mockup */}
                    <motion.div
                        variants={fadeUp}
                        className="relative mx-auto mt-16 max-w-4xl"
                    >
                        <div className="border border-border bg-card p-2 shadow-2xl shadow-black/10">
                            <div className="border border-border bg-muted/40">
                                {/* window chrome */}
                                <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
                                    <span className="h-3 w-3 bg-chart-5/70" />
                                    <span className="h-3 w-3 bg-chart-4/70" />
                                    <span className="h-3 w-3 bg-chart-2/70" />
                                    <div className="ml-3 flex items-center gap-2 text-xs text-muted-foreground">
                                        <Users className="h-3.5 w-3.5" />
                                        Team Members
                                    </div>
                                </div>
                                {/* fake member grid */}
                                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
                                    {[
                                        { name: "Aisha Khan", role: "Frontend Dev", done: 12 },
                                        { name: "Marco Silva", role: "Backend Dev", done: 8 },
                                        { name: "Lena Park", role: "Designer", done: 15 },
                                    ].map((m, i) => (
                                        <motion.div
                                            key={m.name}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.5 + i * 0.1, duration: 0.4 }}
                                            className="border border-border bg-card p-4 text-left"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="flex h-8 w-8 items-center justify-center bg-secondary text-xs font-semibold text-secondary-foreground">
                                                    {m.name
                                                        .split(" ")
                                                        .map((p) => p[0])
                                                        .join("")}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium leading-none">{m.name}</div>
                                                    <div className="text-xs text-muted-foreground">{m.role}</div>
                                                </div>
                                            </div>
                                            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <CheckCircle2 className="h-3.5 w-3.5 text-chart-2" />
                                                {m.done} tasks done
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </section>

            {/* Stats strip */}
            <section className="border-y border-border bg-muted/30">
                <motion.div
                    variants={stagger}
                    {...inView}
                    className="container mx-auto grid grid-cols-2 gap-6 px-4 py-10 md:grid-cols-4"
                >
                    {stats.map((s) => (
                        <motion.div key={s.label} variants={fadeUp} className="text-center">
                            <s.icon className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                            <div className="font-display text-2xl">{s.value}</div>
                            <div className="text-sm text-muted-foreground">{s.label}</div>
                        </motion.div>
                    ))}
                </motion.div>
            </section>

            {/* Features */}
            <section id="features" className="container mx-auto px-4 py-20 md:py-28">
                <motion.div variants={fadeUp} {...inView} className="mx-auto max-w-2xl text-center">
                    <h2 className="text-3xl tracking-tight sm:text-4xl">
                        Everything your team needs
                    </h2>
                    <p className="mt-4 text-muted-foreground">
                        From the first invite to the last completed task — Task Tracker covers
                        the whole loop without the clutter.
                    </p>
                </motion.div>

                <motion.div
                    variants={stagger}
                    {...inView}
                    className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
                >
                    {features.map((f) => (
                        <motion.div
                            key={f.title}
                            variants={fadeUp}
                            whileHover={{ y: -4 }}
                            transition={{ type: "spring", stiffness: 300, damping: 24 }}
                        >
                            <Card className="h-full transition-shadow hover:shadow-md">
                                <CardHeader>
                                    <div className="mb-2 flex h-11 w-11 items-center justify-center bg-secondary text-secondary-foreground">
                                        <f.icon className="h-5 w-5" />
                                    </div>
                                    <CardTitle className="text-lg">{f.title}</CardTitle>
                                    <CardDescription className="leading-relaxed">
                                        {f.description}
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        </motion.div>
                    ))}
                </motion.div>
            </section>

            {/* How it works */}
            <section id="how-it-works" className="border-t border-border bg-muted/30">
                <div className="container mx-auto px-4 py-20 md:py-28">
                    <motion.div variants={fadeUp} {...inView} className="mx-auto max-w-2xl text-center">
                        <h2 className="text-3xl tracking-tight sm:text-4xl">
                            Up and running in three steps
                        </h2>
                        <p className="mt-4 text-muted-foreground">
                            No lengthy setup. Create a team, assign work, and start delivering.
                        </p>
                    </motion.div>

                    <motion.div
                        variants={stagger}
                        {...inView}
                        className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3"
                    >
                        {steps.map((s, i) => (
                            <motion.div key={s.step} variants={fadeUp} className="relative">
                                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center bg-primary font-display text-lg text-primary-foreground">
                                    {s.step}
                                </div>
                                {i < steps.length - 1 && (
                                    <ArrowRight className="absolute right-4 top-3 hidden h-5 w-5 text-muted-foreground md:block" />
                                )}
                                <h3 className="mb-2 text-xl">{s.title}</h3>
                                <p className="text-muted-foreground">{s.description}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* FAQ */}
            <section id="faq" className="container mx-auto px-4 py-20 md:py-28">
                <div className="mx-auto max-w-3xl">
                    <motion.h2
                        variants={fadeUp}
                        {...inView}
                        className="text-center text-3xl tracking-tight sm:text-4xl"
                    >
                        Frequently asked
                    </motion.h2>
                    <motion.div
                        variants={stagger}
                        {...inView}
                        className="mt-12 grid gap-6 sm:grid-cols-2"
                    >
                        {faqs.map((item) => (
                            <motion.div
                                key={item.q}
                                variants={fadeUp}
                                className="border border-border bg-card p-6"
                            >
                                <h3 className="text-base font-semibold">{item.q}</h3>
                                <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* CTA */}
            <section className="container mx-auto px-4 pb-20 md:pb-28">
                <motion.div
                    variants={fadeUp}
                    {...inView}
                    className="relative overflow-hidden border border-border bg-card px-6 py-14 text-center md:py-20"
                >
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-chart-1/10 via-transparent to-chart-2/10"
                    />
                    <h2 className="mx-auto max-w-2xl text-3xl tracking-tight sm:text-4xl">
                        Ready to get your team on track?
                    </h2>
                    <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                        Create your account and start assigning tasks in minutes.
                    </p>
                    <Button size="lg" asChild className="mt-8 gap-2">
                        <Link to="/login">
                            Get started — it's free
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </Button>
                </motion.div>
            </section>

            {/* Footer */}
            <footer className="border-t border-border">
                <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row">
                    <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center bg-primary text-primary-foreground">
                            <Users className="h-4 w-4" />
                        </div>
                        <span className="font-display text-sm">Task Tracker</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        © {new Date().getFullYear()} Task Tracker. All rights reserved.
                    </p>
                    <div className="flex items-center gap-4">
                        <Link to="/login" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                            Sign in
                        </Link>
                        <a
                            href="https://github.com/Thebeast01"
                            target="_blank"
                            rel="noreferrer"
                            className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <Github className="h-5 w-5" />
                            <span className="sr-only">GitHub</span>
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
