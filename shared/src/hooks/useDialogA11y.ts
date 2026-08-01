import { useEffect, useRef } from "react";
import type { RefObject } from "react";

const FOCUSABLE =
  'button, [href], input, textarea, select, [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

/*
 * Open dialog layers, oldest first. Escape and the Tab trap belong to the LAST
 * one only.
 *
 * Without this stack the winner was decided by listener registration order:
 * every dialog listens on document, so the FIRST one registered — the oldest,
 * outermost dialog — ran first and stopped the event. That is the reverse of
 * what layering needs (a modal opened on top of a sheet handed its Escape to
 * the sheet underneath), and BottomSheet only avoided the clash by listening in
 * the bubble phase, which is why it never had a trap at all (#508).
 */
const layers: object[] = [];

/*
 * Layout-aware visibility. In a browser a control inside a collapsed region has
 * no offsetParent and must stay out of the cycle. jsdom has no layout at all —
 * EVERY element reports a null offsetParent — so applying that filter there
 * empties the list and the trap quietly does nothing, which is the #475 shape:
 * a path no test can see. So the layout filter runs only where there is layout.
 */
function hasLayout(): boolean {
  return document.body.getClientRects().length > 0;
}

function focusablesIn(panel: HTMLElement): HTMLElement[] {
  const all = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) =>
      !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true",
  );
  return hasLayout() ? all.filter((el) => el.offsetParent !== null) : all;
}

/*
 * Chrome that belongs in the Tab cycle but must not be what a dialog opens ON.
 * BottomSheet's close button (#525) sits first in the panel, so without this the
 * first thing every sheet announced would be "Close, button" instead of the
 * content the user opened it for. Opt out of the INITIAL focus only — the
 * control stays reachable by keyboard, which is the point of adding it.
 */
export const DIALOG_AUTOFOCUS_SKIP = { "data-dialog-autofocus": "skip" };

function initialFocusIn(panel: HTMLElement): HTMLElement | null {
  return (
    focusablesIn(panel).find(
      (el) => el.getAttribute("data-dialog-autofocus") !== "skip",
    ) ?? null
  );
}

export interface DialogA11yOptions {
  open: boolean;
  onClose: () => void;
  /** Freeze body scroll while open. Default false. */
  lockScroll?: boolean;
}

/**
 * Keyboard and focus behaviour shared by every `aria-modal` surface: Escape
 * closes (IME-guarded), Tab cycles inside the panel, the first control that has
 * not opted out (see `DIALOG_AUTOFOCUS_SKIP`) is focused on open, and focus
 * returns to whatever opened it on close.
 *
 * Attach the returned ref to the dialog PANEL (not the backdrop). Give that
 * panel `tabIndex={-1}` so it can hold focus itself when it has no focusable
 * content — a sheet of plain text still has to take focus off the page behind
 * it, which is the whole point of `aria-modal`.
 */
export function useDialogA11y<T extends HTMLElement>({
  open,
  onClose,
  lockScroll = false,
}: DialogA11yOptions): RefObject<T | null> {
  const panelRef = useRef<T | null>(null);
  const layerRef = useRef<object | null>(null);

  // Hold a layer for exactly as long as the dialog is open. Keyed on `open`
  // alone: an unrelated re-render (a fresh onClose identity) must not re-order
  // the stack and steal the keyboard from a dialog above.
  useEffect(() => {
    if (!open) return;
    const layer = {};
    layerRef.current = layer;
    layers.push(layer);
    return () => {
      const at = layers.indexOf(layer);
      if (at >= 0) layers.splice(at, 1);
      layerRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Never intervene mid-composition (Japanese IME) — §frontend gotcha.
      // Escape there cancels a conversion; closing the dialog under the user's
      // hands would throw away what they were typing.
      if (e.isComposing || e.keyCode === 229) return;
      if (layerRef.current !== layers[layers.length - 1]) return;
      if (e.key === "Escape") {
        // One Escape = one layer: dialogs below, and plain document listeners
        // like MobileDrawer's, must not close on the same keypress.
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = focusablesIn(panel);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      // `!panel.contains(active)` pulls focus back in when it is loose on the
      // page (a backdrop press leaves it on <body>); `active === panel` is the
      // no-focusable-content fallback sitting just before the first control.
      if (e.shiftKey) {
        if (active === first || active === panel || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !panel.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const restore = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      // Something inside already asked for the focus (autoFocus, or a
      // consumer's own effect — QuickAddSheet focuses its input). Leave it:
      // overriding it is the "double focus" the sheets were reported for.
      if (panel.contains(document.activeElement)) return;
      (initialFocusIn(panel) ?? panel).focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      if (lockScroll) document.body.style.overflow = prevOverflow;
      restore?.focus?.();
    };
  }, [open, lockScroll]);

  return panelRef;
}
