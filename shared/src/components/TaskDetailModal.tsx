/*
 * TaskDetailModal (K3, W-UX) — the centered overlay the Kanban opens when a
 * card is clicked. Pure presentation (§6.4): the host injects the detail
 * surface as `children` (the shared TaskDetailPanel + the web TipTap editor)
 * and all copy as already-translated props. No DataService / no useTranslation
 * here.
 *
 * W-UX: was a full-bleed "全面 Modal" (h-full w-full). Now a constrained card
 * that scales in over a dimmed, lightly-blurred backdrop so the board behind
 * stays faintly visible (the requested overlay feel). Layout:
 *   - portal-rendered, fixed backdrop (bg-black/40 — opaque-exception overlay),
 *     click-outside closes
 *   - centered panel (max-w / max-h) with the top status band + breadcrumb
 *     header + close button, scrollable body
 *
 * A11y: Esc closes, focus is trapped (Tab cycles, IME isComposing guarded so
 * Japanese input is never stolen — §frontend gotcha), body scroll is locked
 * while open, focus is restored on close, and the entrance animation is
 * disabled under prefers-reduced-motion (CSS, tokens.css).
 *
 * Status band / folder dot use user-data / fixed-status colors via tokens +
 * inline style (same rule as the rest of the Kanban).
 */

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, ChevronRight } from "lucide-react";
import type { TaskStatus } from "../types/taskTree";
import { cn } from "./cn";

const STATUS_BAND_CLASS: Record<TaskStatus, string> = {
  NOT_STARTED: "bg-notion-status-todo-band",
  IN_PROGRESS: "bg-notion-status-progress-band",
  DONE: "bg-notion-status-done-band",
};

const FOCUSABLE =
  'button, [href], input, textarea, select, [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

export interface TaskDetailModalProps {
  open: boolean;
  onClose: () => void;
  /** Drives the top status band hue. Undefined (folder) → neutral band. */
  status?: TaskStatus;
  /** Breadcrumb: parent folder name + its color dot (optional). */
  folderName?: string;
  folderColor?: string;
  /** Already-translated trailing breadcrumb label ("Task"). */
  breadcrumbTaskLabel: string;
  /** Already-translated close-button aria-label. */
  closeLabel: string;
  children: ReactNode;
}

export function TaskDetailModal({
  open,
  onClose,
  status,
  folderName,
  folderColor,
  breadcrumbTaskLabel,
  closeLabel,
  children,
}: TaskDetailModalProps): React.JSX.Element | null {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Esc close + focus trap (Tab, IME-guarded).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Never intervene mid-composition (Japanese IME) — §frontend gotcha.
      // Esc here would cancel an IME conversion, not close the modal.
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  // Body scroll lock + focus management while open.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the first focusable element in the panel after mount.
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      const target = panel?.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const bandClass = status
    ? STATUS_BAND_CLASS[status]
    : "bg-notion-border-strong";

  return createPortal(
    <div
      className="kanban-modal-backdrop fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px] sm:p-6"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="kanban-modal-panel relative flex max-h-[88vh] w-full max-w-[820px] flex-col overflow-hidden rounded-2xl border border-notion-border bg-notion-bg shadow-notion-lg"
      >
        {/* Top status band — status-forward, even full-screen. */}
        <div aria-hidden className={cn("h-[5px] w-full shrink-0", bandClass)} />

        {/* Header: breadcrumb + close */}
        <div className="flex items-center gap-3.5 border-b border-notion-border px-6 py-3.5">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[0.8125rem] text-notion-text-secondary">
            {folderName && (
              <>
                <span
                  aria-hidden
                  className={cn(
                    "h-2.5 w-2.5 shrink-0 rounded-[3px]",
                    folderColor ? "" : "bg-notion-border-strong",
                  )}
                  style={
                    folderColor ? { backgroundColor: folderColor } : undefined
                  }
                />
                <span className="min-w-0 truncate">{folderName}</span>
                <ChevronRight
                  size={13}
                  aria-hidden
                  className="shrink-0 opacity-50"
                />
              </>
            )}
            <span
              id="task-detail-modal-title"
              className="font-semibold text-notion-text"
            >
              {breadcrumbTaskLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            title={closeLabel}
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-md border border-notion-border",
              "text-notion-text-secondary transition-colors hover:bg-notion-hover hover:text-notion-text",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-notion-accent",
            )}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* Body — scrollable readable column */}
        <div className="flex-1 overflow-y-auto px-6 py-7">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
