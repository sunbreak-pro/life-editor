import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { hasOpenDialogLayer, useDialogA11y } from "../../hooks/useDialogA11y";
import { isImeComposing } from "../../utils/imeGuard";
import { cn } from "../cn";
import {
  clampToViewport,
  type ClampedPlacement,
} from "../itemActions/floating";
import { FOCUS_RING } from "../styleTokens";
import type { TourLabels } from "./labels";

/*
 * Tour spotlight + bubble (#1122). Pure presentation: every piece of state and
 * every action arrives as a prop, so this file has no opinion about where the
 * tour is stored or how it advances.
 *
 * THE SPOTLIGHT IS A BOX-SHADOW, not a full-screen scrim with a hole punched
 * in it. One absolutely-positioned rectangle over the anchor casts a 9999px
 * shadow outward, which darkens everything else and leaves the anchor itself
 * lit. That buys the property this component actually needs: with
 * `pointer-events: none` there is NO element covering the page, so the user
 * can still operate the very control the tour is pointing at. A real scrim
 * would swallow that click, which is the whole of an "action" step.
 *
 * TRANSPARENCY: the darkening is `rgb(0 0 0 / 0.4)`, the same value the
 * sanctioned backdrops use (Modal / BottomSheet `bg-black/40`). That is the
 * documented exception in rules/frontend.md — the BACKDROP may be translucent,
 * the panel may not. The bubble below is fully opaque lumen tokens.
 *
 * MOTION: no JS animation, on purpose. The fade uses `.lumen-scrim-in` from
 * tokens.css, and the app-wide `prefers-reduced-motion` blocks in that same
 * file already flatten every CSS animation — so reduce-motion is honoured with
 * nothing to wire here. A rAF/WAAPI animation would have to re-implement it
 * and would be the one thing those blocks cannot reach.
 *
 * STACKING: z-45 — above the app's page chrome (z-30 and below, plus the one
 * z-40 sticky grid header) and BELOW the z-50 dialog band. That ordering is
 * load-bearing on an action step: the user is being told to operate a control,
 * and the control may open a Modal or a sheet. At a higher z the tour would
 * paint its 0.4-black shadow over that dialog and leave its own bubble
 * clickable on top of it.
 *
 * FOCUS: trapped only while the step is waiting on the BUTTON. A step waiting
 * on a user action must leave the page operable — trapping focus there would
 * make the step impossible to finish with a keyboard, which is worse than not
 * trapping at all. Both modes close on Escape; the non-modal one stands down
 * when a real dialog is open above it so one Escape still closes one layer.
 */

/** Gap between the anchor and the bubble, and the spotlight's breathing room. */
const SPOTLIGHT_GAP = 8;
/** Fallback size used before the bubble has been measured. */
const ESTIMATED_PANEL = { width: 288, height: 140 };

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface TourOverlayProps {
  /** The element being pointed at. Its rect is read for PLACEMENT only. */
  anchorElement: HTMLElement;
  /** Already-translated copy for this step (§6.4). */
  copy: string;
  /** 1-based position of this step. */
  stepNumber: number;
  /** Total number of steps. */
  totalSteps: number;
  /**
   * This step advances when the user does something, not when they press a
   * button. Drives both the footer copy and whether focus is trapped.
   */
  waitsForAction: boolean;
  /** Advance (the Next / Done button). Unused while `waitsForAction`. */
  onNext: () => void;
  /** Dismiss for good. */
  onSkip: () => void;
  /** Put the tour away but keep the position (Escape). */
  onDismiss: () => void;
  labels: TourLabels;
}

