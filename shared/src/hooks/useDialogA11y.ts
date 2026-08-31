import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { isImeComposing } from "../utils/imeGuard";

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
interface KeyboardLayer {
  /**
   * True for `aria-modal` surfaces (Modal / BottomSheet / MobileDrawer), false
   * for the non-modal popovers that only borrow Escape (`useEscapeLayer`).
   * `hasOpenDialogLayer` reads this so a popover joining the stack does not
   * make the page look "covered by a dialog" to gestures outside it.
   */
  modal: boolean;
}

const layers: KeyboardLayer[] = [];

/*
 * Layout-aware visibility. In a browser a control inside a collapsed region has
 * no offsetParent and must stay out of the cycle. jsdom has no layout at all —
 * EVERY element reports a null offsetParent — so applying that filter there
 * empties the list and the trap quietly does nothing, which is the #475 shape:
 * a path no test can see. So the layout filter runs only where there is layout.
 */
/**
 * True while any `aria-modal` surface built on this hook is open (Modal /
 * BottomSheet / MobileDrawer). Exposed for gestures that live OUTSIDE the
 * dialog system and must stand down while something is on top of the page —
 * the drawer's edge-swipe (#1050) would otherwise open it behind an open
 * sheet. Read at gesture time, not at render time: what matters is the state
 * when the finger lands.
 */
export function hasOpenDialogLayer(): boolean {
  return layers.some((layer) => layer.modal);
}

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

/*
 * Hold a layer for exactly as long as the surface is open. Keyed on `open`
 * alone: an unrelated re-render (a fresh onClose identity) must not re-order
 * the stack and steal the keyboard from a layer above.
 */
function useKeyboardLayer(
  open: boolean,
  modal: boolean,
): RefObject<KeyboardLayer | null> {
  const layerRef = useRef<KeyboardLayer | null>(null);
  useEffect(() => {
    if (!open) return;
    const layer: KeyboardLayer = { modal };
    layerRef.current = layer;
    layers.push(layer);
    return () => {
      const at = layers.indexOf(layer);
      if (at >= 0) layers.splice(at, 1);
      layerRef.current = null;
    };
  }, [open, modal]);
  return layerRef;
}

export interface EscapeLayerOptions {
  open: boolean;
  onEscape: () => void;
}

/**
 * Escape ownership for a NON-modal surface that opens on top of a dialog — an
 * inline popover, a menu, a picker grid. It joins the same layer stack the
 * dialogs use, so while it is open the Escape belongs to it and the dialog
 * underneath keeps standing.
 *
 * Without a layer, a popover's own `keydown` listener never even runs: the
 * dialog's handler sits on `document` in the CAPTURE phase, so it closes the
 * whole panel before a bubble-phase listener inside the popover is reached, and
 * a capture-phase one cannot win either because registration order puts the
 * dialog (mounted first) ahead of it (#1342 — Escape over the tag icon picker
 * tore the tag edit modal down with it, losing the unsaved name).
 *
 * The surface is not `aria-modal`, so it takes no focus trap and does not count
 * as an open dialog for `hasOpenDialogLayer`.
 */
export function useEscapeLayer({ open, onEscape }: EscapeLayerOptions): void {
  const layerRef = useKeyboardLayer(open, false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Never intervene mid-composition (Japanese IME) — §frontend gotcha.
      if (isImeComposing(e)) return;
      if (e.key !== "Escape") return;
      if (layerRef.current !== layers[layers.length - 1]) return;
      // One Escape = one layer. `stopImmediatePropagation` rather than
      // `stopPropagation` because the dialog below listens on this same node in
      // this same phase, where only the immediate form stops it — plain
      // `stopPropagation` would let it run and close the panel anyway whenever
      // it happened to be registered after this one (a re-registered listener
      // is enough: its effect re-runs on a fresh `onClose` identity).
      e.stopImmediatePropagation();
      onEscape();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onEscape, layerRef]);
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
  const layerRef = useKeyboardLayer(open, true);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Never intervene mid-composition (Japanese IME) — §frontend gotcha.
      // Escape there cancels a conversion; closing the dialog under the user's
      // hands would throw away what they were typing.
      if (isImeComposing(e)) return;
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
  }, [open, onClose, layerRef]);

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
