import { STORAGE_KEYS } from "../../../../../constants/storageKeys";

// d3-force coordinate space differs from React Flow's, so Point Graph keeps
// its own position/viewport keys instead of reusing TAG_GRAPH_* (same
// pattern as tagGraphStorage, separate namespace to avoid corruption).

export type PositionMap = Record<string, { x: number; y: number }>;
export interface GraphViewport {
  x: number;
  y: number;
  k: number;
}

export function loadPositions(): PositionMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.POINT_GRAPH_POSITIONS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function savePositions(positions: PositionMap): void {
  try {
    localStorage.setItem(
      STORAGE_KEYS.POINT_GRAPH_POSITIONS,
      JSON.stringify(positions),
    );
  } catch {
    // quota / private mode — positions are a nicety, not critical
  }
}

export function loadViewport(): GraphViewport | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.POINT_GRAPH_VIEWPORT);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveViewport(v: GraphViewport): void {
  try {
    localStorage.setItem(STORAGE_KEYS.POINT_GRAPH_VIEWPORT, JSON.stringify(v));
  } catch {
    // ignore
  }
}
