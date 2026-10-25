import { Resend } from "resend";

// Transactional email through Resend. Every send is best-effort: failures are
// logged and reported as `false`, never thrown, so an email outage can't break
// the request that triggered it (callers that must know, like password reset,
// check the return value).

const BRAND = "WorkZen";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/** "WorkZen <no-reply@…>" — EMAIL_FROM may be a bare address or already carry a name. */
const FROM = (() => {
    const from = (process.env.EMAIL_FROM ?? "no-reply@workzen.besaif.in").trim();
    return from.includes("<") ? from : `${BRAND} <${from}>`;
})();

// Base URL of the client app, used to build links inside emails.
const CLIENT_URL = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "");

export const clientUrl = (path: string) => `${CLIENT_URL}${path.startsWith("/") ? path : `/${path}`}`;

/** Names and titles come from users, so everything interpolated into HTML is escaped. */
function esc(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

interface EmailContent {
    /** Short line shown in inbox previews. */
    preview: string;
    heading: string;
    /** Paragraphs of plain text (escaped for HTML). */
    paragraphs: string[];
    button?: { label: string; url: string };
    /** Optional key/value block, e.g. login details. */
    details?: [string, string][];
    footnote?: string;
}

/**
 * One calm template for every email: off-white canvas, white card, forest-green
 * button — the same palette as the app. Inline styles only (email clients).
 */
function render({ preview, heading, paragraphs, button, details, footnote }: EmailContent): { html: string; text: string } {
    const green = "#2e5a43";
    const ink = "#1c2a21";
    const muted = "#5c6a5f";
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:#f3f5ee;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preview)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5ee;padding:40px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
    <tr><td style="padding:0 4px 20px;font-size:17px;font-weight:600;color:${ink};letter-spacing:-0.01em;">
      <span style="color:${green};">&#9679;</span>&nbsp;${BRAND}
    </td></tr>
    <tr><td style="background:#ffffff;border:1px solid #e1e5da;border-radius:16px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:600;color:${ink};letter-spacing:-0.02em;">${esc(heading)}</h1>
      ${paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${muted};">${esc(p)}</p>`).join("\n      ")}
      ${
          details
              ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;background:#f8f9f4;border-radius:12px;">
        ${details
            .map(
                ([k, v]) =>
                    `<tr><td style="padding:10px 16px;font-size:14px;color:${muted};width:110px;">${esc(k)}</td><td style="padding:10px 16px;font-size:14px;color:${ink};font-weight:600;">${esc(v)}</td></tr>`
            )
            .join("")}
      </table>`
              : ""
      }
      ${
          button
              ? `<a href="${esc(button.url)}" style="display:inline-block;margin-top:6px;background:${green};color:#f6f8f2;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:10px;">${esc(button.label)}</a>`
              : ""
      }
      ${footnote ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#8a948b;">${esc(footnote)}</p>` : ""}
    </td></tr>
    <tr><td style="padding:20px 4px 0;font-size:12px;color:#8a948b;">You're receiving this because of your ${BRAND} account.</td></tr>
  </table>
</td></tr></table>
</body></html>`;

    const text = [
        heading,
        "",
        ...paragraphs.flatMap((p) => [p, ""]),
        ...(details ? [...details.map(([k, v]) => `${k}: ${v}`), ""] : []),
        ...(button ? [`${button.label}: ${button.url}`, ""] : []),
        ...(footnote ? [footnote] : []),
    ].join("\n");

    return { html, text };
}

async function send(to: string, subject: string, content: EmailContent, replyTo?: string): Promise<boolean> {
    if (!resend) {
        console.warn(`[email] RESEND_API_KEY is not set; skipped "${subject}" to ${to}`);
        return false;
    }
    const { html, text } = render(content);
    try {
        const { error } = await resend.emails.send({
            from: FROM,
            to,
            subject,
            html,
            text,
            ...(replyTo && { replyTo }),
        });
        if (error) {
            console.error(`[email] Resend rejected "${subject}" to ${to}:`, error);
            return false;
        }
        return true;
    } catch (error) {
        console.error(`[email] Failed to send "${subject}" to ${to}:`, error);
        return false;
    }
}

// ─── account emails ─────────────────────────────────────────────────────────

/**
 * A new member's sign-in details. When a verification token is given, the
 * button both confirms the address and leads to sign-in, so new members get
 * one email instead of two.
 */
export function sendMemberCredentials(
    email: string,
    name: string,
    password: string,
    adminEmail: string,
    adminName?: string,
    verificationToken?: string
): Promise<boolean> {
    const inviter = adminName ?? "Your admin";
    return send(
        email,
        `${inviter} added you to ${BRAND}`,
        {
            preview: `Your ${BRAND} sign-in details are inside.`,
            heading: `Welcome to ${BRAND}, ${name.split(" ")[0]}`,
            paragraphs: [
                `${inviter} added you to their team on ${BRAND}, where you'll plan your day as tasks and track your work.`,
                "Sign in with the details below and choose a new password straight away. You can also sign in with Google using this email address.",
            ],
            details: [
                ["Email", email],
                ["Password", password],
            ],
            button: verificationToken
                ? { label: "Confirm email and sign in", url: clientUrl(`/verify-email?token=${verificationToken}&next=login`) }
                : { label: "Sign in", url: clientUrl("/login") },
            footnote: `Questions? Reply to this email to reach ${inviter}.`,
        },
        adminEmail
    );
}

