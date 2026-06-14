// d3-force coordinate space is its own; the point graph persists node
// positions + viewport so the layout resumes instead of scattering on every
// mount. Keys are namespaced to avoid collisions with any other graph cache.
// (frontend's pointGraphStorage referenced a Tauri-era STORAGE_KEYS module;
// the shared port inlines the keys to stay self-contained.)

const POSITIONS_KEY = "life-editor.connect.pointGraph.positions";
const VIEWPORT_KEY = "life-editor.connect.pointGraph.viewport";

export type PositionMap = Record<string, { x: number; y: number }>;
export interface GraphViewport {
  x: number;
  y: number;
  k: number;
}

function hasStorage(): boolean {
  return typeof localStorage !== "undefined";
}

export function loadPositions(): PositionMap {
  if (!hasStorage()) return {};
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    return raw ? (JSON.parse(raw) as PositionMap) : {};
  } catch {
    return {};
  }
}

export function savePositions(positions: PositionMap): void {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
  } catch {
    // quota / private mode — positions are a nicety, not critical
  }
}

export function loadViewport(): GraphViewport | null {
  if (!hasStorage()) return null;
  try {
    const raw = localStorage.getItem(VIEWPORT_KEY);
    return raw ? (JSON.parse(raw) as GraphViewport) : null;
  } catch {
    return null;
  }
}

export function saveViewport(v: GraphViewport): void {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(VIEWPORT_KEY, JSON.stringify(v));
  } catch {
    // ignore
  }
}
