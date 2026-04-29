import type { TaskNode } from "../../../types/taskTree";

export function buildFolderPath(
  taskId: string | null,
  nodeMap: Map<string, TaskNode>,
): string[] {
  if (!taskId) return [];
  const path: string[] = [];
  const current = nodeMap.get(taskId);
  let parentId = current?.parentId ?? null;
  while (parentId) {
    const parent = nodeMap.get(parentId);
    if (!parent) break;
    path.unshift(parent.title);
    parentId = parent.parentId;
  }
  return path;
}
