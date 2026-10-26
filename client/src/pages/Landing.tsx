import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import type { Variants } from "framer-motion";
import { ArrowDown, Check, Feather, Moon, Sun } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { AttendanceFlow } from "@/components/landing/AttendanceFlow";
import { BeforeAfter } from "@/components/landing/BeforeAfter";
import { DayTimeline } from "@/components/landing/DayTimeline";
import { Faq } from "@/components/landing/Faq";
import { FeatureBento } from "@/components/landing/FeatureBento";
import { LineReveal } from "@/components/landing/LineReveal";
import { Marquee } from "@/components/landing/Marquee";
import { SetupSteps } from "@/components/landing/SetupSteps";
import { TeamBoard } from "@/components/landing/TeamBoard";
import { Typewriter } from "@/components/landing/Typewriter";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

const NAV = [
    ["How it works", "#how"],
    ["Features", "#features"],
    ["FAQ", "#faq"],
] as const;

// ─── nav ────────────────────────────────────────────────────────────────────

/** Transparent over the photo, then a frosted bar with a reading-progress line once the page scrolls. */
const Nav = () => {
    const { theme, setTheme } = useTheme();
    const isDark = theme === "dark";
    const { scrollY, scrollYProgress } = useScroll();
    const [solid, setSolid] = useState(false);
    useMotionValueEvent(scrollY, "change", (y) => setSolid(y > 48));

    return (
        <header
            className={cn(
                "fixed inset-x-0 top-0 z-40 transition-[background-color,box-shadow,color] duration-300",
                solid ? "bg-background/85 text-foreground shadow-[0_1px_0_var(--border)] backdrop-blur-md" : "bg-transparent text-white"
            )}
        >
            <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-5 sm:px-8">
                <Link to="/" className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
                    <Feather className={cn("h-5 w-5 transition-colors", solid ? "text-primary" : "text-(--hero-accent)")} />
                    Workzen
                </Link>
                <nav className="flex items-center gap-1 sm:gap-2">
                    {NAV.map(([label, href]) => (
                        <a
                            key={href}
                            href={href}
                            className={cn(
                                "hidden rounded-sm px-3 py-2 text-sm transition-colors md:block",
                                solid ? "text-muted-foreground hover:text-foreground" : "text-white/80 hover:text-white"
                            )}
                        >
                            {label}
                        </a>
                    ))}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setTheme(isDark ? "light" : "dark")}
                        aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
                        className={cn(!solid && "text-white hover:bg-white/10 hover:text-white")}
                    >
                        {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
                    </Button>
                    <Button variant="ghost" asChild className={cn("hidden sm:inline-flex", !solid && "text-white hover:bg-white/10 hover:text-white")}>
                        <Link to="/login">Sign in</Link>
                    </Button>
                    <Button asChild className={cn(!solid && "bg-(--hero-cta) text-(--hero-cta-foreground) hover:bg-(--hero-cta)/90")}>
                        <Link to="/login?tab=signup">Get started</Link>
                    </Button>
                </nav>
            </div>
            {/* How far down the page you are. */}
            <motion.div
                aria-hidden
                style={{ scaleX: scrollYProgress }}
                className={cn("absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary transition-opacity", solid ? "opacity-100" : "opacity-0")}
            />
        </header>
    );
};

// ─── hero ───────────────────────────────────────────────────────────────────

const SUBCOPY =
    "Your team plans the day as a short list of tasks. Finish the list and Workzen marks you present. Projects, teams and simple reports come with it, sized for a business of five or fifty.";

const words: Variants = { show: { transition: { staggerChildren: 0.018 } } };
const word: Variants = {
    hidden: { opacity: 0, filter: "blur(6px)" },
    show: { opacity: 1, filter: "blur(0px)", transition: { duration: 0.4 } },
};

