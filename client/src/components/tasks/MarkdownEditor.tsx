import { useRef, useState } from "react";
import { Bold, Code, Italic, Link2, List, ListChecks, ListOrdered } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MAX_DESCRIPTION_LENGTH } from "@/lib/tags";
import { MarkdownView } from "./MarkdownView";

type Format = { label: string; icon: typeof Bold; wrap?: [string, string]; line?: string };

const FORMATS: Format[] = [
  { label: "Bold", icon: Bold, wrap: ["**", "**"] },
  { label: "Italic", icon: Italic, wrap: ["_", "_"] },
  { label: "Code", icon: Code, wrap: ["`", "`"] },
  { label: "Link", icon: Link2, wrap: ["[", "](https://)"] },
  { label: "Bulleted list", icon: List, line: "- " },
  { label: "Numbered list", icon: ListOrdered, line: "1. " },
  { label: "Checklist", icon: ListChecks, line: "- [ ] " },
];

/**
 * A description field that takes Markdown: a toolbar for the common bits,
 * Ctrl/⌘+B and +I shortcuts, and a Preview tab that shows it as it will look.
 */
export const MarkdownEditor = ({
  id,
  value,
  onChange,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) => {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const ref = useRef<HTMLTextAreaElement>(null);

  /** Apply a format to the selection (or the current line), then restore the caret. */
  const apply = (f: Format) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    let next: string;
    let caret: [number, number];
    if (f.wrap) {
      const [open, close] = f.wrap;
      const picked = value.slice(start, end) || (f.label === "Link" ? "link text" : "text");
      next = value.slice(0, start) + open + picked + close + value.slice(end);
      caret = [start + open.length, start + open.length + picked.length];
    } else {
      // Prefix every line the selection touches.
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const block = value.slice(lineStart, end);
      const prefixed = block
        .split("\n")
        .map((l, i) => (f.line === "1. " ? `${i + 1}. ` : f.line) + l)
        .join("\n");
      next = value.slice(0, lineStart) + prefixed + value.slice(end);
      caret = [lineStart + prefixed.length, lineStart + prefixed.length];
    }
    onChange(next.slice(0, MAX_DESCRIPTION_LENGTH));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(...caret);
    });
  };

  return (
    <div className="overflow-hidden rounded-md border border-input shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
      <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-surface/60 px-1.5 py-1">
        <div role="tablist" aria-label="Description" className="flex gap-0.5">
          {(["write", "preview"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-sm px-2 py-1 text-xs font-medium transition-colors",
                tab === t ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "write" ? "Write" : "Preview"}
            </button>
          ))}
        </div>
        {tab === "write" && (
          <div className="flex items-center" role="toolbar" aria-label="Formatting">
            {FORMATS.map((f) => (
              <button
                key={f.label}
                type="button"
                title={f.label}
                aria-label={f.label}
                onClick={() => apply(f)}
                className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <f.icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        )}
      </div>
      {tab === "write" ? (
        <Textarea
          ref={ref}
          id={id}
          rows={5}
          value={value}
          maxLength={MAX_DESCRIPTION_LENGTH}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (!(e.metaKey || e.ctrlKey)) return;
            const f = e.key === "b" ? FORMATS[0] : e.key === "i" ? FORMATS[1] : undefined;
            if (f) {
              e.preventDefault();
              apply(f);
            }
          }}
          placeholder={placeholder}
          className="min-h-28 rounded-none border-0 shadow-none focus-visible:ring-0"
        />
      ) : (
        <div className="min-h-28 px-3 py-2">
          {value.trim() ? (
            <MarkdownView text={value} />
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
          )}
        </div>
      )}
      <p className="border-t border-border/70 px-3 py-1.5 text-[11px] text-muted-foreground">
        Markdown works: **bold**, _italic_, lists, - [ ] checklists, `code`, [links](https://…)
      </p>
    </div>
  );
};
