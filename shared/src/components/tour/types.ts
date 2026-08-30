import type { TranslationKey } from "../../i18n/resources";
import type { SectionId } from "../../sections";

/*
 * Tutorial tour vocabulary (#1122).
 *
 * A step is DATA, not a component: which section it belongs to, which element
 * it points at, which catalog entry describes it, and what makes it advance.
 * Keeping it that way is what lets the section Issues (#1121's children) add
 * their own steps by appending to a list instead of touching the runtime.
 *
 * The two typed fields are the whole reason this file exists. `section` is
 * `SectionId` so a step naming a retired section fails where the registry is
 * DEFINED, and `copyKey` is `TranslationKey` so a step whose copy was never
 * translated fails there too — neither can reach the screen as a blank bubble
 * pointing at nothing. `sections.ts:45` types `SectionDef.labelKey` exactly
 * this way for the same reason.
 */

/**
 * What moves the tour off a step.
 *
 * `next` is the plain "I read it" button. `action` waits for the host to
 * report that the user did the thing the step is teaching — the host calls
 * `notifyAction(event)` and the tour advances only for a matching event, so a
 * step that says "create a todo" is satisfied by creating a todo rather than
 * by clicking past it.
 */
export type TourAdvance =
  | { readonly kind: "next" }
  | { readonly kind: "action"; readonly event: string };

export interface TourStep {
  /** Stable id. Persisted as the resume point, so renaming one resets that
   *  user's position rather than corrupting it (see TOUR_STEP_IDS). */
  readonly id: string;
  /** Section the anchor lives in. The tour navigates here before pointing. */
  readonly section: SectionId;
  /** Value of the `data-tour-id` attribute on the element to spotlight.
   *  An ATTRIBUTE, never a coordinate: jsdom has no layout, so a rect-based
   *  anchor would be untestable (CLAUDE.md §7.1 / rules/frontend.md). */
  readonly anchor: string;
  /**
   * Where to point when `anchor` is not in the document (#1250).
   *
   * For the case where the SAME lesson has a different target at a different
   * width — not for "some other step's element will do". A layout can put the
   * control a step teaches behind something that has to be opened first, and
   * then the control is not a durable surface at that width even though it is
   * one at the other. The fallback names the durable surface the lesson still
   * holds on, so the step is shown instead of skipped.
   *
   * Optional and tried second, so nothing changes for a step whose primary
   * anchor is where it always was. Absent on both ⇒ the step is skipped, which
   * is still the fallback #1122 built the probe around.
   */
  readonly fallbackAnchor?: string;
  /** Catalog key for the step's copy. The host resolves it — shared
   *  primitives never call useTranslation (§6.4). */
  readonly copyKey: TranslationKey;
  readonly advanceOn: TourAdvance;
}

/**
 * Persisted tour position.
 *
 * `stepId` is where to resume, kept separate from the two end states so
 * "left half way through" and "finished" cannot be confused for each other:
 * a paused tour resumes where it was, a completed or skipped one does not
 * re-open on its own.
 */
export interface TourProgress {
  /** Step to resume at, or null = start from the beginning. */
  readonly stepId: string | null;
  /** Reached the end of the tour at least once. */
  readonly completed: boolean;
  /** Explicitly dismissed with "Skip" — do not auto-start again. */
  readonly skipped: boolean;
}

/** Nothing seen yet. */
export const EMPTY_TOUR_PROGRESS: TourProgress = {
  stepId: null,
  completed: false,
  skipped: false,
};
