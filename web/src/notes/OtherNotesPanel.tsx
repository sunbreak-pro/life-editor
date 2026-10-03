import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, X } from "lucide-react";
import { cn, FOCUS_RING } from "@life-editor/shared";

/*
 * "Other items" (#2061) — the notes the default sidebar list leaves past its
 * 15th row.
 *
 * ONE LIST, TWO FRAMES. `OtherNotesList` is the list itself (a titled header
 * with one way out, then the rows) and is the same component at both widths:
 *
 *   - wide: `OtherNotesFlyout` opens it as a panel attached to the LEFT edge of
 *     the right sidebar, laid over the main area rather than pushing it — the
 *     sidebar keeps its width and the note behind stays where it was. Portaled
 *     to <body> because the sidebar's body is a scroll box (it would clip an
 *     absolutely positioned child) and its open animation can leave a
 *     transform on the <aside> (which would re-anchor a fixed one).
 *   - narrow: the sidebar is the MobileDrawer, and a panel to its left would
 *     be off a phone's screen. The host swaps the drawer's list for this one
 *     with a back button instead (`variant="inline"`), so it is a view inside
 *     the drawer rather than an overlay on an overlay.
 *
 * Focus moves into the list when it opens (to its way out, the first control)
 * and Esc closes it. Putting the focus back on the trigger is the host's job,
 * because only the host knows whether the trigger is still on screen.
 *
 * Pure presentation (§6.4): copy arrives already translated, lumen-* only.
 */

export interface OtherNotesListProps {
  /** Element id, so the trigger's `aria-controls` can point at it. */
  id: string;
  /** Heading copy, count included ("Other items (5)"). */
  title: string;
  /** Accessible name of the way out — "Close" on wide, "Back" on narrow. */
  dismissLabel: string;
  variant: "flyout" | "inline";
  /** Close button, back button or Esc. */
  onDismiss: () => void;
  /** The rows (<li>s), drawn by the host with the sidebar's own row part. */
  children: ReactNode;
}

export function OtherNotesList({
  id,
  title,
  dismissLabel,
  variant,
  onDismiss,
  children,
}: OtherNotesListProps) {
  const dismissRef = useRef<HTMLButtonElement>(null);

  // Into the list on open, so a keyboard user lands where the rows are rather
  // than on a trigger the list has just covered (flyout) or replaced (inline).
  useEffect(() => {
    dismissRef.current?.focus();
  }, []);

  // No IME guard needed: nothing in here takes text input.
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    // Stop here so the drawer behind (narrow) does not close as well.
    event.stopPropagation();
    onDismiss();
  };

  const titleId = `${id}-title`;
  const inline = variant === "inline";

  return (
    <section
      id={inline ? id : undefined}
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      className="flex min-h-0 flex-col gap-1"
    >
      <div className="flex items-center gap-1">
        {inline && (
          <button
            ref={dismissRef}
            type="button"
            onClick={onDismiss}
            aria-label={dismissLabel}
            className={cn(
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lumen-md text-lumen-text-secondary hover:bg-lumen-hover max-md:min-h-11 max-md:min-w-11",
              FOCUS_RING,
            )}
          >
            <ChevronLeft size={15} aria-hidden />
          </button>
        )}
        <h2
          id={titleId}
          className="min-w-0 flex-1 truncate px-1 text-xs font-semibold text-lumen-text-secondary"
        >
          {title}
        </h2>
        {!inline && (
          <button
            ref={dismissRef}
            type="button"
            onClick={onDismiss}
            aria-label={dismissLabel}
            className={cn(
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lumen-md text-lumen-text-tertiary hover:bg-lumen-hover hover:text-lumen-text-secondary max-md:min-h-11 max-md:min-w-11",
              FOCUS_RING,
            )}
          >
            <X size={14} aria-hidden />
          </button>
        )}
      </div>
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </section>
  );
}

export interface OtherNotesFlyoutProps extends Omit<
  OtherNotesListProps,
  "variant" | "onDismiss"
> {
  /**
   * The element whose LEFT edge the flyout attaches to — the right sidebar's
   * <aside>. Null (no sidebar shell around the list, e.g. a test rendering the
   * list in place) pins it to the viewport's right edge instead.
   */
  anchor: HTMLElement | null;
  /**
   * A press outside that should not count as "outside" — the trigger, which
   * toggles the flyout itself.
   */
  ignoreOutside: HTMLElement | null;
  /** Close button or Esc: the host closes it and returns the focus. */
  onDismiss: () => void;
  /** A press elsewhere on the page: closes it without moving the focus. */
  onOutsidePress: () => void;
}

/** The flyout's width, kept narrow enough to leave the note behind readable. */
const FLYOUT_WIDTH_PX = 288;

export function OtherNotesFlyout({
  anchor,
  ignoreOutside,
  onDismiss,
  onOutsidePress,
  id,
  ...listProps
}: OtherNotesFlyoutProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  /*
   * Attach to the sidebar's left edge, top to bottom. Written straight onto
   * the element rather than through state: it is layout, it follows the
   * sidebar's drag-resize and the window, and a state round trip per resize
   * sample would re-render every row for nothing.
   */
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const place = () => {
      if (!anchor) {
        panel.style.top = "0px";
        panel.style.bottom = "0px";
        panel.style.right = "0px";
        return;
      }
      const rect = anchor.getBoundingClientRect();
      panel.style.top = `${rect.top}px`;
      panel.style.bottom = `${Math.max(0, window.innerHeight - rect.bottom)}px`;
      panel.style.right = `${Math.max(0, window.innerWidth - rect.left)}px`;
    };
    place();
    window.addEventListener("resize", place);
    const observer =
      anchor && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(place)
        : null;
    if (anchor) observer?.observe(anchor);
    return () => {
      window.removeEventListener("resize", place);
      observer?.disconnect();
    };
  }, [anchor]);

  /*
   * A press outside closes it, as any panel laid over the page should. Two
   * kinds of "outside" are not: the trigger (it toggles), and another layer
   * this flyout opened — the delete confirm or the row's right-click menu
   * portal to <body> too, and answering them must not take the list away.
   */
  useEffect(() => {
    const handle = (event: Event) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (ignoreOutside?.contains(target)) return;
      if (
        target instanceof Element &&
        target.closest('[role="dialog"], [role="alertdialog"], [role="menu"]')
      ) {
        return;
      }
      onOutsidePress();
    };
    document.addEventListener("pointerdown", handle);
    return () => document.removeEventListener("pointerdown", handle);
  }, [ignoreOutside, onOutsidePress]);

  return createPortal(
    <div
      ref={panelRef}
      id={id}
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${id}-title`}
      style={{ width: FLYOUT_WIDTH_PX, maxWidth: "calc(100vw - 1rem)" }}
      // z-40: over the main column, under the z-50 dialogs and menus a row in
      // here can open.
      className="fixed z-40 flex flex-col overflow-y-auto border border-lumen-border bg-lumen-bg-subsidebar p-3 shadow-lumen-lg"
    >
      <OtherNotesList
        id={id}
        variant="flyout"
        onDismiss={onDismiss}
        {...listProps}
      />
    </div>,
    document.body,
  );
}
