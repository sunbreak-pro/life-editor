import { useEffect, useCallback } from "react";
import { useShortcutConfig } from "./useShortcutConfig";

interface UseTabKeyboardNavigationParams<T extends string> {
  tabs: readonly { id: T }[];
  activeTab: T;
  onTabChange: (tab: T) => void;
}

export function useTabKeyboardNavigation<T extends string>({
  tabs,
  activeTab,
  onTabChange,
}: UseTabKeyboardNavigationParams<T>) {
  const { matchEvent } = useShortcutConfig();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (tabs.length <= 1) return;

      const el = e.target as Element | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (el?.getAttribute("contenteditable") === "true") return;
      if (el?.closest?.('[contenteditable="true"]')) return;

      let direction = 0;
      if (matchEvent(e, "tab:next")) direction = 1;
      else if (matchEvent(e, "tab:prev")) direction = -1;
      if (direction === 0) return;

      e.preventDefault();
      const currentIdx = tabs.findIndex((t) => t.id === activeTab);
      const nextIdx = (currentIdx + direction + tabs.length) % tabs.length;
      onTabChange(tabs[nextIdx].id);
    },
    [tabs, activeTab, onTabChange, matchEvent],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
