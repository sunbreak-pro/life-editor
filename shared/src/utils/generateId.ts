/**
 * Prefixed UUID id (CLAUDE.md §4.3 — `<prefix>-<uuid>`). 1:1 port of
 * frontend/src/utils/generateId.ts. `crypto.randomUUID` is available in
 * every host the shared package targets (modern browser / Electron
 * renderer / Capacitor WebView).
 */
export function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
