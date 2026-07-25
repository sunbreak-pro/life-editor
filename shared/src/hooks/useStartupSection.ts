import { SECTION_IDS, type SectionId } from "../sections";
import { useLocalStorage } from "./useLocalStorage";

/*
 * Startup section preference (§216 lightweight prefs). Two persisted keys:
 *   - `life-editor-startup-section` = "last" | SectionId — the user's choice
 *     of what opens on launch (resume the last section, or a fixed one).
 *   - `life-editor-last-section` = SectionId — the last section the user was
 *     on, written by the host on every section change (see MainScreen).
 *
 * The resolve/persist helpers are PURE (localStorage only, no React) so the
 * host can seed `useState` on first render and unit tests can exercise the
 * logic without mounting a component. SectionId validity is checked against
 * the registry (sections.ts SSOT) so a stale/renamed section id falls back to
 * the default rather than routing to a dead section.
 */
const STARTUP_PREF_STORAGE_KEY = "life-editor-startup-section";
const LAST_SECTION_STORAGE_KEY = "life-editor-last-section";

/** "last" (resume the last-visited section) or a fixed SectionId. */
export type StartupSectionPref = "last" | SectionId;

/** Fallback when nothing valid is stored (the app's default landing section).
 *  Briefing plan Step 1: the morning paper is the app's home. */
export const DEFAULT_STARTUP_SECTION: SectionId = "briefing";

function isSectionId(value: string): value is SectionId {
  return (SECTION_IDS as readonly string[]).includes(value);
}

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Resolve the section to open on launch (pure; reads localStorage).
 *   - pref "last" / absent → the last-visited section, else the default.
 *   - pref = a fixed SectionId → that section if still valid, else the default.
 */
export function resolveInitialSection(): SectionId {
  const pref = readKey(STARTUP_PREF_STORAGE_KEY);
  if (pref === null || pref === "last") {
    const last = readKey(LAST_SECTION_STORAGE_KEY);
    return last !== null && isSectionId(last) ? last : DEFAULT_STARTUP_SECTION;
  }
  return isSectionId(pref) ? pref : DEFAULT_STARTUP_SECTION;
}

/** Persist the last-visited section (host calls this on section change). */
export function persistLastSection(id: SectionId): void {
  try {
    localStorage.setItem(LAST_SECTION_STORAGE_KEY, id);
  } catch {
    /* ignore quota errors */
  }
}

/** Settings-side read/write of the startup preference (value + setter). */
export function useStartupSectionPref(): {
  pref: StartupSectionPref;
  setPref: (pref: StartupSectionPref) => void;
} {
  const [pref, setPref] = useLocalStorage<StartupSectionPref>(
    STARTUP_PREF_STORAGE_KEY,
    "last",
    {
      serialize: (v) => v,
      deserialize: (raw) =>
        raw === "last" || isSectionId(raw)
          ? (raw as StartupSectionPref)
          : "last",
    },
  );
  return { pref, setPref };
}
