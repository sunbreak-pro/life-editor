/*
 * One-shot rename of the un-prefixed localStorage keys into the app namespace
 * (#718 — decision D-20260812-materials-1, option A).
 *
 * Three Notes view prefs predate the `life-editor` naming convention and were
 * stored under bare names (`note-tree-expanded`, `note-sort-direction`,
 * `note-tag-groups-collapsed`). "Reset settings" sweeps by prefix
 * (utils/resetPreferences.ts), so those three survived a reset and left Notes
 * in a half-reset state — the sort MODE went back to default while its
 * DIRECTION, the tree expansion and the folded tag groups stayed.
 *
 * They were left bare on purpose: renaming a key orphans whatever is already
 * stored under the old name. This module removes that objection — it copies
 * each old value onto the new key at startup and deletes the old one, so the
 * rename costs nothing and the namespace rule ends up with zero exceptions.
 * From here a key added WITHOUT a `life-editor` prefix is a plain bug that the
 * resetPreferences sweep test catches.
 *
 * Idempotent: after the first run the old keys are gone, so every later call is
 * a no-op. Once the author's machine has run a build containing this (and the
 * only user is the author — CLAUDE.md §1 N=1), the module can simply be
 * deleted; that is the point of migrating rather than keeping an exception
 * list, which would have to be maintained forever.
 */

/**
 * `[legacy bare key, namespaced key]`. The colon separator is the per-surface
 * view-pref convention (matching the sibling `life-editor:note-sort-mode`).
 */
export const LEGACY_PREFERENCE_KEY_RENAMES: readonly (readonly [
  string,
  string,
])[] = [
  // hooks/notesUnifiedHelpers.ts
  ["note-tree-expanded", "life-editor:note-tree-expanded"],
  ["note-sort-direction", "life-editor:note-sort-direction"],
  // web/src/notes/hooks/useNoteListState.tsx
  ["note-tag-groups-collapsed", "life-editor:note-tag-groups-collapsed"],
];

/**
 * Carry any value stored under a legacy bare key over to its namespaced name,
 * then drop the legacy key. Call once at startup, BEFORE the first render —
 * the owning hooks read their key in a `useState` initializer.
 *
 * A key already present under the new name wins (the app has been writing
 * there since the rename, so the legacy copy is stale); the stale legacy key is
 * still removed. Returns the legacy keys that were consumed, for tests/logging.
 */
export function migrateLegacyPreferenceKeys(): string[] {
  const migrated: string[] = [];
  for (const [legacyKey, namespacedKey] of LEGACY_PREFERENCE_KEY_RENAMES) {
    try {
      const legacyValue = localStorage.getItem(legacyKey);
      if (legacyValue === null) continue;
      if (localStorage.getItem(namespacedKey) === null) {
        // Write first, delete second: if the write throws (quota / private
        // mode) the legacy value is still there to retry on the next start.
        localStorage.setItem(namespacedKey, legacyValue);
      }
      localStorage.removeItem(legacyKey);
      migrated.push(legacyKey);
    } catch {
      /* ignore — no storage access, or the write failed; retry next start */
    }
  }
  return migrated;
}
