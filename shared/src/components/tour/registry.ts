import type { TourStep } from "./types";

/*
 * The tour's step list (#1122).
 *
 * ONE ordered array, the same shape `sections.ts` uses for the section
 * registry: the order here IS the order the user walks, and everything else
 * (the total, the progress counter, the resume-point validation) is derived.
 * A section Issue adds its step by appending a row, and nothing in the
 * runtime changes.
 *
 * These two are the starter pair. Their `data-tour-id` attributes are NOT in
 * the app yet — putting them on the real elements is each section Issue's job
 * (#1122 Scope says so explicitly). That is deliberately safe rather than
 * broken: a step whose anchor is absent is skipped (see anchor.ts), and a
 * tour that could not show ANY step ends without marking itself complete, so
 * it is still waiting when the anchors arrive.
 */
export const TOUR_STEPS = [
  {
    id: "briefing-intro",
    section: "briefing",
    anchor: "briefing-today",
    copyKey: "tour.steps.briefingIntro",
    advanceOn: { kind: "next" },
  },
  {
    id: "materials-capture",
    section: "materials",
    anchor: "materials-add",
    copyKey: "tour.steps.materialsCapture",
    // Teaching capture: reading about it is not the same as doing it, so this
    // one waits for the host to report a real creation.
    advanceOn: { kind: "action", event: "item-created" },
  },
] as const satisfies readonly TourStep[];

/**
 * Every step id, in walking order — a derived view of the registry for hosts
 * and for section Issues appending to it.
 *
 * The Provider does NOT read this: it validates a persisted resume point
 * against the ids of the step list it was actually given (`TourContext.tsx`
 * builds them from its `steps` prop), so an injected list validates against
 * itself. A stored `stepId` that is not in that list falls back to the start
 * rather than leaving the tour pointing at nothing — the same guard
 * `useStartupSection.ts` applies to a stale section id.
 */
export const TOUR_STEP_IDS: readonly string[] = TOUR_STEPS.map((s) => s.id);