export function sendVerificationEmail(email: string, name: string, token: string): Promise<boolean> {
    return send(email, `Confirm your email for ${BRAND}`, {
        preview: "One click to confirm this is your address.",
        heading: "Confirm your email address",
        paragraphs: [`Hi ${name.split(" ")[0]}, please confirm that this is your email address so we can keep your ${BRAND} account secure.`],
        button: { label: "Confirm email", url: clientUrl(`/verify-email?token=${token}`) },
        footnote: "This link works for 24 hours. If you didn't create an account, you can ignore this email.",
    });
}

export function sendPasswordResetEmail(email: string, name: string, resetToken: string, validForHours: number): Promise<boolean> {
    const duration = validForHours % 24 === 0 ? `${validForHours / 24} days` : `${validForHours} hours`;
    return send(email, `Reset your ${BRAND} password`, {
        preview: "Use this link to choose a new password.",
        heading: "Reset your password",
        paragraphs: [`Hi ${name.split(" ")[0]}, we got a request to reset the password for your ${BRAND} account.`],
        button: { label: "Choose a new password", url: clientUrl(`/reset-password?token=${resetToken}`) },
        footnote: `This link works for ${duration}. If you didn't ask for it, ignore this email and your password stays the same.`,
    });
}

// ─── team & project notifications ───────────────────────────────────────────

export interface ScopeNotice {
    to: string;
    name: string;
    kind: "team" | "project";
    scopeName: string;
    role: "lead" | "member";
    /** "added" = a new seat; "promoted" = an existing seat became lead. */
    event: "added" | "promoted";
    byName: string;
    /** Client path to open, e.g. /teams/<id>. */
    path: string;
}

export function sendScopeNotice(n: ScopeNotice): Promise<boolean> {
    const first = n.name.split(" ")[0];
    const isLead = n.role === "lead";
    const what = n.kind === "team" ? "team" : "project";

    const subject =
        n.event === "promoted"
            ? `You're now the lead of ${n.scopeName}`
            : isLead
              ? `${n.byName} made you lead of ${n.scopeName}`
              : `${n.byName} added you to ${n.scopeName}`;

    const heading = n.event === "promoted" || isLead ? `You're leading ${n.scopeName}` : `You've joined ${n.scopeName}`;

    const leadDuties =
        n.kind === "project"
            ? "As lead you can assign tasks to anyone on the project, add people, and keep its details up to date."
            : "As lead you can add people to the team and see everyone's tasks and attendance.";

    return send(n.to, subject, {
        preview: isLead ? `${n.byName} made you a ${what} lead.` : `${n.byName} added you to a ${what}.`,
        heading,
        paragraphs: [
            n.event === "promoted"
                ? `Hi ${first}, ${n.byName} made you the lead of the ${what} ${n.scopeName}.`
                : `Hi ${first}, ${n.byName} added you to the ${what} ${n.scopeName}${isLead ? " as its lead" : ""}.`,
            isLead ? leadDuties : n.kind === "project" ? "You'll see its tasks on your board and can add your own." : "You'll find your teammates and their projects on the team page.",
        ],
        button: { label: `Open ${what}`, url: clientUrl(n.path) },
    });
}

/** Sends many notices without letting one failure stop the rest. */
export async function sendScopeNotices(notices: ScopeNotice[]): Promise<void> {
    await Promise.allSettled(notices.map(sendScopeNotice));
}
