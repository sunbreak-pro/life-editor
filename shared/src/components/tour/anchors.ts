/*
 * Named anchors and action events for the tour's section steps (#1124).
 *
 * Two halves of the same seam, and both are strings that have to match across
 * files that never import each other: `registry.ts` names an anchor that a
 * component carries, and it names an action event that a host reports. A
 * typo on either side fails the way the tour fails worst — silently, as a step
 * that points at nothing or never advances.
 *
 * `as const` gives the values a literal type, which is what lets the registry
 * rows stay assignable to `TourStep` while every call site spells the string
 * once. This is the same reason `sections.ts` holds its ids in one registry
 * instead of letting each screen name its own.
 *
 * NOT typed as an enum the runtime checks: `TourStep.anchor` stays `string`
 * because an anchor that does not resolve is already a handled case (the step
 * is skipped — see anchor.ts), and #1122's registry deliberately kept the
 * field open so a host outside shared can carry one.
 */

/** `data-tour-id` values, by the element that wears one. */
export const TOUR_ANCHORS = {
  /** Schedule's primary create control — toolbar button (wide) / pill (narrow). */
  scheduleAddEvent: "schedule-add-event",
  /** The calendar surface itself: where a created event can be found again. */
  scheduleCalendar: "schedule-calendar",
  /** The section tab that opens the Todo sheet. */
  scheduleTodoTab: "schedule-todo-tab",
  /** The Todo sheet's create control. */
  scheduleTodoAdd: "schedule-todo-add",
  /** The Todo sheet's list surface. */
  scheduleTodoBoard: "schedule-todo-board",
} as const;

/**
 * Events a host reports through `notifyAction` when the user really did the
 * thing a step is teaching.
 *
 * Namespaced by section so a second section teaching "create something" cannot
 * advance this one's step by accident — `notifyAction` matches on the string
 * alone (TourContext.tsx), so the string is the whole guard.
 *
 * These name COMPLETED WRITES, never openings: "the create panel opened" is
 * not "an event exists", and a step that advanced on the former would let the
 * user walk the whole tour without creating anything, which is the exact
 * failure #1121 set out to avoid ("ボタンを見せるだけで次に進めない").
 */
export const TOUR_ACTIONS = {
  scheduleEventCreated: "schedule:event-created",
  scheduleEventTimeChanged: "schedule:event-time-changed",
  scheduleTodoTabOpened: "schedule:todo-tab-opened",
  scheduleTodoCreated: "schedule:todo-created",
  scheduleTodoCompleted: "schedule:todo-completed",
} as const;
