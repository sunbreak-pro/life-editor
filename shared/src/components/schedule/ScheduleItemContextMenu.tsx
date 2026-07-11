import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, CopyPlus, Trash2 } from "lucide-react";
import { cn } from "../cn";

/*
 * ScheduleItemContextMenu (#223) — pure, presentational right-click menu for a
 * calendar item (WeekTimeGrid block / MonthGrid chip). Fixed-positioned portal
 * to document.body (z above the grid + rightSidebar), Escape + outside-mousedown
 * close, and viewport-edge clamping so it never spills off screen.
 *
 * Two modes:
 *   - "menu": rename / duplicate / delete (danger) rows;
 *   - "rename": a small inline input seeded with the current title, Enter
 *     commits (onRename), Escape cancels (closes). IME-safe (isComposing).
 *
 * Pure presentation (CLAUDE.md §3.1 / §6.4): no DataService, no useTranslation.
 * All copy arrives already translated via `labels`. lumen-* tokens only; the
 * surface is opaque (§5). Desktop-only (mobile long-press is out of scope).
 */

export interface ScheduleItemContextMenuLabels {
  rename: string;
  duplicate: string;
  delete: string;
}

export interface ScheduleItemContextMenuProps {
  /** Anchor point in viewport coordinates (from the contextmenu event). */
  position: { x: number; y: number };
  /** Seeds the rename input. */
  currentTitle: string;
  labels: ScheduleItemContextMenuLabels;
  /** Commit a new title (already trimmed by the menu). */
  onRename: (title: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const MENU_WIDTH = 180;
const EDGE_GAP = 8;
// Conservative height estimate for the edge-clamp (3 rows ≈ 108px, rename ≈ 96px).
const EST_HEIGHT = 120;

export function ScheduleItemContextMenu({
  position,
  currentTitle,
  labels,
  onRename,
  onDuplicate,
  onDelete,
  onClose,
}: ScheduleItemContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"menu" | "rename">("menu");
  const [draft, setDraft] = useState(currentTitle);

  // Escape (viewport-level) + outside mousedown close. Escape ignores IME
  // composition so cancelling a kanji conversion does not also close the menu.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.isComposing) onClose();
    };
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleOutside);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleOutside);
    };
  }, [onClose]);

  // Focus + select the title when entering rename mode.
  useLayoutEffect(() => {
    if (mode === "rename") {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [mode]);

  const commitRename = () => {
    const trimmed = draft.trim();
    if (trimmed) onRename(trimmed);
    onClose();
  };

  const left = Math.max(
    EDGE_GAP,
    Math.min(position.x, window.innerWidth - MENU_WIDTH - EDGE_GAP),
  );
  const top = Math.max(
    EDGE_GAP,
    Math.min(position.y, window.innerHeight - EST_HEIGHT - EDGE_GAP),
  );

  const rowClass =
    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lumen-accent";

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-[60] overflow-hidden rounded-lumen-md border border-lumen-border bg-lumen-bg py-1 shadow-lumen-lg"
      style={{ top, left, width: MENU_WIDTH }}
    >
      {mode === "menu" ? (
        <>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setDraft(currentTitle);
              setMode("rename");
            }}
            className={cn(rowClass, "text-lumen-text hover:bg-lumen-hover")}
          >
            <Pencil aria-hidden className="size-3.5 shrink-0" />
            {labels.rename}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onDuplicate();
              onClose();
            }}
            className={cn(rowClass, "text-lumen-text hover:bg-lumen-hover")}
          >
            <CopyPlus aria-hidden className="size-3.5 shrink-0" />
            {labels.duplicate}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onDelete();
              onClose();
            }}
            className={cn(
              rowClass,
              "text-lumen-danger hover:bg-lumen-danger-subtle",
            )}
          >
            <Trash2 aria-hidden className="size-3.5 shrink-0" />
            {labels.delete}
          </button>
        </>
      ) : (
        <div className="px-2 py-1">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter") {
                e.preventDefault();
                // Stop the document-level Escape/close listener from also
                // reacting to this same native event.
                e.stopPropagation();
                commitRename();
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }
            }}
            aria-label={labels.rename}
            className="w-full rounded-lumen-md border border-lumen-border bg-lumen-bg px-2 py-1 text-xs text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
          />
        </div>
      )}
    </div>,
    document.body,
  );
}
