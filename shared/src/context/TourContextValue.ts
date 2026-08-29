import { createContext } from "react";
import type { TourStep } from "../components/tour/types";
import type { SectionId } from "../sections";

/*
 * Tour context value (#1122).
 *
 * REQUIRED Provider (not a Mobile 省略 one, CLAUDE.md §2) — the tour is not on
 * the mobile omission roster, and a step whose control is absent on a phone is
 * handled by the anchor fallback rather than by tearing the Provider out. The
 * context default is still `null` so `createContextHook` can name the mistake
 * when something reads it from outside.
 */
export interface TourContextValue {
  /**
   * The step currently ON SCREEN, or null when nothing is showing.
   *
   * Non-null only once the step's anchor has actually been found, so a
   * consumer never paints a bubble for a step that is about to be skipped —
   * "active" here means displayable, not merely selected.
   */
  activeStep: TourStep | null;
  /** The element `activeStep` points at. Paired with it: both are set, or
   *  neither is. Read its rect for PLACEMENT only. */
  anchorElement: HTMLElement | null;
  /** 1-based position of `activeStep` in the list; 0 while nothing shows. */
  stepNumber: number;
  /** How many steps the tour has in total. */
  totalSteps: number;
  /** The tour is walking — true during anchor resolution, before anything
   *  is on screen. */
  isRunning: boolean;
  /** Reached the end at least once. */
  isComplete: boolean;
  /** Dismissed with "Skip" — will not auto-start again. */
  isSkipped: boolean;
  /** Begin, resuming at the persisted position. No-op while running. */
  start: () => void;
  /** Advance past the current step (the "Next" button). */
  next: () => void;
  /**
   * Dismiss for good. Distinct from `pause`: this is the user saying "not
   * this, ever", so the tour stops offering itself.
   */
  skip: () => void;
  /**
   * Put it away for now, keeping the position. Escape does this rather than
   * `skip`, so a mis-keyed Escape costs the user nothing — the tour comes
   * back where it was ("途中離脱後は次回起動でその位置から再開").
   */
  pause: () => void;
  /** Clear all progress and walk from the first step. */
  restart: () => void;
  /**
   * Walk ONE section's steps, starting at its first (#1194 — the Settings
   * launcher's "show me this bit again").
   *
   * A PARTIAL run, and deliberately sealed off from the persisted progress:
   * it writes nothing, so finishing the Materials steps on their own does not
   * mark the whole tour complete, and skipping out of one does not tell the
   * app never to offer the tour again. Neither is a detail — the stored
   * progress is what decides whether a first-run user is ever shown the tour
   * at all, and a "remind me how tags work" click must not be able to spend
   * that.
   *
   * No-op for a section with no steps; the launcher does not offer those.
   */
  startSection: (section: SectionId) => void;
  /**
   * Tell the tour the user did something. A step whose `advanceOn` is
   * `{ kind: "action", event }` moves on when `event` matches; every other
   * step ignores it.
   */
  notifyAction: (event: string) => void;
}

export const TourContext = createContext<TourContextValue | null>(null);
