import { COLOR_CHOICES } from "@/lib/projectMeta";

/** Mirrors the API (backend/src/validation/tags.ts). */
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 24;
export const MAX_DESCRIPTION_LENGTH = 5000;

/** "  #Front   end " → "Front end"; "" when nothing is left. */
export const normalizeTag = (raw: string) => raw.trim().replace(/^#/, "").replace(/\s+/g, " ").trim();

/** Add a tag unless it's empty, too long, already there (any case) or the list is full. */
export function addTag(tags: string[], raw: string): string[] {
  const tag = normalizeTag(raw).slice(0, MAX_TAG_LENGTH);
  if (!tag || tags.length >= MAX_TAGS || tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return tags;
  return [...tags, tag];
}

/** A stable colour for a tag's dot, from the project palette (same tag, same colour, everywhere). */
export function tagColor(tag: string): string {
  let h = 0;
  for (const ch of tag.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return COLOR_CHOICES[Math.abs(h) % COLOR_CHOICES.length]!;
}

/** Tags already used on these tasks, most used first: the suggestions while typing. */
export function usedTags(tasks: { tags?: string[] }[]): string[] {
  const counts = new Map<string, { tag: string; n: number }>();
  for (const t of tasks)
    for (const tag of t.tags ?? []) {
      const key = tag.toLowerCase();
      const hit = counts.get(key);
      if (hit) hit.n++;
      else counts.set(key, { tag, n: 1 });
    }
  return [...counts.values()].sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag)).map((c) => c.tag);
}
