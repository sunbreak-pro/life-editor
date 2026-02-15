import type { TaskNode } from "../types/taskTree";

export interface FlatFolder {
  id: string;
  title: string;
  path: string;
  depth: number;
  color?: string;
}

/**
 * Flattens all non-deleted folders into a list with their full path strings.
 * Useful for folder selection dropdowns.
 */
export function flattenFolders(nodes: TaskNode[]): FlatFolder[] {
  const folders = nodes.filter((n) => n.type === "folder" && !n.isDeleted);
  const childrenMap = new Map<string | null, TaskNode[]>();
  for (const folder of folders) {
    const pid = folder.parentId;
    const list = childrenMap.get(pid);
    if (list) {
      list.push(folder);
    } else {
      childrenMap.set(pid, [folder]);
    }
  }

  const result: FlatFolder[] = [];

  function traverse(
    parentId: string | null,
    pathParts: string[],
    depth: number,
  ) {
    const children = childrenMap.get(parentId);
    if (!children) return;
    const sorted = [...children].sort((a, b) => a.order - b.order);
    for (const folder of sorted) {
      const currentPath = [...pathParts, folder.title];
      result.push({
        id: folder.id,
        title: folder.title,
        path: currentPath.join(" / "),
        depth,
        color: folder.color,
      });
      traverse(folder.id, currentPath, depth + 1);
    }
  }

  traverse(null, [], 0);
  return result;
}
