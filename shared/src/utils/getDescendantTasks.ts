import type { TaskNode } from "../types/taskTree";

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
      // Reuse the `ids` Set as the visited guard: only descend into a child
      // that has not been seen yet. A cyclic / self-referential parentId
      // chain would otherwise loop forever and OOM the worker (known-issue
      // 016). All reachable ids are still collected exactly once.
      if (ids.has(childId)) continue;
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

  // visited guard against cyclic / self-referential parentId chains, which
  // would otherwise push the same node forever and OOM the worker (see
  // known-issue 016). The target match is still checked BEFORE the guard so
  // a directly-reachable child in a 2-node cycle is found immediately.
  const visited = new Set<string>();
  const stack = [parentId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const children = childrenMap.get(current);
    if (!children) continue;
    for (const id of children) {
      if (id === childId) return true;
      if (visited.has(id)) continue;
      visited.add(id);
      stack.push(id);
    }
  }
  return false;
}
