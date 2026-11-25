import { useId, useMemo, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_TAGS, MAX_TAG_LENGTH, addTag, normalizeTag, tagColor } from "@/lib/tags";

/**
 * Type a tag and press Enter or comma (or paste "a, b, c"); Backspace on an
 * empty field removes the last one. Tags already used elsewhere are suggested
 * as you type: click one, or pick it with ↑/↓ and Enter. Enter on its own
 * adds exactly what was typed, never a suggestion it happens to match.
 */
export const TagInput = ({
  id,
  value,
  onChange,
  suggestions = [],
}: {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
}) => {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  // -1 = no suggestion picked (Enter adds the typed text).
  const [highlight, setHighlight] = useState(-1);
  const listId = useId();
  const full = value.length >= MAX_TAGS;

  const matches = useMemo(() => {
    const q = normalizeTag(draft).toLowerCase();
    const taken = new Set(value.map((t) => t.toLowerCase()));
    return suggestions.filter((s) => !taken.has(s.toLowerCase()) && (!q || s.toLowerCase().includes(q))).slice(0, 6);
  }, [draft, suggestions, value]);
  const open = focused && !full && matches.length > 0;

  const commit = (raw: string) => {
    let next = value;
    for (const part of raw.split(",")) next = addTag(next, part);
    if (next !== value) onChange(next);
    setDraft("");
    setHighlight(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && open) {
      e.preventDefault();
      setHighlight((h) => (h + 1) % matches.length);
    } else if (e.key === "ArrowUp" && open) {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? matches.length - 1 : h - 1));
    } else if (e.key === "Enter" || e.key === ",") {
      const picked = open && highlight >= 0 ? matches[highlight] : undefined;
      if (!picked && !draft.trim()) return; // nothing to add: let Enter submit the form
      e.preventDefault(); // add the tag instead of submitting
      commit(picked ?? draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    } else if (e.key === "Escape" && open) {
      e.stopPropagation(); // close the suggestions, not the dialog
      setFocused(false);
    }
  };

  return (
    <div className="relative">
      <div
        className={cn(
          "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-xs transition-[color,box-shadow]",
          focused && "border-ring ring-[3px] ring-ring/50",
        )}
        onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-surface py-0.5 pl-2 pr-1 text-xs ring-1 ring-border"
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tagColor(tag) }} />
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            if (v.includes(",")) commit(v);
            else {
              setDraft(v.slice(0, MAX_TAG_LENGTH + 1));
              setHighlight(-1);
            }
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (draft.trim()) commit(draft);
          }}
          disabled={full}
          placeholder={full ? `Up to ${MAX_TAGS} tags` : value.length ? "Add another" : "e.g. frontend, bug, client-x"}
          className="min-w-24 flex-1 bg-transparent py-0.5 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          {...(open && highlight >= 0 && { "aria-activedescendant": `${listId}-${highlight}` })}
        />
      </div>
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover p-1 text-sm shadow-[0_8px_24px_-8px_rgb(78_34_15/0.25)]"
        >
          {matches.map((tag, i) => (
            <li
              key={tag}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === highlight}
              // mousedown, so the input's blur doesn't close the list first
              onMouseDown={(e) => {
                e.preventDefault();
                commit(tag);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5",
                i === highlight && "bg-accent",
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tagColor(tag) }} />
              {tag}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
