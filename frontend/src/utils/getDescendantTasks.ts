import type { TaskNode } from "../types/taskTree";

/**
 * Recursively collects all descendant tasks under a given folder.
 * Returns tasks at all nesting levels (not just direct children).
 */
export function getDescendantTasks(
  folderId: string,
  allNodes: TaskNode[],
): TaskNode[] {
  const childrenMap = new Map<string | null, TaskNode[]>();
  for (const node of allNodes) {
    const pid = node.parentId;
    const list = childrenMap.get(pid);
    if (list) {
      list.push(node);
    } else {
      childrenMap.set(pid, [node]);
    }
  }

  const result: TaskNode[] = [];
  const stack = [folderId];
  while (stack.length > 0) {
    const parentId = stack.pop()!;
    const children = childrenMap.get(parentId);
    if (!children) continue;
    for (const child of children) {
      result.push(child);
      if (child.type === "folder") {
        stack.push(child.id);
      }
    }
  }
  return result;
}

/**
 * Collects the IDs of a node and all its descendants.
 */
export function collectDescendantIds(
  id: string,
  nodes: TaskNode[],
): Set<string> {
  const ids = new Set<string>();
  ids.add(id);
  const stack = [id];
  while (stack.length > 0) {
    const parentId = stack.pop()!;
    for (const n of nodes) {
      if (n.parentId === parentId && !ids.has(n.id)) {
        ids.add(n.id);
        stack.push(n.id);
      }
    }
  }
  return ids;
}

/**
 * Checks if `childId` is a descendant of `parentId`.
 */
export function isDescendantOf(
  parentId: string,
  childId: string,
  nodes: TaskNode[],
): boolean {
  const children = nodes.filter((n) => n.parentId === parentId);
  return children.some(
    (c) => c.id === childId || isDescendantOf(c.id, childId, nodes),
  );
}
