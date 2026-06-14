/*
 * Point-graph data model (W4 shared port). Identical shape to the frozen
 * frontend PointGraph, but the snapshot is now built from the UNIFIED
 * item-link model (notes / dailies / tags / assignments / item↔item links)
 * — see ./buildGraphModel. The rendering layer below is data-shape agnostic.
 */

export type GraphNodeType = "project" | "note" | "daily" | "tag";

export type GraphLinkKind =
  | "hierarchy"
  | "wikilink"
  | "tag"
  | "temporal"
  | "manual";

export interface GraphNode {
  /** note.id / daily.id / `tag:<tagId>` */
  id: string;
  label: string;
  type: GraphNodeType;
  /** note.color or tag.color when present; type color is resolved by theme */
  color?: string;
  /** raw tagId for tag nodes, original entity id otherwise */
  entityId?: string;
  /** d3-force injected position/velocity (read-only outside the simulation) */
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  /** d3-force replaces string ids with node objects after the first tick */
  source: string | GraphNode;
  target: string | GraphNode;
  kind: GraphLinkKind;
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  links: GraphLink[];
}

export function linkEndId(end: string | GraphNode): string {
  return typeof end === "object" ? end.id : end;
}

export const TAG_NODE_PREFIX = "tag:";

export function tagNodeId(tagId: string): string {
  return `${TAG_NODE_PREFIX}${tagId}`;
}

export function isTagNodeId(id: string): boolean {
  return id.startsWith(TAG_NODE_PREFIX);
}
