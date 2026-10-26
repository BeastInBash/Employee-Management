import { useState } from "react";
import type { ReactNode } from "react";
import { Check, ChevronsUpDown, FolderKanban, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { COLOR_CHOICES, projectStatusLabels } from "@/lib/projectMeta";
import type { AttendanceStatus, Person, ProjectStatus, ScopeAccess, ScopeRole } from "@/contexts/ProjectContext";

// ─── labels & colours ────────────────────────────────────────────────────────

const projectStatusStyles: Record<ProjectStatus, { pill: string; dot: string }> = {
  planning: { pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
  active: { pill: "bg-honey-soft text-honey", dot: "bg-honey" },
  on_hold: { pill: "bg-[#e3e8f1] text-[#3e5a86] dark:bg-[#1f2533] dark:text-[#a9bce0]", dot: "bg-[#5a80bd]" },
  completed: { pill: "bg-sage-soft text-sage", dot: "bg-sage" },
  archived: { pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/40" },
};

export const ProjectStatusBadge = ({ status }: { status: ProjectStatus }) => (
  <Badge className={cn("gap-1.5 font-medium", projectStatusStyles[status].pill)}>
    <span className={cn("h-1.5 w-1.5 rounded-full", projectStatusStyles[status].dot)} />
    {projectStatusLabels[status]}
  </Badge>
);

const attendanceStyles: Record<AttendanceStatus, string> = {
  present: "bg-[var(--viz-present)]",
  partial: "bg-[var(--viz-partial)]",
  absent: "bg-[var(--viz-absent)]/50",
};

/** A small dot + label for today's derived attendance. */
export const AttendanceDot = ({ status, showLabel = false }: { status: AttendanceStatus; showLabel?: boolean }) => (
  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground" title={`Today: ${status}`}>
    <span className={cn("h-2 w-2 rounded-full", attendanceStyles[status])} />
    {showLabel && <span className="capitalize">{status}</span>}
  </span>
);

export const RoleBadge = ({ role }: { role: ScopeRole | ScopeAccess }) => {
  if (role === "lead") return <Badge className="bg-primary/10 text-primary font-medium">Lead</Badge>;
  if (role === "admin") return <Badge className="bg-muted text-muted-foreground font-medium">Admin</Badge>;
  return null;
};

// ─── people ──────────────────────────────────────────────────────────────────

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

export const PersonAvatar = ({ person, className }: { person: Pick<Person, "name">; className?: string }) => (
  <span
    className={cn(
      "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground",
      className
    )}
    title={person.name}
  >
    {initials(person.name) || "?"}
  </span>
);

export const AvatarStack = ({ people, max = 4 }: { people: Person[]; max?: number }) => {
  if (people.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="flex -space-x-2">
      {people.slice(0, max).map((p) => (
        <PersonAvatar key={p.id} person={p} className="h-7 w-7 ring-2 ring-card" />
      ))}
      {people.length > max && (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-medium ring-2 ring-card">
          +{people.length - max}
        </span>
      )}
    </span>
  );
};

/** A thin progress meter with the percentage beside it. */
export const ProgressMeter = ({ value, className }: { value: number; className?: string }) => (
  <div className={cn("flex items-center gap-3", className)}>
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-honey transition-[width] duration-500 ease-[var(--ease-out)]"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
    <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{value}%</span>
  </div>
);

export const ColorSwatch = ({ color, className }: { color: string | null; className?: string }) => (
  <span
    className={cn("inline-block h-3 w-3 shrink-0 rounded-full", className)}
    style={{ backgroundColor: color ?? "var(--muted)" }}
  />
);

export const ColorPicker = ({ value, onChange }: { value: string | undefined; onChange: (c: string) => void }) => (
  <div className="flex flex-wrap gap-2">
    {COLOR_CHOICES.map((c) => (
      <button
        key={c}
        type="button"
        aria-label={`Color ${c}`}
        onClick={() => onChange(c)}
        aria-pressed={value === c}
        className={cn(
          "h-7 w-7 rounded-full ring-offset-2 ring-offset-card transition-shadow",
          value === c ? "ring-2 ring-foreground/70" : "hover:ring-2 hover:ring-border"
        )}
        style={{ backgroundColor: c }}
      />
    ))}
  </div>
);

// ─── picking people ─────────────────────────────────────────────────────────

/** Searchable multi-select of people. `exclude` hides ids that are already chosen elsewhere. */
export const PeoplePicker = ({
  people,
  value,
  onChange,
  placeholder = "Select people",
  exclude = [],
  single = false,
}: {
  people: Person[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  exclude?: string[];
  single?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const selected = people.filter((p) => value.includes(p.id));
  const options = people.filter((p) => !exclude.includes(p.id));

  const toggle = (id: string) => {
    if (single) {
      onChange(value[0] === id ? [] : [id]);
      setOpen(false);
      return;
    }
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
            <span className={cn("truncate", selected.length === 0 && "text-muted-foreground")}>
              {selected.length === 0
                ? placeholder
                : single
                  ? selected[0]!.name
                  : `${selected.length} selected`}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-(--radix-popover-trigger-width)" align="start">
          <Command>
            <CommandInput placeholder="Search by name or email…" />
            <CommandList>
              <CommandEmpty>No one found.</CommandEmpty>
              <CommandGroup>
                {options.map((p) => (
                  <CommandItem key={p.id} value={`${p.name} ${p.email}`} onSelect={() => toggle(p.id)}>
                    <Check className={cn("h-4 w-4", value.includes(p.id) ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{p.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground truncate">{p.jobTitle}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {!single && selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((p) => (
            <Badge key={p.id} variant="secondary" className="gap-1 pr-1">
              {p.name}
              <button type="button" aria-label={`Remove ${p.name}`} onClick={() => toggle(p.id)}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};


export const EmptyState = ({
  title,
  body,
  action,
  icon: Icon = FolderKanban,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: typeof FolderKanban;
}) => (
  <div className="rounded-xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
    <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-primary">
      <Icon className="h-5 w-5" />
    </span>
    <h3 className="mb-1.5 text-base">{title}</h3>
    <p className="mx-auto mb-5 max-w-sm text-sm text-muted-foreground">{body}</p>
    {action}
  </div>
);