/** Two small product moments floating over the photo, each at its own depth. */
const HeroMoments = ({ show }: { show: boolean }) => {
    const reduce = useReducedMotion();
    const { scrollY } = useScroll();
    const nearY = useTransform(scrollY, [0, 800], [0, reduce ? 0 : -160]);
    const farY = useTransform(scrollY, [0, 800], [0, reduce ? 0 : -70]);
    const card = "rounded-2xl border border-white/15 bg-white/10 p-4 text-white shadow-[0_24px_48px_-24px_rgb(0_0_0/0.6)] backdrop-blur-md";

    return (
        <div aria-hidden className="pointer-events-none absolute bottom-28 right-8 hidden w-[300px] lg:block xl:right-[max(2rem,calc((100vw-1180px)/2+2rem))]">
            <motion.div style={{ y: farY }}>
                <motion.div
                    initial={{ opacity: 0, transform: "translateY(16px) scale(0.96)" }}
                    animate={show ? { opacity: 1, transform: "translateY(0px) scale(1)" } : {}}
                    transition={{ duration: 0.7, ease: EASE, delay: 0.5 }}
                    className={cn(card, "ml-10")}
                >
                    <div className="flex items-baseline justify-between text-sm">
                        <span>Shop refit</span>
                        <span className="tabular text-white/70">6 of 9 done</span>
                    </div>
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/15">
                        <motion.div
                            initial={{ width: "20%" }}
                            animate={show ? { width: "67%" } : {}}
                            transition={{ duration: 1.2, ease: EASE, delay: 0.9 }}
                            className="h-full rounded-full bg-(--hero-accent)"
                        />
                    </div>
                </motion.div>
            </motion.div>
            <motion.div style={{ y: nearY }} className="mt-4">
                <motion.div
                    initial={{ opacity: 0, transform: "translateY(16px) scale(0.96)" }}
                    animate={show ? { opacity: 1, transform: "translateY(0px) scale(1)" } : {}}
                    transition={{ duration: 0.7, ease: EASE, delay: 0.75 }}
                    className={cn(card, "flex items-center gap-3")}
                >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold">SK</span>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">Sam's list is done</p>
                        <p className="text-xs text-white/65">4 of 4 tasks</p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-sage px-2.5 py-1 text-xs font-medium text-sage-foreground">
                        <Check className="h-3 w-3" />
                        Present
                    </span>
                </motion.div>
            </motion.div>
        </div>
    );
};

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
    const ready = typed || !!reduce;

    return (
        <section ref={ref} className="relative isolate flex min-h-[100svh] items-end overflow-hidden bg-[rgb(var(--hero-shade))]">
            <motion.div className="absolute inset-0 -z-10 will-change-transform" style={{ y: imageY, scale: imageScale }}>
                <img
                    src="/images/hero-team-earth-1280.webp"
                    srcSet="/images/hero-team-earth-1280.webp 1280w, /images/hero-team-earth-2400.webp 2400w"
                    sizes="100vw"
                    alt=""
                    className="h-full w-full object-cover object-[24%_center] sm:object-[60%_center]"
                    fetchPriority="high"
                />
            </motion.div>
            {/* Theme-tinted shade so white type reads on any part of the photo. */}
            {/* Phones: shade rises from the bottom, where the copy sits. Wider: from the left. */}
            <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(var(--hero-shade)/0.25)_0%,rgb(var(--hero-shade)/0.72)_45%,rgb(var(--hero-shade)/0.94)_100%)] sm:bg-[linear-gradient(100deg,rgb(var(--hero-shade)/0.92)_0%,rgb(var(--hero-shade)/0.78)_38%,rgb(var(--hero-shade)/0.35)_68%,rgb(var(--hero-shade)/0.12)_100%)]" />
            <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-[rgb(var(--hero-shade)/0.55)] to-transparent" />

            <motion.div style={{ y: copyY, opacity: copyOpacity }} className="mx-auto w-full max-w-[1180px] px-5 pb-20 pt-36 sm:px-8 sm:pb-28">
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, ease: EASE }}
                    className="mb-5 text-[15px] text-(--hero-accent)"
                >
                    For startups and small teams who'd rather work than clock in
                </motion.p>
                <Typewriter
                    as="h1"
                    text="Attendance that takes care of itself."
                    className="block max-w-[15ch] text-[46px] font-semibold leading-[1.04] tracking-[-0.035em] text-white sm:text-[72px]"
                    speed={48}
                    startDelay={300}
                    onDone={() => setTyped(true)}
                />
                {/* The paragraph resolves word by word once the headline has typed. */}
                <motion.p
                    variants={words}
                    initial="hidden"
                    animate={ready ? "show" : "hidden"}
                    className="mt-6 max-w-[52ch] text-lg leading-relaxed text-white/80"
                    aria-label={SUBCOPY}
                >
                    {SUBCOPY.split(" ").map((w, i) => (
                        <motion.span key={i} variants={word} className="inline-block" aria-hidden>
                            {w}&nbsp;
                        </motion.span>
                    ))}
                </motion.p>
                <motion.div
                    initial={{ opacity: 0, transform: "translateY(10px)" }}
                    animate={ready ? { opacity: 1, transform: "translateY(0px)" } : {}}
                    transition={{ duration: 0.6, ease: EASE, delay: 0.35 }}
                >
                    <div className="mt-9 flex flex-wrap gap-3">
                        <Button size="lg" asChild className="bg-(--hero-cta) text-(--hero-cta-foreground) hover:bg-(--hero-cta)/90">
                            <Link to="/login?tab=signup">Create your workspace</Link>
                        </Button>
                        <Button size="lg" variant="ghost" asChild className="text-white ring-1 ring-white/30 hover:bg-white/10 hover:text-white">
                            <a href="#how">See how it works</a>
                        </Button>
                    </div>
                    <p className="mt-5 text-sm text-white/60">Runs in the browser on phones and laptops. Nothing to install.</p>
                </motion.div>
            </motion.div>

            <HeroMoments show={ready} />

            <motion.a
                href="#why"
                aria-label="Scroll to the next section"
                initial={{ opacity: 0 }}
                animate={{ opacity: ready ? 1 : 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
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

// ─── how it works ───────────────────────────────────────────────────────────

const HowItWorks = () => (
    <section id="how" className="scroll-mt-16">
        <div className="mx-auto max-w-[1180px] px-5 py-24 sm:px-8 sm:py-32">
            <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
                <LineReveal
                    lines={["Finish your list.", "That's your attendance."]}
                    className="text-[38px] leading-[1.06] tracking-[-0.03em] sm:text-[56px]"
                />
                <motion.p
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ duration: 0.6, delay: 0.25 }}
                    className="max-w-[44ch] text-lg leading-relaxed text-muted-foreground lg:pt-3"
                >
                    Each morning your team writes down what they'll get done today. As the tasks get ticked off, Workzen works
                    out who was in. Try it: tick off Priya's day below.
                </motion.p>
            </div>
            <div className="mt-14">
                <AttendanceFlow />
            </div>
        </div>
    </section>
);

