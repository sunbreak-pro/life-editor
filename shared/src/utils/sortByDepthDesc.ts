import type { TaskNode } from "../types/taskTree";

/*
 * Sort a set of task ids so that **deeper nodes come first** (leaf-first
 * ordering). Used by `SupabaseTasksService.permanentDeleteTask` to delete
 * children before their parent, satisfying the composite FK
 * `ON DELETE NO ACTION` constraint introduced in migration 0009
 * (DB-Q3 v3-rev2): PostgREST would otherwise reject a parent DELETE
 * whose payload row is still referenced by a child payload row.
 *
 * Depth is measured by walking `parentId` up through `allNodes`. A node
 * whose parent chain reaches `null` (or whose parent is missing from the
 * pool — i.e. an orphan or out-of-pool ancestor) has depth = number of
 * hops taken. A cycle in the parent chain (known-issue 016 shape) is
 * defused with a `visited` guard: the walk stops on revisit and returns
 * the hops accumulated so far. The sort is therefore total and never
 * infinite-loops on corrupt data.
 *
 * Stable on equal depth (Array.prototype.sort is stable in modern JS
 * engines, V8 ≥ 7.0 / Node ≥ 12), so siblings stay in caller order.
 */
export function sortByDepthDesc(
  ids: readonly string[],
  allNodes: readonly TaskNode[],
): string[] {
  const nodeById = new Map<string, TaskNode>();
  for (const n of allNodes) nodeById.set(n.id, n);

  const depthCache = new Map<string, number>();

  function depth(startId: string): number {
    const cached = depthCache.get(startId);
    if (cached !== undefined) return cached;

    let d = 0;
    let cur: string | null = startId;
    const visited = new Set<string>();
    while (cur !== null) {
      if (visited.has(cur)) break; // cycle guard (known-issue 016)
      visited.add(cur);
      const node = nodeById.get(cur);
      if (!node || node.parentId === null) break;
      cur = node.parentId;
      d++;
    }
    depthCache.set(startId, d);
    return d;
  }

  return [...ids].sort((a, b) => depth(b) - depth(a));
}
