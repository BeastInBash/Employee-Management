import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import type { Variants } from "framer-motion";
import { ArrowDown, BarChart3, Clock, FolderKanban, KeyRound, ShieldCheck, UsersRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Leaf } from "@/components/layout/Leaf";
import { DayDemo } from "@/components/landing/DayDemo";
import { Typewriter } from "@/components/landing/Typewriter";
import { ScrollRevealText } from "@/components/landing/ScrollRevealText";
import { cn } from "@/lib/utils";

const EASE = [0.23, 1, 0.32, 1] as const;

// Scroll-triggered reveal used by the sections below the hero.
const rise: Variants = {
    hidden: { opacity: 0, transform: "translateY(18px)" },
    show: { opacity: 1, transform: "translateY(0px)", transition: { duration: 0.6, ease: EASE } },
};
const inView = { initial: "hidden", whileInView: "show", viewport: { once: true, amount: 0.25 } } as const;

const steps = [
    {
        title: "Plan in the morning",
        body: "Everyone writes down what they'll get done today. Admins and leads can hand out tasks too.",
    },
    {
        title: "Work through the list",
        body: "Tasks move from to do to done. Leads watch their project come together as it happens.",
    },
    {
        title: "Attendance settles itself",
        body: "Everything finished counts as present, some of it as partial, nothing planned as absent.",
    },
];

const features = [
    {
        icon: FolderKanban,
        title: "Projects with a lead",
        body: "Give every project an owner who can assign work and keep it moving, without handing out admin rights.",
    },
    {
        icon: UsersRound,
        title: "Teams",
        body: "Group people the way you already work, then bring a whole team onto a project in one step.",
    },
    {
        icon: BarChart3,
        title: "Reports you can hand over",
        body: "On-time rate, open work and attendance for any person, team or project, ready to export as CSV.",
    },
    {
        icon: Clock,
        title: "Submission hours",
        body: "Want plans in by ten? Set the hours for a workspace. Leave it off and people add tasks whenever.",
    },
    {
        icon: KeyRound,
        title: "Google sign-in",
        body: "People sign in with the work account they already have, with no new password to forget.",
    },
    {
        icon: ShieldCheck,
        title: "Sensible access",
        body: "Admins see everything, leads see what they lead, and everyone else sees their own work.",
    },
];

// ─── nav ────────────────────────────────────────────────────────────────────

/** Transparent over the photo, then a frosted oat bar once the page scrolls. */
const Nav = () => {
    const { scrollY } = useScroll();
    const [solid, setSolid] = useState(false);
    useMotionValueEvent(scrollY, "change", (y) => setSolid(y > 48));

    return (
        <header
            className={cn(
                "fixed inset-x-0 top-0 z-40 transition-[background-color,box-shadow,color] duration-300",
                solid
                    ? "bg-background/85 text-foreground shadow-[0_1px_0_var(--border)] backdrop-blur-md"
                    : "bg-transparent text-white"
            )}
        >
            <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-5 sm:px-8">
                <Link to="/" className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
                    <Leaf className={cn("h-5 w-5 transition-colors", solid ? "text-primary" : "text-[#e9d9a8]")} />
                    Crewly
                </Link>
                <nav className="flex items-center gap-1 sm:gap-2">
                    {[
                        ["About", "#about"],
                        ["Features", "#features"],
                    ].map(([label, href]) => (
                        <a
                            key={href}
                            href={href}
                            className={cn(
                                "hidden rounded-sm px-3 py-2 text-sm transition-colors sm:block",
                                solid ? "text-muted-foreground hover:text-foreground" : "text-white/80 hover:text-white"
                            )}
                        >
                            {label}
                        </a>
                    ))}
                    <Button variant="ghost" asChild className={cn(!solid && "text-white hover:bg-white/10 hover:text-white")}>
                        <Link to="/login">Sign in</Link>
                    </Button>
                    <Button asChild className={cn(!solid && "bg-[#f5f0e6] text-[#353d1f] hover:bg-white")}>
                        <Link to="/login?tab=signup">Get started</Link>
                    </Button>
                </nav>
            </div>
        </header>
    );
};

