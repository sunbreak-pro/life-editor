/*
 * Reset local preferences (§216 lightweight prefs). Clears every localStorage
 * key in the app's own namespace — both the `life-editor-` (hyphen) keys
 * (theme / theme-mode / font-size / font-family / reduce-motion / language /
 * shortcut-config / startup-section / last-section) AND the `life-editor:`
 * (colon) keys (e.g. the Kanban view mode) — then reloads so every Provider
 * re-initializes from defaults. Scoped to OUR namespace only: a shared browser
 * origin's other apps/sessions are left untouched (no blanket localStorage
 * .clear()).
 */
const NAMESPACE_PREFIXES: readonly string[] = ["life-editor-", "life-editor:"];

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
