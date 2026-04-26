import { STORAGE_KEYS } from "../../../constants/storageKeys";

export const VIRTUAL_LINK_EDGES_HIDDEN_ID = "__virtual:link-edges-hidden";

export function loadPositions(): Record<string, { x: number; y: number }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TAG_GRAPH_POSITIONS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function savePositions(
  positions: Record<string, { x: number; y: number }>,
): void {
  localStorage.setItem(
    STORAGE_KEYS.TAG_GRAPH_POSITIONS,
    JSON.stringify(positions),
  );
}

export function loadViewport(): { x: number; y: number; zoom: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TAG_GRAPH_VIEWPORT);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveViewport(viewport: {
  x: number;
  y: number;
  zoom: number;
}): void {
  localStorage.setItem(
    STORAGE_KEYS.TAG_GRAPH_VIEWPORT,
    JSON.stringify(viewport),
  );
}

export function isSpecialFilterId(id: string): boolean {
  return id.startsWith("__");
}
