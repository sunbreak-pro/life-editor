interface HasParentId {
  id: string;
  parentId: string | null;
}

export function* walkAncestors<T extends HasParentId>(
  startId: string,
  nodeMap: Map<string, T>,
): Generator<T> {
  const visited = new Set<string>();
  let node = nodeMap.get(startId);
  while (node && !visited.has(node.id)) {
    visited.add(node.id);
    if (!node.parentId) return;
    const parent = nodeMap.get(node.parentId);
    if (!parent) return;
    yield parent;
    node = parent;
  }
}
