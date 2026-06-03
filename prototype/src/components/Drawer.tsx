import { X } from "lucide-react";
import type { ReactNode } from "react";
import { C } from "../lib/theme";
import { useDismissOnEscape } from "../hooks/useDismissOnEscape";

/**
 * Reusable left slide-in drawer (the per-section sidebar chrome).
 *
 * Provides the backdrop + sliding panel only. Each section renders its own
 * `<Drawer>` instance with section-specific `children`, controlled by the shell
 * `sidebarOpen` state (IA v3 eval doc 13 §3 — children stay live, no node in context).
 *
 * Children own their internal layout. The body is `flex flex-col` WITHOUT
 * forced scroll, so a section can keep a sticky header and wrap its scrollable
 * part in `overflow-y-auto` itself.
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useDismissOnEscape(open, onClose);
  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="サイドバーを閉じる"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{
          background: "rgba(0,0,0,0.5)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 200ms",
        }}
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-modal={open || undefined}
        aria-hidden={!open}
        aria-label={title}
        className="fixed left-0 top-0 bottom-0 z-50 flex flex-col"
        style={{
          width: 280,
          maxWidth: "85vw",
          background: C.mantle,
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 220ms cubic-bezier(0.22, 0.61, 0.36, 1)",
        }}
      >
        {title !== undefined && (
          <div
            className="flex items-center justify-between px-3 shrink-0"
            style={{ height: 52, borderBottom: `1px solid ${C.surface0}` }}
          >
            <span className="text-base font-semibold" style={{ color: C.text }}>
              {title}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="閉じる"
              className="grid place-items-center rounded"
              style={{ width: 36, height: 36, color: C.subtext0 }}
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      </aside>
    </>
  );
}
