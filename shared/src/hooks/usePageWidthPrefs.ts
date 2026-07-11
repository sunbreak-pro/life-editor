import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type { PageWidthMode } from "../sections";

const PAGE_WIDTH_KEY = "life-editor.layout.page-width";

/*
 * Per-section width-tab persistence (Layout Standard v2 §5) — localStorage-
 * backed, the same flavor as the RightSidebar width. ONE storage entry holds
 * a scope→mode map (rather than one key per section) because useLocalStorage
 * reads its key once on mount: a single stable key keeps every section's
 * persisted choice live while the host switches sections.
 *
 * Scope = SectionId, except Materials which currently scopes per tab
 * ("materials:notes") while the section-vs-tab decision is pending (v2 §5
 * 未定事項). A scope with no entry falls back to the registry default
 * (SECTION_DEFAULT_PAGE_WIDTH) on the host side.
 */
export function usePageWidthPrefs(): [
  Readonly<Partial<Record<string, PageWidthMode>>>,
  (scope: string, mode: PageWidthMode) => void,
] {
  const [prefs, setPrefs] = useLocalStorage<
    Partial<Record<string, PageWidthMode>>
  >(PAGE_WIDTH_KEY, {});

  const setScope = useCallback(
    (scope: string, mode: PageWidthMode) =>
      setPrefs((prev) => ({ ...prev, [scope]: mode })),
    [setPrefs],
  );

  return [prefs, setScope];
}
