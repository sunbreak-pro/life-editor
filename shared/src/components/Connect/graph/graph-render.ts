import type { GraphLink, GraphNode } from "./graph-types";
import { linkEndId } from "./graph-types";
import { nodeFill, type GraphPalette } from "./graph-theme";

export const UNIFORM_NODE_SIZE = 6.5;
export const LABEL_ZOOM_THRESHOLD = 0.85;

const LINK_DASH: Record<string, [number, number] | null> = {
  hierarchy: null,
  wikilink: null,
  manual: null,
  tag: [2, 3],
  temporal: [3, 2],
};

export interface Transform {
  x: number;
  y: number;
  k: number;
}

export interface RenderState {
  nodes: GraphNode[];
  links: GraphLink[];
  palette: GraphPalette;
  transform: Transform;
  size: { w: number; h: number };
  hoveredId: string | null;
  selectedId: string | null;
  /** id -> set of adjacent ids (incl. self) */
  adjacency: Map<string, Set<string>>;
  /** search-matched ids (null = no active search) */
  searchMatchSet: Set<string> | null;
  showLabels: boolean;
}

export function draw(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const {
    nodes,
    links,
    palette,
    transform: t,
    size,
    hoveredId,
    selectedId,
    adjacency,
    searchMatchSet,
    showLabels,
  } = state;

  const focusId = hoveredId || selectedId;
  const highlightSet = focusId ? adjacency.get(focusId) : null;

  ctx.clearRect(0, 0, size.w, size.h);
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.scale(t.k, t.k);

  // ---- Links ----
  for (const l of links) {
    const s = l.source;
    const tgt = l.target;
    if (typeof s !== "object" || typeof tgt !== "object") continue;
    if (s.x == null || tgt.x == null) continue;
    const accented =
      !!focusId && !!highlightSet?.has(s.id) && !!highlightSet?.has(tgt.id);
    const dimmed = !!focusId && !accented;
    const dash = LINK_DASH[l.kind];

    ctx.beginPath();
    ctx.moveTo(s.x, s.y as number);
    ctx.lineTo(tgt.x, tgt.y as number);
    ctx.strokeStyle = accented
      ? palette.accent
      : l.kind === "manual"
        ? palette.link.manual
        : palette.link[l.kind];
    const baseWidth = l.kind === "manual" ? 1.4 : 1.0;
    ctx.lineWidth = (accented ? baseWidth * 2.2 : baseWidth) / t.k;
    ctx.globalAlpha = dimmed ? 0.05 : accented ? 0.85 : 0.26;
    if (dash) ctx.setLineDash([dash[0] / t.k, dash[1] / t.k]);
    ctx.stroke();
    if (dash) ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;

  // ---- Nodes ----
  for (const n of nodes) {
    if (n.x == null || n.y == null) continue;
    const isH = hoveredId === n.id;
    const isS = selectedId === n.id;
    const highlighted = !!focusId && !!highlightSet?.has(n.id);
    const dimmed = !!focusId && !highlighted;
    const isMatch = !!searchMatchSet?.has(n.id);
    const scale = isH || isS ? 1.5 : highlighted || isMatch ? 1.15 : 1;
    const r = UNIFORM_NODE_SIZE * scale;
    const fill = nodeFill(n, palette);

    ctx.globalAlpha = dimmed ? 0.15 : 1;

    if (isMatch) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 10 / t.k, 0, Math.PI * 2);
      ctx.fillStyle = palette.success;
      ctx.globalAlpha = 0.22;
      ctx.fill();
      ctx.globalAlpha = dimmed ? 0.15 : 1;
    }

    if (isH || isS) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 8 / t.k, 0, Math.PI * 2);
      ctx.fillStyle = palette.accent;
      ctx.globalAlpha = 0.22;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = isMatch ? palette.success : palette.border;
    ctx.lineWidth = (isMatch ? 1.8 : 1.2) / t.k;
    ctx.stroke();

    if (isS) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 5 / t.k, 0, Math.PI * 2);
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 1.2 / t.k;
      ctx.setLineDash([3 / t.k, 4 / t.k]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  ctx.globalAlpha = 1;

  // ---- Labels (zoom-gated) ----
  if (showLabels) {
    const k = t.k;
    const zoomedEnough = k >= LABEL_ZOOM_THRESHOLD;
    const fontSize = Math.max(10, 11 / k);
    ctx.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (const n of nodes) {
      if (n.x == null || n.y == null) continue;
      const isH = hoveredId === n.id;
      const isS = selectedId === n.id;
      const highlighted = !!focusId && !!highlightSet?.has(n.id);
      const isMatch = !!searchMatchSet?.has(n.id);

      let visible: boolean;
      if (isH || isS || isMatch) visible = true;
      else if (focusId && !highlighted) visible = false;
      else visible = zoomedEnough;
      if (!visible) continue;

      ctx.fillStyle =
        isH || isS
          ? palette.text
          : isMatch
            ? palette.success
            : highlighted
              ? palette.text
              : palette.textSecondary;
      const r =
        UNIFORM_NODE_SIZE *
        (isH || isS ? 1.5 : highlighted || isMatch ? 1.15 : 1);
      ctx.fillText(n.label, n.x, n.y + r + 3 / k);
    }
  }

  ctx.restore();
}

/** id -> adjacent ids (incl. self). Pure helper for hover/selection highlight. */
export function buildAdjacency(
  nodes: GraphNode[],
  links: GraphLink[],
): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const n of nodes) m.set(n.id, new Set([n.id]));
  for (const l of links) {
    const s = linkEndId(l.source);
    const tg = linkEndId(l.target);
    m.get(s)?.add(tg);
    m.get(tg)?.add(s);
  }
  return m;
}
