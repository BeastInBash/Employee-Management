import { PrismaClient, ScopeRole } from "@prisma/client";
import { sendScopeNotices, type ScopeNotice } from "./email";

const prisma = new PrismaClient();

/** The parts of a seat a notice needs (matches `memberSummarySelect`). */
export interface SeatForNotice {
    role: ScopeRole;
    member: { userId: string; email: string; user: { name: string } };
}

/**
 * Email everyone given a seat on a team or project (or promoted to lead).
 * Skips the person who made the change. Awaited by callers so serverless
 * runtimes don't cut the sends short, but never throws.
 */
export async function notifySeats(params: {
    actorUserId: string;
    kind: "team" | "project";
    scopeId: string;
    scopeName: string;
    seats: SeatForNotice[];
    event: ScopeNotice["event"];
}): Promise<void> {
    const recipients = params.seats.filter((s) => s.member.userId !== params.actorUserId);
    if (recipients.length === 0) return;
    try {
        const actor = await prisma.user.findUnique({ where: { id: params.actorUserId }, select: { name: true } });
        await sendScopeNotices(
            recipients.map((s) => ({
                to: s.member.email,
                name: s.member.user.name,
                kind: params.kind,
                scopeName: params.scopeName,
                role: s.role === ScopeRole.lead ? "lead" : "member",
                event: params.event,
                byName: actor?.name ?? "Your admin",
                path: `/${params.kind === "team" ? "teams" : "projects"}/${params.scopeId}`,
            })),
        );
    } catch (error) {
        console.error("[notify] Failed to send seat notices:", error);
    }
}
