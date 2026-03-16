import { useEffect, useCallback, useRef } from "react";
import { useShortcutConfig } from "./useShortcutConfig";

interface UseSidebarListNavigationParams {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useSidebarListNavigation({
  containerRef,
}: UseSidebarListNavigationParams) {
  const { matchEvent } = useShortcutConfig();
  const focusedIndexRef = useRef(-1);

  const getItems = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>("[data-sidebar-item]"),
    );
  }, [containerRef]);

  const clearFocus = useCallback(() => {
    const items = getItems();
    for (const item of items) {
      item.removeAttribute("data-sidebar-focused");
    }
    focusedIndexRef.current = -1;
  }, [getItems]);

  const setFocus = useCallback(
    (index: number) => {
      const items = getItems();
      if (items.length === 0) return;

      // Clear previous
      for (const item of items) {
        item.removeAttribute("data-sidebar-focused");
      }

      const clamped = Math.max(0, Math.min(index, items.length - 1));
      focusedIndexRef.current = clamped;
      items[clamped].setAttribute("data-sidebar-focused", "true");
      items[clamped].scrollIntoView({ block: "nearest" });
    },
    [getItems],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const el = e.target as Element | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (el?.getAttribute("contenteditable") === "true") return;
      if (el?.closest?.('[contenteditable="true"]')) return;

      if (matchEvent(e, "sidebar:item-down")) {
        e.preventDefault();
        const items = getItems();
        if (items.length === 0) return;
        const next =
          focusedIndexRef.current < 0 ? 0 : focusedIndexRef.current + 1;
        setFocus(Math.min(next, items.length - 1));
        return;
      }

      if (matchEvent(e, "sidebar:item-up")) {
        e.preventDefault();
        const items = getItems();
        if (items.length === 0) return;
        const next =
          focusedIndexRef.current < 0
            ? items.length - 1
            : focusedIndexRef.current - 1;
        setFocus(Math.max(next, 0));
        return;
      }

      // Enter to click the focused item
      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        if (focusedIndexRef.current >= 0) {
          const items = getItems();
          const item = items[focusedIndexRef.current];
          if (item) {
            e.preventDefault();
            item.click();
          }
        }
      }
    },
    [matchEvent, getItems, setFocus],
  );

  // Clear focus on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        clearFocus();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [containerRef, clearFocus]);

  // Reset focus when DOM children change
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new MutationObserver(() => {
      const items = getItems();
      if (focusedIndexRef.current >= items.length) {
        clearFocus();
      }
    });
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [containerRef, getItems, clearFocus]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
