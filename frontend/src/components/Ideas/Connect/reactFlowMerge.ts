import type { Node, Edge } from "@xyflow/react";

/*
 * Diff-merge helpers for keeping React Flow's internal node/edge state aligned
 * with derived arrays without forcing every entry to get a new identity on
 * every rebuild. Reusing object identity for unchanged entries lets React Flow
 * skip per-node measurement and re-render work.
 */

function shallowDataEqual(
  a: Record<string, unknown> | null | undefined,
  b: Record<string, unknown> | null | undefined,
  arrayKeys?: ReadonlySet<string>,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    const va = a[k];
    const vb = b[k];
    if (va === vb) continue;
    if (arrayKeys?.has(k) && Array.isArray(va) && Array.isArray(vb)) {
      if (!shallowArrayEqual(va, vb)) return false;
      continue;
    }
    return false;
  }
  return true;
}

function shallowArrayEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const va = a[i];
    const vb = b[i];
    if (va === vb) continue;
    if (
      va &&
      vb &&
      typeof va === "object" &&
      typeof vb === "object" &&
      shallowDataEqual(
        va as Record<string, unknown>,
        vb as Record<string, unknown>,
      )
    ) {
      continue;
    }
    return false;
  }
  return true;
}

export interface MergeNodesOptions {
  /** Data-keys whose values are arrays that should be compared item-wise. */
  deepArrayDataKeys?: ReadonlySet<string>;
}

export function mergeNodes<TNode extends Node>(
  prev: TNode[],
  next: TNode[],
  options?: MergeNodesOptions,
): TNode[] {
  if (prev === next) return prev;
  if (prev.length === 0) return next;
  const prevById = new Map(prev.map((n) => [n.id, n]));
  let changed = prev.length !== next.length;
  const merged = next.map((nn) => {
    const existing = prevById.get(nn.id);
    if (existing && nodesEquivalent(existing, nn, options)) return existing;
    changed = true;
    return nn;
  });
  if (!changed) {
    // Re-ordering by itself is a real change for React Flow, since parents
    // must precede children. Verify positional identity matches as well.
    for (let i = 0; i < merged.length; i++) {
      if (merged[i] !== prev[i]) {
        changed = true;
        break;
      }
    }
  }
  return changed ? merged : prev;
}

function nodesEquivalent(
  a: Node,
  b: Node,
  options?: MergeNodesOptions,
): boolean {
  if (a === b) return true;
  if (a.id !== b.id || a.type !== b.type) return false;
  if (a.position.x !== b.position.x || a.position.y !== b.position.y)
    return false;
  if (a.parentId !== b.parentId) return false;
  if (a.hidden !== b.hidden) return false;
  if (a.zIndex !== b.zIndex) return false;
  const sa = (a.style ?? null) as Record<string, unknown> | null;
  const sb = (b.style ?? null) as Record<string, unknown> | null;
  if (sa !== sb) {
    if (!sa || !sb) return false;
    if (sa.width !== sb.width || sa.height !== sb.height) return false;
  }
  return shallowDataEqual(
    a.data as Record<string, unknown>,
    b.data as Record<string, unknown>,
    options?.deepArrayDataKeys,
  );
}

export function mergeEdges<TEdge extends Edge>(
  prev: TEdge[],
  next: TEdge[],
): TEdge[] {
  if (prev === next) return prev;
  if (prev.length === 0) return next;
  const prevById = new Map(prev.map((e) => [e.id, e]));
  let changed = prev.length !== next.length;
  const merged = next.map((ne) => {
    const existing = prevById.get(ne.id);
    if (existing && edgesEquivalent(existing, ne)) return existing;
    changed = true;
    return ne;
  });
  return changed ? merged : prev;
}

function edgesEquivalent(a: Edge, b: Edge): boolean {
  if (a === b) return true;
  if (
    a.id !== b.id ||
    a.source !== b.source ||
    a.target !== b.target ||
    a.sourceHandle !== b.sourceHandle ||
    a.targetHandle !== b.targetHandle ||
    a.type !== b.type ||
    a.data !== b.data
  )
    return false;
  const sa = (a.style ?? null) as Record<string, unknown> | null;
  const sb = (b.style ?? null) as Record<string, unknown> | null;
  if (sa !== sb) {
    if (!sa || !sb) return false;
    return shallowDataEqual(sa, sb);
  }
  return true;
}
