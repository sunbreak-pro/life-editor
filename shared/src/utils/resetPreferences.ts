/*
 * Reset local preferences (§216 lightweight prefs). Clears every localStorage
 * key in the app's own namespace, then reloads so every Provider re-initializes
 * from defaults. Scoped to OUR namespace only: a shared browser origin's other
 * apps/sessions are left untouched (no blanket localStorage .clear()).
 *
 * Three separators grew over time after the `life-editor` stem, so all three
 * are swept (the key list itself lives at each owning module — see the
 * `*_STORAGE_KEY` constants):
 *
 *   - `life-editor-` (hyphen) — the settings-screen prefs (theme, fonts,
 *     language, shortcuts, startup section, day start, week start …)
 *   - `life-editor:` (colon)  — the per-surface view prefs (Kanban view mode,
 *     Notes sort mode, Daily sort mode / direction)
 *   - `life-editor.` (dot)    — the layout / canvas state (#718): the shell's
 *     sidebar-collapsed flag and right-sidebar width, plus the Connect graph's
 *     saved node positions and viewport
 *
 * The dot family was missed until #718: "reset settings" left the sidebar
 * collapsed and the Connect graph pinned to its old layout. Adding a separator
 * here is enough BECAUSE the keys keep their names — nothing is renamed, so no
 * stored value is orphaned.
 *
 * KNOWN GAP (#718, awaiting a decision — do not "fix" this by renaming keys
 * without reading that issue): three Notes keys carry NO prefix at all
 * (`note-tree-expanded`, `note-sort-direction`, `note-tag-groups-collapsed`),
 * so they still survive a reset. Renaming them into this namespace would
 * silently discard the values already saved on the author's machine, which is
 * exactly why they were left un-prefixed in the first place — see the comment
 * in hooks/notesUnifiedHelpers.ts.
 */
const NAMESPACE_PREFIXES: readonly string[] = [
  "life-editor-",
  "life-editor:",
  "life-editor.",
];

function isPreferenceKey(key: string): boolean {
  return NAMESPACE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/** Collect every localStorage key under the app namespace (pure read). */
export function collectPreferenceKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null && isPreferenceKey(key)) {
        keys.push(key);
      }
    }
  } catch {
    /* ignore — no storage access */
  }
  return keys;
}

/**
 * Remove every namespaced preference key, then reload the app (unless
 * `reload: false` — used by unit tests, which can't reload jsdom). Returns the
 * list of keys that were removed.
 */
export function resetLocalPreferences(options?: {
  reload?: boolean;
}): string[] {
  const keys = collectPreferenceKeys();
  try {
    for (const key of keys) {
      localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
  if (options?.reload !== false && typeof location !== "undefined") {
    location.reload();
  }
  return keys;
}
