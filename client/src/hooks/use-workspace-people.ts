import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { WorkspacePerson } from "@/contexts/ProjectContext";

/** Loads the Member seats of a workspace (for pickers). */
export function useWorkspacePeople(workspaceId: string | undefined) {
  const [people, setPeople] = useState<WorkspacePerson[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    setIsLoading(true);
    api<{ members: WorkspacePerson[] }>(`/workspace/${workspaceId}/members`)
      .then((d) => !cancelled && setPeople(d.members))
      .catch(() => !cancelled && setPeople([]))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return { people, isLoading };
}
