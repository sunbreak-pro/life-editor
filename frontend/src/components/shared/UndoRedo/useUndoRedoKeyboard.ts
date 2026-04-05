import { useEffect } from "react";
import { useUndoRedo } from "./useUndoRedo";

export function useUndoRedoKeyboard(): void {
  const {
    undo,
    redo,
    getActiveDomain,
    undoLatest,
    redoLatest,
    getActiveDomains,
  } = useUndoRedo();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== "z") return;

      const el = e.target as Element | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (el?.getAttribute("contenteditable") === "true") return;
      if (el?.closest?.('[contenteditable="true"]')) return;

      const domains = getActiveDomains();
      if (domains && domains.length > 0) {
        e.preventDefault();
        if (e.shiftKey) {
          redoLatest(domains);
        } else {
          undoLatest(domains);
        }
        return;
      }

      // Fallback to single domain for backward compatibility
      const domain = getActiveDomain();
      if (!domain) return;

      e.preventDefault();
      if (e.shiftKey) {
        redo(domain);
      } else {
        undo(domain);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, getActiveDomain, undoLatest, redoLatest, getActiveDomains]);
}
