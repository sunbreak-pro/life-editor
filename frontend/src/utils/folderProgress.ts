import type { TaskNode } from "../types/taskTree";

export interface FolderProgress {
  completed: number;
  total: number;
}

export function computeFolderProgress(
  folderId: string,
  activeNodes: TaskNode[],
): FolderProgress {
  let completed = 0;
  let total = 0;

  // visited guard against cyclic / self-referential parentId chains, which
  // would otherwise recurse forever and OOM the worker (see known-issue 016).
  // For a normal (acyclic) tree each folder id is unique and visited exactly
  // once, so this has no behavioral effect outside the cyclic case.
  const visited = new Set<string>([folderId]);

  const countDescendantTasks = (parentId: string) => {
    for (const n of activeNodes) {
      if (n.parentId !== parentId) continue;
      if (n.type === "task") {
        total++;
        if (n.status === "DONE") completed++;
      } else if (n.type === "folder" && !visited.has(n.id)) {
        visited.add(n.id);
        countDescendantTasks(n.id);
      }
    }
  };

  countDescendantTasks(folderId);
  return { completed, total };
}
