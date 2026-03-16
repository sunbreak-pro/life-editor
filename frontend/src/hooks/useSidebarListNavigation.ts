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

  const getActiveIndex = useCallback(
    (items: HTMLElement[]): number => {
      if (!containerRef.current) return -1;
      const activeEl = containerRef.current.querySelector<HTMLElement>(
        "[data-sidebar-active]",
      );
      if (!activeEl) return -1;
      return items.indexOf(activeEl);
    },
    [containerRef],
  );

  const navigate = useCallback(
    (direction: 1 | -1) => {
      const items = getItems();
      if (items.length === 0) return;

      let startIdx: number;
      if (focusedIndexRef.current === -1) {
        startIdx = getActiveIndex(items);
      } else {
        startIdx = focusedIndexRef.current;
      }

      let nextIdx: number;
      if (startIdx === -1) {
        nextIdx = direction === 1 ? 0 : items.length - 1;
      } else {
        nextIdx = Math.max(0, Math.min(startIdx + direction, items.length - 1));
      }

      items[nextIdx].click();
      items[nextIdx].scrollIntoView({ block: "nearest" });
      focusedIndexRef.current = nextIdx;
    },
    [getItems, getActiveIndex],
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
        navigate(1);
        return;
      }

      if (matchEvent(e, "sidebar:item-up")) {
        e.preventDefault();
        navigate(-1);
        return;
      }

      // Shift+Enter to toggle folder expand/collapse
      if (matchEvent(e, "sidebar:toggle")) {
        const items = getItems();
        let idx = focusedIndexRef.current;
        if (idx === -1) {
          idx = getActiveIndex(items);
        }
        if (idx >= 0 && idx < items.length) {
          const item = items[idx];
          const toggle = item.querySelector<HTMLElement>(
            "[data-sidebar-toggle]",
          );
          if (toggle) {
            e.preventDefault();
            toggle.click();
          }
        }
        return;
      }
    },
    [matchEvent, getItems, getActiveIndex, navigate],
  );

  // Reset focusedIndexRef on mousedown so next arrow key re-reads from DOM
  useEffect(() => {
    const handleMouseDown = () => {
      focusedIndexRef.current = -1;
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  // Reset focusedIndexRef when DOM children change (debounced)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let timeoutId: ReturnType<typeof setTimeout>;
    const observer = new MutationObserver(() => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const items = getItems();
        if (
          focusedIndexRef.current >= items.length ||
          focusedIndexRef.current < -1
        ) {
          focusedIndexRef.current = -1;
        }
      }, 50);
    });
    observer.observe(container, { childList: true, subtree: true });
    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [containerRef, getItems]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
