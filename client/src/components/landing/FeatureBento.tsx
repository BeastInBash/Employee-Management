import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { Clock, Mail, ShieldCheck } from "lucide-react";
import { GoogleMark } from "@/components/auth/GoogleSignInButton";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { LineReveal } from "./LineReveal";

const grid: Variants = { show: { transition: { staggerChildren: 0.07 } } };
const cell: Variants = {
  hidden: { opacity: 0, transform: "translateY(16px)" },
  show: { opacity: 1, transform: "translateY(0px)", transition: { duration: 0.55, ease: EASE } },
};
const once = { initial: "hidden", whileInView: "show", viewport: { once: true, amount: 0.5 } } as const;

const Cell = ({ title, body, children, className }: { title: string; body: string; children?: ReactNode; className?: string }) => (
  <motion.article variants={cell} className={cn("flex flex-col rounded-[28px] border border-border/80 bg-card p-6 sm:p-7", className)}>
    {children && <div className="mb-6 flex flex-1 items-center">{children}</div>}
    <h3 className="text-lg">{title}</h3>
    <p className="mt-1.5 max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground">{body}</p>
  </motion.article>
);

// ─── illustrations ──────────────────────────────────────────────────────────

const Avatar = ({ text, className }: { text: string; className?: string }) => (
  <span className={cn("flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ring-2 ring-card", className)}>{text}</span>
);

