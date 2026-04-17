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

  // Find directly matching nodes (excluding soft-deleted)
  for (const node of nodes) {
    if (node.isDeleted) continue;
    if (node.title.toLowerCase().includes(lowerQuery)) {
      matchIds.add(node.id);
    }
  }

  // Add all ancestors of matching nodes — skip deleted ancestors
  // and protect against circular parentId chains
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const ancestorsToAdd = new Set<string>();

  for (const id of matchIds) {
    const visited = new Set<string>([id]);
    let current = nodeMap.get(id);
    while (current?.parentId) {
      if (visited.has(current.parentId)) break;
      const parent = nodeMap.get(current.parentId);
      if (!parent || parent.isDeleted) break;
      if (matchIds.has(parent.id) || ancestorsToAdd.has(parent.id)) break;
      ancestorsToAdd.add(parent.id);
      visited.add(parent.id);
      current = parent;
    }
  }

  for (const id of ancestorsToAdd) {
    matchIds.add(id);
  }

  return matchIds;
}