// ─── hero ───────────────────────────────────────────────────────────────────

const Hero = () => {
    const ref = useRef<HTMLElement>(null);
    const reduce = useReducedMotion();
    const [typed, setTyped] = useState(false);
    const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });

    // Parallax: the photo drifts down slower than the page; the copy lifts and fades.
    const imageY = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "22%"]);
    const imageScale = useTransform(scrollYProgress, [0, 1], [1.06, reduce ? 1.06 : 1.16]);
    const copyY = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "-28%"]);
    const copyOpacity = useTransform(scrollYProgress, [0, 0.7], [1, reduce ? 1 : 0]);

    return (
        <section ref={ref} className="relative isolate flex min-h-[100svh] items-end overflow-hidden bg-[#2b2a22]">
            <motion.div className="absolute inset-0 -z-10 will-change-transform" style={{ y: imageY, scale: imageScale }}>
                <img
                    src="/images/hero-team-1280.webp"
                    srcSet="/images/hero-team-1280.webp 1280w, /images/hero-team-2400.webp 2400w"
                    sizes="100vw"
                    alt=""
                    className="h-full w-full object-cover object-[24%_center] sm:object-[60%_center]"
                    fetchPriority="high"
                />
            </motion.div>
            {/* Warm shade so white type reads on any part of the photo. */}
            {/* Phones: shade rises from the bottom, where the copy sits. Wider: from the left. */}
            <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(31_28_16/0.25)_0%,rgb(31_28_16/0.72)_45%,rgb(31_28_16/0.94)_100%)] sm:bg-[linear-gradient(100deg,rgb(31_28_16/0.92)_0%,rgb(31_28_16/0.78)_38%,rgb(31_28_16/0.35)_68%,rgb(31_28_16/0.12)_100%)]" />
            <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-[rgb(31_28_16/0.55)] to-transparent" />

            <motion.div
                style={{ y: copyY, opacity: copyOpacity }}
                className="mx-auto w-full max-w-[1180px] px-5 pb-20 pt-36 sm:px-8 sm:pb-28"
            >
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, ease: EASE }}
                    className="mb-5 text-[15px] text-[#e9d9a8]"
                >
                    For small teams who'd rather work than clock in
                </motion.p>
                <Typewriter
                    as="h1"
                    text="Attendance that takes care of itself."
                    className="block max-w-[15ch] text-[46px] font-semibold leading-[1.04] tracking-[-0.035em] text-white sm:text-[72px]"
                    speed={48}
                    startDelay={300}
                    onDone={() => setTyped(true)}
                />
                <motion.div
                    initial={{ opacity: 0, transform: "translateY(10px)" }}
                    animate={typed || reduce ? { opacity: 1, transform: "translateY(0px)" } : {}}
                    transition={{ duration: 0.6, ease: EASE }}
                >
                    <p className="mt-6 max-w-[50ch] text-lg leading-relaxed text-white/80">
                        Your team plans the day as a short list of tasks. Finish the list and Crewly marks you present, with
                        projects, teams and leads for the people running a small business.
                    </p>
                    <div className="mt-9 flex flex-wrap gap-3">
                        <Button size="lg" asChild className="bg-[#f5f0e6] text-[#353d1f] hover:bg-white">
                            <Link to="/login?tab=signup">Create your workspace</Link>
                        </Button>
                        <Button size="lg" variant="ghost" asChild className="text-white ring-1 ring-white/30 hover:bg-white/10 hover:text-white">
                            <a href="#about">See how it works</a>
                        </Button>
                    </div>
                </motion.div>
            </motion.div>

            <motion.a
                href="#about"
                aria-label="Scroll to the next section"
                initial={{ opacity: 0 }}
                animate={{ opacity: typed || reduce ? 1 : 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 rounded-full p-2 text-white/70 hover:text-white sm:block"
            >
                <motion.span
                    className="block"
                    animate={reduce ? {} : { transform: ["translateY(0px)", "translateY(6px)", "translateY(0px)"] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                >
                    <ArrowDown className="h-5 w-5" />
                </motion.span>
            </motion.a>
        </section>
    );
};

// ─── about ──────────────────────────────────────────────────────────────────

const About = () => {
    const ref = useRef<HTMLElement>(null);
    const reduce = useReducedMotion();
    const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
    // The demo card floats against the scroll for a little depth.
    const demoY = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 70, reduce ? 0 : -70]);

    return (
        <section id="about" ref={ref} className="scroll-mt-16 overflow-hidden">
            <div className="mx-auto grid max-w-[1180px] gap-14 px-5 py-24 sm:px-8 sm:py-32 lg:grid-cols-[1.15fr_1fr] lg:items-center">
                <div>
                    <motion.h2 variants={rise} {...inView} className="mb-8 text-base font-medium text-primary">
                        About Crewly
                    </motion.h2>
                    <ScrollRevealText
                        className="text-[28px] font-medium leading-[1.3] tracking-[-0.02em] text-foreground sm:text-[36px]"
                        text="Crewly is a calm place for a small team to plan its day, share the work and see how things are going. Nobody clocks in. When people finish what they set out to do, the day counts. That's attendance, worked out from the work itself."
                    />
                </div>
                <motion.div style={{ y: demoY }}>
                    <DayDemo />
                </motion.div>
            </div>

            <div className="border-y border-border/70 bg-card">
                <div className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8">
                    <motion.h3 variants={rise} {...inView} className="max-w-[24ch] text-3xl tracking-tight sm:text-4xl">
                        How a day works
                    </motion.h3>
                    <motion.ol
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, amount: 0.3 }}
                        variants={{ show: { transition: { staggerChildren: 0.12 } } }}
                        className="mt-12 grid gap-10 md:grid-cols-3"
                    >
                        {steps.map((s, i) => (
                            <motion.li key={s.title} variants={rise} className="relative">
                                {/* A real sequence, so the steps are numbered. */}
                                <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                                    {i + 1}
                                </span>
                                <h4 className="text-lg">{s.title}</h4>
                                <p className="mt-2 max-w-[38ch] text-muted-foreground">{s.body}</p>
                            </motion.li>
                        ))}
                    </motion.ol>
                </div>
            </div>
        </section>
    );
};