export function TourOverlay({
  anchorElement,
  copy,
  stepNumber,
  totalSteps,
  waitsForAction,
  onNext,
  onSkip,
  onDismiss,
  labels,
}: TourOverlayProps) {
  const isModal = !waitsForAction;
  const dialogRef = useDialogA11y<HTMLDivElement>({
    open: isModal,
    onClose: onDismiss,
  });

  const [panelNode, setPanelNode] = useState<HTMLDivElement | null>(null);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [placement, setPlacement] = useState<ClampedPlacement>({
    top: SPOTLIGHT_GAP,
    left: SPOTLIGHT_GAP,
  });

  // One node, two consumers: the a11y hook wants a RefObject, the measuring
  // effect wants to re-run when the node arrives.
  const attachPanel = useCallback(
    (node: HTMLDivElement | null) => {
      dialogRef.current = node;
      setPanelNode(node);
    },
    [dialogRef],
  );

  /*
   * Escape for the non-modal case. `useDialogA11y` owns it while trapped;
   * here there is no layer, so `hasOpenDialogLayer()` is what keeps this from
   * stealing the keypress from a Modal opened on top of the tour.
   */
  useEffect(() => {
    if (isModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || isImeComposing(e)) return;
      if (hasOpenDialogLayer()) return;
      onDismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isModal, onDismiss]);

  useLayoutEffect(() => {
    const measure = () => {
      // A detached anchor reports an all-zero rect, and a 4x4 box at (-4,-4)
      // casting a 9999px shadow blacks out the entire viewport with nothing
      // lit. Drop the spotlight instead; the Provider is what decides whether
      // the step survives.
      if (!anchorElement.isConnected) {
        setSpotlight(null);
        return;
      }
      const rect = anchorElement.getBoundingClientRect();
      setSpotlight({
        top: rect.top - SPOTLIGHT_GAP / 2,
        left: rect.left - SPOTLIGHT_GAP / 2,
        width: rect.width + SPOTLIGHT_GAP,
        height: rect.height + SPOTLIGHT_GAP,
      });
      // Feed the panel's REAL size back in, the way ItemActionPopover has to
      // (#826): a guessed height puts the last row off-screen where nothing
      // can reach it.
      const panel = panelNode?.getBoundingClientRect();
      setPlacement(
        clampToViewport(
          { x: rect.left, y: rect.bottom + SPOTLIGHT_GAP },
          panel?.width || ESTIMATED_PANEL.width,
          panel?.height || ESTIMATED_PANEL.height,
          SPOTLIGHT_GAP,
        ),
      );
    };
    measure();
    window.addEventListener("resize", measure);
    // Capture phase: the app scrolls inside panes, not the document, so a
    // bubbling listener on window would never see it.
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [anchorElement, copy, panelNode]);

  if (typeof document === "undefined") return null;

  const isLast = stepNumber >= totalSteps;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[45]">
      {spotlight ? (
        <div
          aria-hidden
          className="lumen-scrim-in absolute rounded-lumen-md"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            // The scrim. Same value as the sanctioned `bg-black/40` backdrops;
            // spread rather than a covering element so the page stays clickable.
            boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.4)",
          }}
        />
      ) : null}

      <div
        ref={attachPanel}
        role="dialog"
        aria-modal={isModal || undefined}
        aria-label={labels.dialogLabel}
        // For useDialogA11y's "nothing focusable inside" fallback on a modal
        // step — NOT for action steps, where the hook is inactive and nothing
        // moves focus here at all (that is what aria-live below is for).
        tabIndex={-1}
        className={cn(
          "pointer-events-auto absolute w-72 max-w-[calc(100vw-16px)]",
          // Opaque panel on purpose — only the scrim above may be translucent.
          "rounded-lumen-lg border border-lumen-border-strong bg-lumen-bg",
          "p-lumen-3 text-lumen-text shadow-lumen-lg",
        )}
        style={{
          top: placement.top,
          left: placement.left,
          maxHeight: placement.maxHeight,
          // clampToViewport only sets maxHeight when the panel cannot fit, and
          // its contract is that the caller lets it scroll there. Capping
          // without this spills the copy out of the opaque bubble — the same
          // unreachable-last-row shape #826 was about.
          overflowY: placement.maxHeight != null ? "auto" : undefined,
        }}
      >
        {/*
          An action step never takes focus — the page has to stay operable —
          so without a live region its instruction reaches a screen reader
          only if the user happens to go looking for it. Modal steps get
          announced by the focus move instead, hence the condition.
        */}
        <p
          className="text-sm leading-relaxed"
          aria-live={isModal ? undefined : "polite"}
        >
          {copy}
        </p>

        <div className="mt-lumen-3 flex items-center justify-between gap-lumen-2">
          <span className="text-xs text-lumen-text-tertiary">
            {labels.progress}
          </span>

          <div className="flex items-center gap-lumen-2">
            <button
              type="button"
              onClick={onSkip}
              // Opening a tour ON its dismiss button is the one thing it must
              // not do (the BottomSheet close-button lesson, #525).
              data-dialog-autofocus="skip"
              className={cn(
                "rounded-lumen-sm px-2 py-1 text-xs text-lumen-text-secondary",
                "hover:text-lumen-text",
                FOCUS_RING,
              )}
            >
              {labels.skip}
            </button>

            {waitsForAction ? (
              <span className="text-xs text-lumen-text-secondary">
                {labels.waitingForAction}
              </span>
            ) : (
              <button
                type="button"
                onClick={onNext}
                className={cn(
                  "rounded-lumen-sm bg-lumen-accent px-3 py-1 text-xs font-medium",
                  "text-lumen-on-accent hover:bg-lumen-accent-hover",
                  FOCUS_RING,
                )}
              >
                {isLast ? labels.done : labels.next}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
