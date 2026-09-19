/**
 * Module-level in-memory selection store for the Connect section (#1473).
 *
 * The Connect body (`web/src/connect/ConnectScreen.tsx`) is mounted inside the
 * section switch in `web/src/sectionDescriptors.tsx`, so leaving the section
 * UNMOUNTS it and takes its component-local "which tag" state with it. Every
 * other section keeps what the user had open across a section switch —
 * Materials through `materialsSelectionStore` (#282), the Calendar and the
 * lifted Analytics tab through the shell — and Connect was the one that came
 * back blank. This store is the same idiom as #282's: module scope outlives
 * any single React tree, so a remounted ConnectScreen can re-open the tag the
 * user last picked.
 *
 * Session-scoped on purpose. It resets on app restart (module state is fresh
 * per process) — a tag id from a previous run may no longer exist, and the
 * Issue asks for "leave and come back", not "close and reopen the app".
 *
 * Deliberately dependency-free: no React, no localStorage.
 */

let connectTagSelection: string | null = null;
/** The item whose relations the right panel is showing (#1645). */
let connectItemSelection: string | null = null;

export function getConnectTagSelection(): string | null {
  return connectTagSelection;
}

export function setConnectTagSelection(tagId: string | null): void {
  connectTagSelection = tagId;
}

export function getConnectItemSelection(): string | null {
  return connectItemSelection;
}

export function setConnectItemSelection(itemId: string | null): void {
  connectItemSelection = itemId;
}

/** Back to the fresh-process state. Primarily for test isolation. */
export function resetConnectSelection(): void {
  connectTagSelection = null;
  connectItemSelection = null;
}
