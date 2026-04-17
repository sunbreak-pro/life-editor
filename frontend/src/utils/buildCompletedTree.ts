import type { TaskNode } from "../types/taskTree";

export interface CompletedTreeResult {
  roots: TaskNode[];
  containerIds: Set<string>;
}

/**
 * Build a tree of DONE items, preserving hierarchy by adding
 * ancestor folders as structure containers (non-interactive).
 */
export function buildCompletedTree(
  allNodes: TaskNode[],
  filterFolderId: string | null,
): CompletedTreeResult {
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

  // Collect all DONE items (not soft-deleted)
  const doneNodes = allNodes.filter((n) => n.status === "DONE" && !n.isDeleted);

  // If filtering by folder, only include DONE items that are descendants
  const relevantDone = filterFolderId
    ? doneNodes.filter((n) => isDescendantOf(n, filterFolderId, nodeMap))
    : doneNodes;

  if (relevantDone.length === 0) {
    return { roots: [], containerIds: new Set() };
  }

  // Collect IDs of all DONE items
  const doneIds = new Set(relevantDone.map((n) => n.id));

  // Find ancestor containers: TODO/IN_PROGRESS folders that are ancestors of DONE items.
  // Track visited nodes per traversal to guard against circular parentId chains.
  const containerIds = new Set<string>();
  for (const node of relevantDone) {
    const visited = new Set<string>([node.id]);
    let current = node.parentId ? nodeMap.get(node.parentId) : undefined;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      if (doneIds.has(current.id)) break; // Stop if ancestor is also DONE
      if (current.type === "folder" && current.status !== "DONE") {
        containerIds.add(current.id);
      }
      current = current.parentId ? nodeMap.get(current.parentId) : undefined;
    }
  }

  // Determine the effective root parentId
  const effectiveRootParentId = filterFolderId ?? null;

  // Build the tree: include DONE items and container folders
  const includedIds = new Set([...doneIds, ...containerIds]);

  // Find root-level items for this tree
  const roots: TaskNode[] = [];
  for (const id of includedIds) {
    const node = nodeMap.get(id);
    if (!node) continue;

    // A node is a root if:
    // - its parentId matches effectiveRootParentId, OR
    // - its parent is not in the included set
    if (node.parentId === effectiveRootParentId) {
      roots.push(node);
    } else if (node.parentId && !includedIds.has(node.parentId)) {
      roots.push(node);
    }
  }

  // Sort roots by order
  roots.sort((a, b) => a.order - b.order);

  return { roots, containerIds };
}

function isDescendantOf(
  node: TaskNode,
  ancestorId: string,
  nodeMap: Map<string, TaskNode>,
): boolean {
  const visited = new Set<string>();
  let current: TaskNode | undefined = node;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.id === ancestorId) return true;
    current = current.parentId ? nodeMap.get(current.parentId) : undefined;
  }
  return false;
}

/**
 * Get children of a node that are in the completed tree (DONE or container).
 */
export function getCompletedChildren(
  parentId: string,
  allNodes: TaskNode[],
  doneIds: Set<string>,
  containerIds: Set<string>,
): TaskNode[] {
  const includedIds = new Set([...doneIds, ...containerIds]);
  return allNodes
    .filter(
      (n) => n.parentId === parentId && includedIds.has(n.id) && !n.isDeleted,
    )
    .sort((a, b) => a.order - b.order);
}
