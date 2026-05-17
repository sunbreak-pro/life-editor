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
 * Uses a parentMap for O(n) performance.
 */
export function collectDescendantIds(
  id: string,
  nodes: TaskNode[],
): Set<string> {
  const childrenMap = new Map<string | null, string[]>();
  for (const node of nodes) {
    const pid = node.parentId;
    const list = childrenMap.get(pid);
    if (list) {
      list.push(node.id);
    } else {
      childrenMap.set(pid, [node.id]);
    }
  }

  const ids = new Set<string>();
  ids.add(id);
  const stack = [id];
  while (stack.length > 0) {
    const parentId = stack.pop()!;
    const children = childrenMap.get(parentId);
    if (!children) continue;
    for (const childId of children) {
      ids.add(childId);
      stack.push(childId);
    }
  }
  return ids;
}

/**
 * Checks if `childId` is a descendant of `parentId`.
 * Uses a parentMap + iterative BFS for O(n) performance.
 * @param parentId - The ancestor node to search from (root of the subtree)
 * @param childId - The node to find within the subtree
 * @param nodes - Flat array of all task nodes
 * @returns true if childId exists anywhere under parentId's subtree
 */
export function isDescendantOf(
  parentId: string,
  childId: string,
  nodes: TaskNode[],
): boolean {
  const childrenMap = new Map<string | null, string[]>();
  for (const node of nodes) {
    const pid = node.parentId;
    const list = childrenMap.get(pid);
    if (list) {
      list.push(node.id);
    } else {
      childrenMap.set(pid, [node.id]);
    }
  }

  const stack = [parentId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const children = childrenMap.get(current);
    if (!children) continue;
    for (const id of children) {
      if (id === childId) return true;
      stack.push(id);
    }
  }
  return false;
}
