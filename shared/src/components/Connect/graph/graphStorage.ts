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

/**
 * Read the persisted node positions back (#361).
 *
 * The writer half below runs every 4s and on unmount; between 2026-07-25 (the
 * reader was deleted as unreferenced) and this restore, nothing read the key,
 * so every mount re-simulated from scratch WHILE `loadViewport` still restored
 * the old pan/zoom — the camera pointed at where the previous layout used to
 * be. Anything that is not a finite {x, y} pair is dropped rather than trusted:
 * a hand-edited or half-written entry would otherwise put a node at NaN, which
 * d3-force propagates through the whole simulation.
 */
export function loadPositions(): PositionMap {
  if (!hasStorage()) return {};
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    // Prototype-less: a stored `__proto__` key would otherwise replace the
    // map's prototype instead of becoming an entry, and every later lookup
    // would inherit an {x, y} that no node actually owns.
    const out: PositionMap = Object.create(null) as PositionMap;
    for (const [id, value] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      if (typeof value !== "object" || value === null) continue;
      const { x, y } = value as { x?: unknown; y?: unknown };
      if (typeof x !== "number" || !Number.isFinite(x)) continue;
      if (typeof y !== "number" || !Number.isFinite(y)) continue;
      out[id] = { x, y };
    }
    return out;
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
