import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { useDialogA11y } from "../hooks/useDialogA11y";
import { cn } from "./cn";

/**
 * Panel width. `reading` is a document column, `panel` a two-column work
 * surface — neither is a dialog; `full` is a take-over surface that keeps only
 * the backdrop's own gutter.
 */
export type ModalSize =
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "reading"
  | "panel"
  | "full";

/*
 * One max-width per size, emitted INSTEAD of the default — never alongside it.
 *
 * `cn` is a plain string join, not tailwind-merge (see cn.ts), so two max-w-*
 * classes on the same element are settled by the order Tailwind emits them in
 * the stylesheet, not by which one the caller passed last. Tailwind v4 emits
 * them sorted by suffix, which put `.max-w-[860px]` ABOVE `.max-w-md`: the tag
 * panel that asked for 860px rendered at 448 (#830). `max-w-lg` lost the same
 * way, `max-w-[400px]` and `max-w-[560px]` too — while `max-w-sm` happened to
 * win, which is the tell that class order rather than intent was deciding.
 * Routing width through a prop makes the caller win by construction. `padded`
 * exists for the same reason: `.p-0` sorts above `.p-5`, so it never applied.
 */
const MODAL_MAX_WIDTH: Record<ModalSize, string> = {
  sm: "max-w-sm", // 384px — confirmations
  md: "max-w-md", // 448px — short forms (default)
  lg: "max-w-lg", // 512px — item detail overlays
  xl: "max-w-[560px]", // shortcut editor
  // 818px — a panel that hosts a TEXT surface, sized off the same token as
  // PageContainer width="reading" so writing in one reads at the same measure
  // as writing in the page (#1363, the template editor).
  reading: "max-w-lumen-reading",
  panel: "max-w-[860px]", // two-column master–detail (tag editor, #740)
  // Everything but the wrapper's own p-4 gutter. Still exactly ONE max-w-*
  // class, so the emission-order trap above cannot reach it (#1194).
  full: "max-w-none",
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Already-translated accessible title (props-injected i18n, §6.4). */
  title?: string;
  /**
   * One-glyph adornment rendered before the heading text (#1044). It never
   * joins the dialog's accessible name — that comes from `aria-label={title}`
   * below, so the glyph is additive redundancy rather than the only cue.
   */
  titleIcon?: ReactNode;
  /** id of a heading inside `children` that names the dialog — for consumers
      that render their own layout instead of the default `title` heading. */
  labelledBy?: string;
  children: ReactNode;
  /** Panel width. Default "md". Never pass a max-w-* class in `className`. */
  size?: ModalSize;
  /**
   * Explicit panel width as a CSS length, for the panel that has to track a
   * width nothing static knows (#1471 — the template editor follows the note
   * column, whose size is left over from a collapsible nav and a
   * drag-resizable side panel).
   *
   * Applied as an INLINE style, which is exactly why it is a prop and not a
   * class: an inline declaration beats every class regardless of emission
   * order, so the trap documented on MODAL_MAX_WIDTH cannot reach it.
   *
   * `size` stays the ceiling — pass `min(<token>, <measured>)` rather than
   * replacing the token outright, or a wide screen gets an unreadably long
   * line.
   */
  maxWidth?: string;
  /** Panel padding. Pass false when `children` bring their own insets (rows
      that need to run edge to edge). The title heading stays inset either
      way. Default true. */
  padded?: boolean;
  /** Extra classes for the dialog panel — anything but width and padding. */
  className?: string;
  /** Close when the backdrop is clicked. Default true. */
  closeOnBackdrop?: boolean;
}

/*
 * Centered modal dialog rendered through a portal to <body>.
 *
 * §5 transparency policy: the dialog PANEL is opaque (bg-lumen-bg); the
 * BACKDROP uses bg-black/40, which is an allowed exception (overlay layer
 * for focus). role="dialog" + aria-modal + Escape-to-close for a11y.
 *
 * A11y/UX (shared by every Modal consumer): Esc closes (IME-guarded so a
 * Japanese conversion-cancel never tears the dialog down — §frontend gotcha),
 * Tab is trapped inside the panel, the first focusable is focused on open,
 * body scroll is locked while open, and focus is restored to the trigger on
 * close. All of that now lives in useDialogA11y, shared with BottomSheet —
 * which declared aria-modal without any of it until #508.
 */
export function Modal({
  open,
  onClose,
  title,
  titleIcon,
  labelledBy,
  children,
  size = "md",
  maxWidth,
  padded = true,
  className,
  closeOnBackdrop = true,
}: ModalProps) {
  const panelRef = useDialogA11y<HTMLDivElement>({
    open,
    onClose,
    lockScroll: true,
  });

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={closeOnBackdrop ? onClose : undefined}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label={labelledBy ? undefined : title}
        aria-labelledby={labelledBy}
        className={cn(
          "w-full rounded-lg border border-lumen-border",
          MODAL_MAX_WIDTH[size],
          "bg-lumen-bg shadow-lumen-lg",
          padded ? "p-5" : null,
          className,
        )}
        style={maxWidth ? { maxWidth } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title ? (
          <h2
            className={cn(
              "mb-3 text-base font-semibold text-lumen-text",
              // Only becomes a flex row when there is a glyph to sit beside —
              // every existing caller keeps a plain block <h2> with an inline
              // <span> inside it, i.e. the same box and the same wrapping.
              titleIcon ? "flex items-center gap-2" : null,
              // An unpadded panel still owes its heading an inset — only the
              // BODY rows asked to run edge to edge.
              padded ? null : "px-5 pt-5",
            )}
          >
            {titleIcon}
            <span className="min-w-0">{title}</span>
          </h2>
        ) : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}
