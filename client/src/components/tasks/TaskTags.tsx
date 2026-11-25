import { cn } from "@/lib/utils";
import { tagColor } from "@/lib/tags";

/** A task's tags as small neutral chips; the dot's colour is the tag's own. */
export const TaskTags = ({ tags, className }: { tags?: string[]; className?: string }) => {
  if (!tags?.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1", className)} aria-label="Tags">
      {tags.map((tag) => (
        <li
          key={tag}
          className="inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground ring-1 ring-border"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: tagColor(tag) }} />
          <span className="truncate">{tag}</span>
        </li>
      ))}
    </ul>
  );
};
