import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, errorMessage } from "@/lib/api";
import type { ScopeRole } from "@/contexts/ProjectContext";
import { PeoplePicker } from "./shared";
import { useWorkspacePeople } from "@/hooks/use-workspace-people";

/** Adds one or more seats. Used by both project and team pages. */
export const AddPeopleDialog = ({
  open,
  onOpenChange,
  projectId,
  teamId,
  workspaceId,
  existing,
  canAssignLeads,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId?: string;
  teamId?: string;
  workspaceId: string;
  existing: string[];
  canAssignLeads: boolean;
  onDone: () => Promise<void>;
}) => {
  const { people } = useWorkspacePeople(open ? workspaceId : undefined);
  const [ids, setIds] = useState<string[]>([]);
  const [role, setRole] = useState<ScopeRole>("member");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setIds([]);
      setRole("member");
    }
  }, [open]);

  const base = projectId ? `/projects/${projectId}/members` : `/teams/${teamId}/members`;

  const submit = async () => {
    setIsSaving(true);
    const results = await Promise.allSettled(ids.map((memberId) => api(base, { method: "POST", body: { memberId, role } })));
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    if (failed.length) toast.error(errorMessage(failed[0]!.reason));
    const added = results.length - failed.length;
    if (added) toast.success(`Added ${added} ${added === 1 ? "person" : "people"}`);
    await onDone();
    setIsSaving(false);
    if (!failed.length) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add people</DialogTitle>
          <DialogDescription>Choose from everyone in this workspace.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <PeoplePicker people={people} value={ids} onChange={setIds} exclude={existing} placeholder="Search people" />
          {canAssignLeads && (
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as ScopeRole)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={ids.length === 0 || isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            Add {ids.length > 0 ? ids.length : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
