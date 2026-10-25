import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProjectInput, ProjectStatus, TeamSummary, WorkspacePerson } from "@/contexts/ProjectContext";
import { ColorPicker, ColorSwatch, PeoplePicker } from "./shared";
import { fromDateInput, projectStatusLabels, toDateInput } from "@/lib/projectMeta";

export type ProjectFormValues = {
  name: string;
  description: string;
  status: ProjectStatus;
  color: string | undefined;
  startDate: string | null;
  dueDate: string | null;
};

/** Create sends seats; edit can clear optional fields with `null`. */
export type ProjectFormSubmit = Omit<ProjectInput, "description" | "startDate" | "dueDate"> & {
  description?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
};

/**
 * Create a project (with optional leads/members/teams), or edit an existing
 * project's details when `initial` is passed — seats are managed on the
 * project page in edit mode.
 */
export const ProjectFormDialog = ({
  open,
  onOpenChange,
  initial,
  people = [],
  teams = [],
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ProjectFormValues;
  people?: WorkspacePerson[];
  teams?: TeamSummary[];
  onSubmit: (values: ProjectFormSubmit) => Promise<boolean>;
}) => {
  const isEdit = !!initial;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [color, setColor] = useState<string | undefined>();
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [leadIds, setLeadIds] = useState<string[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Reset whenever the dialog opens so a cancelled draft doesn't linger.
  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setStatus(initial?.status ?? "active");
    setColor(initial?.color);
    setStartDate(toDateInput(initial?.startDate));
    setDueDate(toDateInput(initial?.dueDate));
    setLeadIds([]);
    setMemberIds([]);
    setTeamIds([]);
  }, [open, initial]);

  const datesInvalid = !!startDate && !!dueDate && startDate > dueDate;
  const canSubmit = name.trim().length >= 2 && !datesInvalid && !isSaving;

  const submit = async () => {
    setIsSaving(true);
    try {
      const ok = await onSubmit({
        name: name.trim(),
        status,
        ...(color && { color }),
        ...(isEdit
          ? {
              description: description.trim() || null,
              startDate: fromDateInput(startDate) ?? null,
              dueDate: fromDateInput(dueDate) ?? null,
            }
          : {
              ...(description.trim() && { description: description.trim() }),
              ...(startDate && { startDate: fromDateInput(startDate) }),
              ...(dueDate && { dueDate: fromDateInput(dueDate) }),
              leadIds,
              memberIds,
              teamIds,
            }),
      });
      if (ok) onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the project's details."
              : "Set up the project and choose who leads it. You can add more people later."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Website relaunch"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(projectStatusLabels) as ProjectStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {projectStatusLabels[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <ColorPicker value={color} onChange={setColor} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-start">Start date</Label>
              <Input id="project-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-due">Due date</Label>
              <Input id="project-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              {datesInvalid && <p className="text-xs text-destructive">Due date must be after the start date.</p>}
            </div>
          </div>

          {!isEdit && (
            <>
              <div className="space-y-2">
                <Label>Project leads</Label>
                <PeoplePicker
                  people={people}
                  value={leadIds}
                  onChange={(ids) => {
                    setLeadIds(ids);
                    setMemberIds((m) => m.filter((id) => !ids.includes(id)));
                  }}
                  placeholder="Choose who leads this project"
                />
              </div>
              <div className="space-y-2">
                <Label>Members</Label>
                <PeoplePicker
                  people={people}
                  value={memberIds}
                  onChange={setMemberIds}
                  exclude={leadIds}
                  placeholder="Add individual members"
                />
              </div>
              {teams.length > 0 && (
                <div className="space-y-2">
                  <Label>Teams</Label>
                  <p className="text-xs text-muted-foreground">Everyone on an assigned team can see and work on the project.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {teams.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 border border-border px-3 py-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={teamIds.includes(t.id)}
                          onCheckedChange={(c) =>
                            setTeamIds((prev) => (c ? [...prev, t.id] : prev.filter((id) => id !== t.id)))
                          }
                        />
                        <ColorSwatch color={t.color} />
                        <span className="truncate">{t.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{t.memberCount}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
