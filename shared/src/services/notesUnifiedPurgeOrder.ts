import type { NoteNode } from "../types/note";

/**
 * Leaf-first purge ordering for permanentDeleteNoteUnified (#587 split).
 * Pure: operates on the live+trashed pool, no client. The composite parent
 * FK (0014) is `ON DELETE NO ACTION`, so a node whose subtree still
 * references it must be purged descendants-first — mirrors
 * `permanentDeleteTodo` (DB-Q3).
 *
 * sortByDepthDesc lives in utils/ keyed to TodoNode; rather than
 * generalising it (out of scope), the depth walk is implemented here
 * against the Note pool. Cycle guards mirror the todo-tree pattern
 * (known-issue 016).
 */
export function orderNotePurge(pool: NoteNode[], id: string): string[] {
  // Build child index + collect the subtree rooted at `id`.
  const childrenByParent = new Map<string | null, string[]>();
  for (const n of pool) {
    const list = childrenByParent.get(n.parentId);
    if (list) list.push(n.id);
    else childrenByParent.set(n.parentId, [n.id]);
  }
  const subtree = new Set<string>();
  subtree.add(id);
  const stack = [id];
  while (stack.length > 0) {
    const parent = stack.pop()!;
    for (const cid of childrenByParent.get(parent) ?? []) {
      if (subtree.has(cid)) continue; // cycle guard (known-issue 016)
      subtree.add(cid);
      stack.push(cid);
    }
  }

  // Depth walk for leaf-first ordering. Cap at pool size to defuse
  // cyclic parent chains (same shape as sortByDepthDesc).
  const nodeById = new Map(pool.map((n) => [n.id, n]));
  const depthOf = (startId: string): number => {
    let d = 0;
    let cur: string | null = startId;
    const seen = new Set<string>();
    while (cur !== null) {
      if (seen.has(cur)) break;
      seen.add(cur);
      const node = nodeById.get(cur);
      if (!node || node.parentId === null) break;
      cur = node.parentId;
      d++;
    }
    return d;
  };
  return [...subtree].sort((a, b) => depthOf(b) - depthOf(a));
}
