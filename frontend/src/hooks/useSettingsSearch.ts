import { useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  SETTINGS_SEARCH_ENTRIES,
  type SettingsSearchEntry,
} from "../constants/settingsSearchRegistry";
import type { SearchSuggestion } from "../components/shared/SearchBar";

interface SettingsNavigators {
  setActiveTab: (tab: SettingsSearchEntry["tab"]) => void;
  setGeneralSub: (sub: string) => void;
  setAdvancedSub: (sub: string) => void;
  setClaudeSub: (sub: string) => void;
  setShortcutsSub: (sub: string) => void;
}

const TAB_LABEL_KEYS: Record<SettingsSearchEntry["tab"], string> = {
  general: "settings.general",
  advanced: "settings.advancedTab",
  claude: "settings.claude.title",
  shortcuts: "settings.shortcutsTab",
};

export function useSettingsSearch(
  query: string,
  navigators: SettingsNavigators,
) {
  const { t } = useTranslation();

  const suggestions = useMemo<SearchSuggestion[]>(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return SETTINGS_SEARCH_ENTRIES.filter((entry) => {
      const label = t(entry.labelKey).toLowerCase();
      if (label.includes(q)) return true;
      return (
        entry.keywords?.some((kw) => kw.toLowerCase().includes(q)) ?? false
      );
    }).map((entry) => ({
      id: entry.id,
      label: t(entry.labelKey),
      icon: "settings" as const,
      sublabel: TAB_LABEL_KEYS[entry.tab] ? t(TAB_LABEL_KEYS[entry.tab]) : "",
    }));
  }, [query, t]);

  const navigateTo = useCallback(
    (entryId: string) => {
      const entry = SETTINGS_SEARCH_ENTRIES.find((e) => e.id === entryId);
      if (!entry) return;

      navigators.setActiveTab(entry.tab);

      switch (entry.tab) {
        case "general":
          navigators.setGeneralSub(entry.subTab);
          break;
        case "advanced":
          navigators.setAdvancedSub(entry.subTab);
          break;
        case "claude":
          navigators.setClaudeSub(entry.subTab);
          break;
        case "shortcuts":
          navigators.setShortcutsSub(entry.subTab);
          break;
      }

      requestAnimationFrame(() => {
        const el = document.querySelector(
          `[data-section-id="${entry.sectionId}"]`,
        );
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [navigators],
  );

  return { suggestions, navigateTo };
}