const ProjectArt = () => (
  <motion.div {...once} className="w-full rounded-2xl bg-surface p-4">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-primary" />
        <span className="text-sm font-medium">Shop refit</span>
      </div>
      <span className="rounded-full bg-honey-soft px-2.5 py-0.5 text-xs font-medium text-honey">Active</span>
    </div>
    <div className="mt-4 flex items-center justify-between gap-3">
      <div className="flex -space-x-2">
        {["AR", "SK", "LO", "TR"].map((a, i) => (
          <motion.span
            key={a}
            variants={{ hidden: { opacity: 0, transform: "translateX(-6px)" }, show: { opacity: 1, transform: "translateX(0px)", transition: { delay: 0.2 + i * 0.08 } } }}
          >
            <Avatar text={a} className={i === 0 ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"} />
          </motion.span>
        ))}
      </div>
      <span className="text-xs text-muted-foreground">Ana leads it</span>
    </div>
    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
      <motion.div
        variants={{ hidden: { width: "0%" }, show: { width: "58%", transition: { duration: 1, ease: EASE, delay: 0.4 } } }}
        className="h-full rounded-full bg-honey"
      />
    </div>
  </motion.div>
);

const BARS = [62, 80, 54, 90, 72, 86, 94];
const ReportArt = () => (
  <motion.div {...once} className="flex h-36 w-full items-end gap-2 rounded-2xl bg-surface px-4 pb-4 pt-6">
    {BARS.map((h, i) => (
      <motion.span
        key={i}
        variants={{ hidden: { transform: "scaleY(0)" }, show: { transform: "scaleY(1)", transition: { duration: 0.6, ease: EASE, delay: 0.15 + i * 0.06 } } }}
        style={{ height: `${h}%`, transformOrigin: "50% 100%" }}
        className="flex-1 rounded-t-[4px] bg-[var(--viz-present)]"
      />
    ))}
  </motion.div>
);

const TeamArt = () => (
  <motion.div {...once} className="flex flex-wrap gap-2">
    {["Kitchen", "Front of house", "Deliveries"].map((t, i) => (
      <motion.span
        key={t}
        variants={{ hidden: { opacity: 0, transform: "scale(0.9)" }, show: { opacity: 1, transform: "scale(1)", transition: { type: "spring", bounce: 0.3, delay: 0.15 + i * 0.1 } } }}
        className="rounded-full bg-secondary px-3 py-1.5 text-sm text-secondary-foreground"
      >
        {t}
      </motion.span>
    ))}
  </motion.div>
);

const HoursArt = () => (
  <motion.span
    {...once}
    variants={{ hidden: { opacity: 0, transform: "translateY(6px)" }, show: { opacity: 1, transform: "translateY(0px)", transition: { delay: 0.2 } } }}
    className="inline-flex items-center gap-2 rounded-full bg-secondary px-3.5 py-2 text-sm text-secondary-foreground"
  >
    <Clock className="h-4 w-4" />
    Open 9:00 to 11:00 AM
  </motion.span>
);

const GoogleArt = () => (
  <span className="inline-flex items-center gap-2.5 rounded-xl border border-border/80 bg-surface px-4 py-2.5 text-sm">
    <GoogleMark />
    Sign in with Google
  </span>
);

const AccessArt = () => (
  <motion.ul {...once} className="w-full space-y-2 text-sm">
    {[
      { who: "Admins", what: "everything in the organisation", w: "100%" },
      { who: "Leads", what: "the projects and teams they run", w: "66%" },
      { who: "Everyone", what: "their own work", w: "36%" },
    ].map((r, i) => (
      <motion.li
        key={r.who}
        variants={{ hidden: { opacity: 0, width: "20%" }, show: { opacity: 1, width: r.w, transition: { duration: 0.7, ease: EASE, delay: 0.15 + i * 0.1 } } }}
        className="flex min-w-fit items-center gap-2 rounded-xl bg-surface px-3 py-2"
      >
        <ShieldCheck className="h-4 w-4 shrink-0 text-sage" />
        <span className="font-medium">{r.who}</span>
        <span className="hidden truncate text-muted-foreground sm:inline">see {r.what}</span>
      </motion.li>
    ))}
  </motion.ul>
);

const EmailArt = () => (
  <motion.div
    {...once}
    variants={{ hidden: { opacity: 0, transform: "translateY(10px) rotate(-2deg)" }, show: { opacity: 1, transform: "translateY(0px) rotate(-1deg)", transition: { duration: 0.6, ease: EASE, delay: 0.15 } } }}
    className="w-full max-w-xs rounded-xl border border-border/80 bg-surface p-4 shadow-[0_10px_24px_-18px_var(--shadow-ink)]"
  >
    <div className="flex items-center gap-2 text-sm font-medium">
      <Mail className="h-4 w-4 text-primary" />
      You've been added to Workzen
    </div>
    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Your sign-in details are below. Confirm your email and you're ready for tomorrow's list.</p>
  </motion.div>
);

/** What comes with Workzen, as a bento of real features, each with a small live picture. */
export const FeatureBento = () => (
  <section id="features" className="scroll-mt-16">
    <div className="mx-auto max-w-[1180px] px-5 py-24 sm:px-8 sm:py-32">
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
        <LineReveal
          lines={["Everything a small team needs,", "and nothing it doesn't."]}
          className="text-[34px] leading-[1.08] tracking-[-0.03em] sm:text-[48px]"
        />
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="max-w-[44ch] text-lg leading-relaxed text-muted-foreground lg:pt-3"
        >
          Built for a shop floor of five or an office of fifty: the parts you'll use every day, without the ones you'd
          have to configure.
        </motion.p>
      </div>

      <motion.div variants={grid} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }} className="mt-14 grid gap-4 md:grid-cols-6">
        <Cell
          title="Projects with a lead"
          body="Give every project an owner who can assign work and keep it moving, without handing out admin rights."
          className="md:col-span-3 lg:col-span-4"
        >
          <ProjectArt />
        </Cell>
        <Cell
          title="Teams"
          body="Group people the way you already work, then bring a whole team onto a project in one step."
          className="md:col-span-3 lg:col-span-2"
        >
          <TeamArt />
        </Cell>
        <Cell
          title="Reports you can hand over"
          body="On-time rate, open work and attendance for any person, team or project, ready to export as CSV."
          className="md:col-span-3 lg:col-span-2"
        >
          <ReportArt />
        </Cell>
        <Cell
          title="Submission hours"
          body="Want plans in by eleven? Set the hours for a workspace, or leave it open so people add tasks whenever."
          className="md:col-span-3 lg:col-span-2"
        >
          <HoursArt />
        </Cell>
        <Cell
          title="Google sign-in"
          body="People sign in with the Google account they already use, with no new password to forget."
          className="md:col-span-3 lg:col-span-2"
        >
          <GoogleArt />
        </Cell>
        <Cell
          title="Sensible access"
          body="Everyone sees what they need to and nothing more, so you can add people without a long conversation about permissions."
          className="md:col-span-3 lg:col-span-3"
        >
          <AccessArt />
        </Cell>
        <Cell
          title="Onboarding by email"
          body="Add someone and they get an email with their sign-in details and a link to confirm their address."
          className="md:col-span-6 lg:col-span-3"
        >
          <EmailArt />
        </Cell>
      </motion.div>
    </div>
  </section>
);
