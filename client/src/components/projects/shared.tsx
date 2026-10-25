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

const projectStatusStyles: Record<ProjectStatus, string> = {
  planning: "border-border text-muted-foreground",
  active: "border-primary text-primary",
  on_hold: "border-amber-500 text-amber-600 dark:text-amber-400",
  completed: "border-emerald-600 text-emerald-600 dark:text-emerald-400",
  archived: "border-border text-muted-foreground line-through",
};

export const ProjectStatusBadge = ({ status }: { status: ProjectStatus }) => (
  <Badge variant="outline" className={cn("uppercase tracking-wide text-[10px]", projectStatusStyles[status])}>
    {projectStatusLabels[status]}
  </Badge>
);

const attendanceStyles: Record<AttendanceStatus, string> = {
  present: "bg-emerald-500",
  partial: "bg-amber-500",
  absent: "bg-muted-foreground/40",
};

/** A small square + label for today's derived attendance. */
export const AttendanceDot = ({ status, showLabel = false }: { status: AttendanceStatus; showLabel?: boolean }) => (
  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title={`Today: ${status}`}>
    <span className={cn("h-2 w-2 inline-block", attendanceStyles[status])} />
    {showLabel && <span className="capitalize">{status}</span>}
  </span>
);

export const RoleBadge = ({ role }: { role: ScopeRole | ScopeAccess }) => {
  if (role === "lead") return <Badge className="text-[10px] uppercase">Lead</Badge>;
  if (role === "admin") return <Badge variant="secondary" className="text-[10px] uppercase">Admin</Badge>;
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
      "inline-flex h-8 w-8 shrink-0 items-center justify-center border border-border bg-muted text-[11px] font-medium",
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
        <PersonAvatar key={p.id} person={p} className="h-7 w-7 bg-background" />
      ))}
      {people.length > max && (
        <span className="inline-flex h-7 w-7 items-center justify-center border border-border bg-background text-[10px]">
          +{people.length - max}
        </span>
      )}
    </span>
  );
};

/** A thin progress meter with the percentage beside it. */
export const ProgressMeter = ({ value, className }: { value: number; className?: string }) => (
  <div className={cn("flex items-center gap-3", className)}>
    <div className="h-1.5 flex-1 bg-muted overflow-hidden">
      <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
    <span className="text-xs tabular-nums text-muted-foreground w-9 text-right">{value}%</span>
  </div>
);

export const ColorSwatch = ({ color, className }: { color: string | null; className?: string }) => (
  <span
    className={cn("inline-block h-3 w-3 shrink-0 border border-border", className)}
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
        className={cn("h-7 w-7 border-2", value === c ? "border-foreground" : "border-transparent")}
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


export const EmptyState = ({ title, body, action }: { title: string; body: string; action?: ReactNode }) => (
  <div className="border border-dashed border-border bg-background py-16 px-6 text-center">
    <FolderKanban className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
    <h3 className="text-lg mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">{body}</p>
    {action}
  </div>
);
