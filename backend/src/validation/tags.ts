import { z } from "zod";

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 24;
/** Markdown descriptions can grow; keep them to a sensible size. */
export const MAX_DESCRIPTION_LENGTH = 5000;

/**
 * Task tags: trimmed, inner spaces collapsed, a leading "#" dropped, empty ones
 * skipped and duplicates removed ignoring case (the first spelling wins).
 */
export const tagsSchema = z
    // Raw input is only bounded loosely; the real limits apply after normalising.
    .array(z.string().max(100))
    .transform((tags) => {
        const seen = new Set<string>();
        const out: string[] = [];
        for (const raw of tags) {
            const tag = raw.trim().replace(/^#/, "").replace(/\s+/g, " ").trim();
            if (!tag || seen.has(tag.toLowerCase())) continue;
            seen.add(tag.toLowerCase());
            out.push(tag);
        }
        return out;
    })
    .refine((tags) => tags.every((t) => t.length <= MAX_TAG_LENGTH), {
        message: `Tags can be at most ${MAX_TAG_LENGTH} characters`,
    })
    .refine((tags) => tags.length <= MAX_TAGS, { message: `A task can have at most ${MAX_TAGS} tags` });
