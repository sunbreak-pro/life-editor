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
  /**
   * Briefing's 朝刊 tab, in the section's tab band (#1201).
   *
   * The band rather than anything inside the page, because the page is the
   * one part that is NOT dependable: BriefingView returns a skeleton with no
   * masthead while it loads, and the tab defaults to 夕刊 after 17:00, which
   * renders a different view entirely. The band is drawn from the section
   * descriptor, so it is there at both widths, in both tabs, and before any
   * data arrives. Exactly one control carries it at a time — AppShell renders
   * its header slot only when wide, and the narrow segmented control only
   * when not.
   */
  briefingMorningTab: "briefing-morning-tab",
  /** Schedule's primary create control — toolbar button (wide) / pill (narrow). */
  scheduleAddEvent: "schedule-add-event",
  /** The calendar surface itself: where a created event can be found again. */
  scheduleCalendar: "schedule-calendar",
  /**
   * The tab that opens the todos — the Schedule sidebar's switcher since
   * #1153 retired the section's own Todo tab.
   */
  scheduleTodoTab: "schedule-todo-tab",
  /** The todo tray's create control. */
  scheduleTodoAdd: "schedule-todo-add",
  /**
   * The todo tray's list surface. Named `...Board` for the Kanban board it
   * pointed at first (#1124); the value it carries is what the registry and
   * the tray agree on, so it is left alone rather than renamed across both.
   */
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
