import type { TaskNode } from "../types/taskTree";

export function getDirectSearchMatches(
  nodes: TaskNode[],
  query: string,
): TaskNode[] {
  if (!query.trim()) return [];
  const lowerQuery = query.toLowerCase();
  return nodes.filter(
    (n) => !n.isDeleted && n.title.toLowerCase().includes(lowerQuery),
  );
}

export function getSearchMatchIds(
  nodes: TaskNode[],
  query: string,
): Set<string> {
  if (!query.trim()) return new Set();

  const lowerQuery = query.toLowerCase();
  const matchIds = new Set<string>();

  // Find directly matching nodes
  for (const node of nodes) {
    if (node.title.toLowerCase().includes(lowerQuery)) {
      matchIds.add(node.id);
    }
  }

  // Add all ancestors of matching nodes
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const ancestorsToAdd = new Set<string>();

  for (const id of matchIds) {
    let current = nodeMap.get(id);
    while (current?.parentId) {
      if (
        matchIds.has(current.parentId) ||
        ancestorsToAdd.has(current.parentId)
      )
        break;
      ancestorsToAdd.add(current.parentId);
      current = nodeMap.get(current.parentId);
    }
  }

  for (const id of ancestorsToAdd) {
    matchIds.add(id);
  }

  return matchIds;
}