// ─── features ───────────────────────────────────────────────────────────────

const Features = () => (
    <section id="features" className="scroll-mt-16">
        <div className="mx-auto grid max-w-[1180px] gap-12 px-5 py-24 sm:px-8 sm:py-32 lg:grid-cols-[0.9fr_1.1fr]">
            {/* The heading stays put while the list scrolls past it. */}
            <div className="lg:sticky lg:top-28 lg:self-start">
                <motion.h2 variants={rise} {...inView} className="max-w-[16ch] text-3xl tracking-tight sm:text-[42px] sm:leading-[1.1]">
                    Everything a small team needs, and nothing it doesn't
                </motion.h2>
                <motion.p variants={rise} {...inView} className="mt-5 max-w-[42ch] text-muted-foreground">
                    Built for a shop floor of five or an office of fifty: the parts you'll use every day, without the ones
                    you'd have to configure.
                </motion.p>
                <motion.div variants={rise} {...inView} className="mt-8">
                    <Button asChild>
                        <Link to="/login?tab=signup">Try it with your team</Link>
                    </Button>
                </motion.div>
            </div>
            <ul className="divide-y divide-border/70 border-y border-border/70">
                {features.map((f) => (
                    <motion.li key={f.title} variants={rise} {...inView} className="flex gap-5 py-7">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                            <f.icon className="h-5 w-5" />
                        </span>
                        <div>
                            <h3 className="text-lg">{f.title}</h3>
                            <p className="mt-1.5 max-w-[52ch] leading-relaxed text-muted-foreground">{f.body}</p>
                        </div>
                    </motion.li>
                ))}
            </ul>
        </div>
    </section>
);

// ─── closing band & footer ──────────────────────────────────────────────────

