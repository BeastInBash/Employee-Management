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
import type { TeamInput, WorkspacePerson } from "@/contexts/ProjectContext";
import { ColorPicker, PeoplePicker } from "./shared";

export type TeamFormValues = { name: string; description: string; color: string | undefined };

/** Create a team (with optional leads/members), or edit its details when `initial` is set. */
export const TeamFormDialog = ({
  open,
  onOpenChange,
  initial,
  people = [],
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: TeamFormValues;
  people?: WorkspacePerson[];
  onSubmit: (values: Omit<TeamInput, "description"> & { description?: string | null }) => Promise<boolean>;
}) => {
  const isEdit = !!initial;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string | undefined>();
  const [leadIds, setLeadIds] = useState<string[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setColor(initial?.color);
    setLeadIds([]);
    setMemberIds([]);
  }, [open, initial]);

  const submit = async () => {
    setIsSaving(true);
    try {
      const ok = await onSubmit({
        name: name.trim(),
        ...(isEdit
          ? { description: description.trim() || null }
          : description.trim() && { description: description.trim() }),
        ...(color && { color }),
        ...(!isEdit && { leadIds, memberIds }),
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
          <DialogTitle>{isEdit ? "Edit team" : "New team"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the team's details." : "Group people who work together, like Design or Sales."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="team-name">Name</Label>
            <Input id="team-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Design" autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-description">Description</Label>
            <Textarea
              id="team-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this team own?"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          {!isEdit && (
            <>
              <div className="space-y-2">
                <Label>Team leads</Label>
                <PeoplePicker
                  people={people}
                  value={leadIds}
                  onChange={(ids) => {
                    setLeadIds(ids);
                    setMemberIds((m) => m.filter((id) => !ids.includes(id)));
                  }}
                  placeholder="Choose who leads this team"
                />
              </div>
              <div className="space-y-2">
                <Label>Members</Label>
                <PeoplePicker people={people} value={memberIds} onChange={setMemberIds} exclude={leadIds} placeholder="Add members" />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={name.trim().length < 2 || isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
