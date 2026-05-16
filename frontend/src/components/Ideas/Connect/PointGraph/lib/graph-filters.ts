import type { GraphNode, GraphNodeType, GraphSnapshot } from "./graph-types";
import { linkEndId } from "./graph-types";

export type TypeToggles = Record<GraphNodeType, boolean>;

export const ALL_TYPES: GraphNodeType[] = ["project", "note", "daily", "tag"];

export const DEFAULT_TYPE_TOGGLES: TypeToggles = {
  project: true,
  note: true,
  daily: true,
  tag: true,
};

export interface FilterState {
  search: string;
  activeTypes: TypeToggles;
  /** selected tag node ids (`tag:<id>`) */
  activeTags: Set<string>;
  /** focus node id for local-graph mode (null = off) */
  localFocusId: string | null;
  localDepth: number;
  showOrphans: boolean;
}

export const DEFAULT_FILTER_STATE: FilterState = {
  search: "",
  activeTypes: DEFAULT_TYPE_TOGGLES,
  activeTags: new Set(),
  localFocusId: null,
  localDepth: 0,
  showOrphans: true,
};

export function isFilterActive(s: FilterState): boolean {
  return (
    s.search.trim() !== "" ||
    !ALL_TYPES.every((t) => s.activeTypes[t]) ||
    s.activeTags.size > 0 ||
    (s.localDepth > 0 && s.localFocusId != null) ||
    !s.showOrphans
  );
}

export function activeFilterCount(s: FilterState): number {
  return (
    (s.search.trim() ? 1 : 0) +
    (ALL_TYPES.every((t) => s.activeTypes[t]) ? 0 : 1) +
    (s.activeTags.size > 0 ? 1 : 0) +
    (s.localDepth > 0 && s.localFocusId ? 1 : 0) +
    (!s.showOrphans ? 1 : 0)
  );
}

function nhopNeighbors(
  rootId: string,
  depth: number,
  links: GraphSnapshot["links"],
): Set<string> {
  if (depth <= 0) return new Set([rootId]);
  const visited = new Set([rootId]);
  let frontier = new Set([rootId]);
  for (let i = 0; i < depth; i++) {
    const next = new Set<string>();
    for (const l of links) {
      const s = linkEndId(l.source);
      const t = linkEndId(l.target);
      if (frontier.has(s) && !visited.has(t)) {
        next.add(t);
        visited.add(t);
      }
      if (frontier.has(t) && !visited.has(s)) {
        next.add(s);
        visited.add(s);
      }
    }
    frontier = next;
    if (frontier.size === 0) break;
  }
  return visited;
}

/**
 * Pure filter pipeline. Order matches the demo: type -> tag -> search
 * (with 1-hop expansion) -> local graph -> link prune -> orphan prune.
 */
export function applyFilters(
  snapshot: GraphSnapshot,
  state: FilterState,
): { snapshot: GraphSnapshot; searchMatchSet: Set<string> | null } {
  let nodes: GraphNode[] = snapshot.nodes.filter(
    (n) => state.activeTypes[n.type],
  );
  let ids = new Set(nodes.map((n) => n.id));

  if (state.activeTags.size > 0) {
    const tagged = new Set<string>();
    for (const l of snapshot.links) {
      if (l.kind !== "tag") continue;
      const s = linkEndId(l.source);
      const t = linkEndId(l.target);
      const tagId = state.activeTags.has(s)
        ? s
        : state.activeTags.has(t)
          ? t
          : null;
      if (!tagId) continue;
      tagged.add(s);
      tagged.add(t);
    }
    nodes = nodes.filter((n) => tagged.has(n.id) || state.activeTags.has(n.id));
    ids = new Set(nodes.map((n) => n.id));
  }

  let searchMatchSet: Set<string> | null = null;
  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    const matched = new Set(
      nodes
        .filter(
          (n) =>
            n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q),
        )
        .map((n) => n.id),
    );
    searchMatchSet = matched;
    const expanded = new Set(matched);
    for (const l of snapshot.links) {
      const s = linkEndId(l.source);
      const t = linkEndId(l.target);
      if (matched.has(s) && ids.has(t)) expanded.add(t);
      if (matched.has(t) && ids.has(s)) expanded.add(s);
    }
    nodes = nodes.filter((n) => expanded.has(n.id));
    ids = new Set(nodes.map((n) => n.id));
  }

  if (
    state.localFocusId &&
    state.localDepth > 0 &&
    ids.has(state.localFocusId)
  ) {
    const visited = nhopNeighbors(
      state.localFocusId,
      state.localDepth,
      snapshot.links,
    );
    nodes = nodes.filter((n) => visited.has(n.id));
    ids = new Set(nodes.map((n) => n.id));
  }

  let links = snapshot.links.filter(
    (l) => ids.has(linkEndId(l.source)) && ids.has(linkEndId(l.target)),
  );

  if (!state.showOrphans) {
    const connected = new Set<string>();
    for (const l of links) {
      connected.add(linkEndId(l.source));
      connected.add(linkEndId(l.target));
    }
    nodes = nodes.filter((n) => connected.has(n.id));
    const finalIds = new Set(nodes.map((n) => n.id));
    links = links.filter(
      (l) =>
        finalIds.has(linkEndId(l.source)) && finalIds.has(linkEndId(l.target)),
    );
  }

  return { snapshot: { nodes, links }, searchMatchSet };
}