const Closing = () => {
    const ref = useRef<HTMLDivElement>(null);
    const reduce = useReducedMotion();
    const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
    const leafY = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : -40, reduce ? 0 : 60]);
    const leafRotate = useTransform(scrollYProgress, [0, 1], [reduce ? -12 : -24, reduce ? -12 : 6]);

    return (
        <section className="mx-auto max-w-[1180px] px-5 pb-24 sm:px-8">
            <div ref={ref} className="relative overflow-hidden rounded-[28px] bg-sidebar px-8 py-16 sm:px-14 sm:py-20">
                {/* A large leaf drifting with the scroll; decoration only. */}
                <motion.div
                    aria-hidden
                    style={{ y: leafY, rotate: leafRotate }}
                    className="pointer-events-none absolute -right-10 -top-10 text-white/[0.06] sm:right-6"
                >
                    <Leaf className="h-72 w-72" />
                </motion.div>
                <div className="relative max-w-xl">
                    <Typewriter
                        as="h2"
                        text="Set up your team this afternoon."
                        className="block text-3xl font-semibold tracking-tight text-white sm:text-[40px] sm:leading-[1.15]"
                        speed={38}
                    />
                    <motion.p variants={rise} {...inView} className="mt-4 text-lg text-sidebar-foreground/80">
                        Create a workspace, add your people, and tomorrow's attendance takes care of itself.
                    </motion.p>
                    <motion.div variants={rise} {...inView} className="mt-8 flex flex-wrap gap-3">
                        <Button size="lg" asChild className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90">
                            <Link to="/login?tab=signup">Get started free</Link>
                        </Button>
                        <Button size="lg" variant="ghost" asChild className="text-white ring-1 ring-white/25 hover:bg-white/10 hover:text-white">
                            <Link to="/login">Sign in</Link>
                        </Button>
                    </motion.div>
                </div>
            </div>
        </section>
    );
};

const Footer = () => (
    <footer className="border-t border-border/70 bg-card">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-5 py-14 sm:grid-cols-2 sm:px-8 lg:grid-cols-[1.4fr_1fr_1fr]">
            <div>
                <Link to="/" className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
                    <Leaf className="h-5 w-5 text-primary" />
                    Crewly
                </Link>
                <p className="mt-3 max-w-[34ch] text-sm leading-relaxed text-muted-foreground">
                    Tasks, teams and attendance for small businesses, worked out from the work itself.
                </p>
            </div>
            <div>
                <h3 className="text-sm font-semibold">Product</h3>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <li>
                        <a href="#about" className="hover:text-foreground">
                            About
                        </a>
                    </li>
                    <li>
                        <a href="#features" className="hover:text-foreground">
                            Features
                        </a>
                    </li>
                    <li>
                        <Link to="/login" className="hover:text-foreground">
                            Sign in
                        </Link>
                    </li>
                </ul>
            </div>
            <div>
                <h3 className="text-sm font-semibold">Get started</h3>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <li>
                        <Link to="/login?tab=signup" className="hover:text-foreground">
                            Create a workspace
                        </Link>
                    </li>
                    <li>
                        <Link to="/forgot-password" className="hover:text-foreground">
                            Reset your password
                        </Link>
                    </li>
                    <li>
                        <a href="https://github.com/Thebeast01" target="_blank" rel="noreferrer" className="hover:text-foreground">
                            GitHub
                        </a>
                    </li>
                </ul>
            </div>
        </div>
        <div className="border-t border-border/70">
            <div className="mx-auto flex max-w-[1180px] flex-col gap-2 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <span>© {new Date().getFullYear()} Crewly</span>
                <span>
                    Photo by{" "}
                    <a
                        href="https://unsplash.com/@sableflow?utm_source=crewly&utm_medium=referral"
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2 hover:text-foreground"
                    >
                        Sable Flow
                    </a>{" "}
                    on{" "}
                    <a
                        href="https://unsplash.com/?utm_source=crewly&utm_medium=referral"
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2 hover:text-foreground"
                    >
                        Unsplash
                    </a>
                </span>
            </div>
        </div>
    </footer>
);

// ─── page ───────────────────────────────────────────────────────────────────

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
            <Nav />
            <main>
                <Hero />
                <About />
                <Features />
                <Closing />
            </main>
            <Footer />
        </div>
    );
};

export default Landing;
