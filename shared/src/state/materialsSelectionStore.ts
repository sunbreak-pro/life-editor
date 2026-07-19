/**
 * Module-level in-memory selection store for the Materials section (#282).
 *
 * Notes / Daily / Tasks each mount their domain provider inside a conditional
 * in the web host, so switching tab or section UNMOUNTS the provider and wipes
 * the component-local selection state. This store lives at module scope, so it
 * outlives any single React tree and lets a remounted provider re-open the item
 * the user last had selected.
 *
 * It intentionally resets on app restart (module state is fresh per process) —
 * that matches the DoD (restore within a session) and avoids restoring a stale
 * id after data may have changed out from under it.
 *
 * Deliberately dependency-free: no React, no localStorage. Persistence is
 * session-scoped only.
 */

let notesSelection: string | null = null;
let dailySelection: string | null = null;
let taskSelection: string | null = null;

export function getNotesSelection(): string | null {
  return notesSelection;
}

export function setNotesSelection(id: string | null): void {
  notesSelection = id;
}

export function clearNotesSelection(): void {
  notesSelection = null;
}

/** Daily identity is a "YYYY-MM-DD" date key (see useDailiesUnifiedAPI). */
export function getDailySelection(): string | null {
  return dailySelection;
}

export function setDailySelection(date: string | null): void {
  dailySelection = date;
}

export function clearDailySelection(): void {
  dailySelection = null;
}

export function getTaskSelection(): string | null {
  return taskSelection;
}

export function setTaskSelection(id: string | null): void {
  taskSelection = id;
}

export function clearTaskSelection(): void {
  taskSelection = null;
}

/** Clear all three domains. Primarily for test isolation (beforeEach). */
export function resetMaterialsSelection(): void {
  notesSelection = null;
  dailySelection = null;
  taskSelection = null;
}