// ─── closing band & footer ──────────────────────────────────────────────────

const Closing = () => {
    const ref = useRef<HTMLDivElement>(null);
    const reduce = useReducedMotion();
    const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
    const featherY = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : -40, reduce ? 0 : 60]);
    const featherRotate = useTransform(scrollYProgress, [0, 1], [reduce ? -12 : -24, reduce ? -12 : 6]);

    return (
        <section className="mx-auto max-w-[1180px] px-5 pb-24 sm:px-8">
            <div ref={ref} className="relative overflow-hidden rounded-[28px] bg-sidebar px-8 py-16 sm:px-14 sm:py-20">
                {/* A large feather drifting with the scroll; decoration only. */}
                <motion.div
                    aria-hidden
                    style={{ y: featherY, rotate: featherRotate }}
                    className="pointer-events-none absolute -right-10 -top-10 text-white/[0.06] sm:right-6"
                >
                    <Feather className="h-72 w-72" strokeWidth={1.25} />
                </motion.div>
                <div className="relative max-w-xl">
                    <Typewriter
                        as="h2"
                        text="Set up your team this afternoon."
                        className="block text-3xl font-semibold tracking-tight text-white sm:text-[40px] sm:leading-[1.15]"
                        speed={38}
                    />
                    <motion.p
                        initial={{ opacity: 0, transform: "translateY(10px)" }}
                        whileInView={{ opacity: 1, transform: "translateY(0px)" }}
                        viewport={{ once: true, amount: 0.6 }}
                        transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
                        className="mt-4 text-lg text-sidebar-foreground/80"
                    >
                        Create a workspace, add your people, and tomorrow's attendance takes care of itself.
                    </motion.p>
                    <motion.div
                        initial={{ opacity: 0, transform: "translateY(10px)" }}
                        whileInView={{ opacity: 1, transform: "translateY(0px)" }}
                        viewport={{ once: true, amount: 0.6 }}
                        transition={{ duration: 0.6, ease: EASE, delay: 0.35 }}
                        className="mt-8 flex flex-wrap gap-3"
                    >
                        <Button size="lg" asChild className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90">
                            <Link to="/login?tab=signup">Create your workspace</Link>
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

const FOOTER_LINKS = [
    {
        title: "Product",
        links: [
            { label: "How it works", href: "#how" },
            { label: "Features", href: "#features" },
            { label: "Questions", href: "#faq" },
        ],
    },
    {
        title: "Get started",
        links: [
            { label: "Create a workspace", to: "/login?tab=signup" },
            { label: "Sign in", to: "/login" },
            { label: "Reset your password", to: "/forgot-password" },
            { label: "GitHub", href: "https://github.com/Thebeast01" },
        ],
    },
] as const;

const Footer = () => {
    const ref = useRef<HTMLElement>(null);
    const reduce = useReducedMotion();
    const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
    // The wordmark rises out of the floor as the footer comes into view.
    const markY = useTransform(scrollYProgress, [0, 1], [reduce ? "0%" : "45%", "0%"]);

    return (
        <footer ref={ref} className="overflow-hidden border-t border-border/70 bg-card">
            <div className="mx-auto grid max-w-[1180px] gap-10 px-5 py-14 sm:grid-cols-2 sm:px-8 lg:grid-cols-[1.4fr_1fr_1fr]">
                <div>
                    <Link to="/" className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
                        <Feather className="h-5 w-5 text-primary" />
                        Workzen
                    </Link>
                    <p className="mt-3 max-w-[34ch] text-sm leading-relaxed text-muted-foreground">
                        Tasks, teams and attendance for startups and small businesses, worked out from the work itself.
                    </p>
                </div>
                {FOOTER_LINKS.map((col) => (
                    <div key={col.title}>
                        <h3 className="text-sm font-semibold">{col.title}</h3>
                        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                            {col.links.map((l) => (
                                <li key={l.label}>
                                    {"to" in l ? (
                                        <Link to={l.to} className="hover:text-foreground">
                                            {l.label}
                                        </Link>
                                    ) : (
                                        <a
                                            href={l.href}
                                            className="hover:text-foreground"
                                            {...(l.href.startsWith("http") && { target: "_blank", rel: "noreferrer" })}
                                        >
                                            {l.label}
                                        </a>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
            <div aria-hidden className="mx-auto max-w-[1180px] select-none px-5 sm:px-8">
                <motion.p
                    style={{ y: markY }}
                    className="text-center text-[22vw] font-semibold leading-[0.8] tracking-[-0.06em] text-foreground/[0.07] lg:text-[250px]"
                >
                    Workzen
                </motion.p>
            </div>
            <div className="relative border-t border-border/70 bg-card">
                <div className="mx-auto flex max-w-[1180px] flex-col gap-2 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
                    <span>© {new Date().getFullYear()} Workzen</span>
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
};

// ─── page ───────────────────────────────────────────────────────────────────

const Landing = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    // A signed-in visitor goes straight back into the app.
    useEffect(() => {
        if (!user) return;
        navigate(user.role === "admin" ? "/dashboard" : "/home", { replace: true });
    }, [user, navigate]);

    return (
        // overflow-x: clip (not hidden) so side-entering panels can't widen the page
        // and the pinned sections can still stick.
        <div className="landing-theme min-h-screen overflow-x-clip bg-background text-foreground">
            <Nav />
            <main>
                <Hero />
                <Marquee />
                <BeforeAfter />
                <HowItWorks />
                <DayTimeline />
                <TeamBoard />
                <FeatureBento />
                <SetupSteps />
                <Faq />
                <Closing />
            </main>
            <Footer />
        </div>
    );
};

export default Landing;
