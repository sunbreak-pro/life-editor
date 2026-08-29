import { TOUR_ACTIONS, TOUR_ANCHORS } from "./anchors";
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
 * `briefing-intro` and `materials-capture` are #1122's starter pair. The first
 * still has no `data-tour-id` in the app (Briefing is outside #1121's initial
 * scope) and the second waits on #1125. That is deliberately safe rather than
 * broken: a step whose anchor is absent is skipped (see anchor.ts), and a
 * tour that could not show ANY step ends without marking itself complete, so
 * it is still waiting when the anchors arrive.
 *
 * WHY THE SCHEDULE BLOCK IS SHAPED THE WAY IT IS (#1124)
 * ======================================================
 * An anchor has to be ON SCREEN when its step becomes current — the Provider
 * probes for it and gives up after a wall-clock deadline, skipping the step.
 * That rules out anchoring a step on something the step itself asks the user
 * to summon: "open the event you just made and change its time" cannot point
 * at a field inside the editor, because the editor is shut at the moment the
 * step starts and the probe would have timed out long before the user opened
 * it.
 *
 * So each step points at the DURABLE surface the action happens on — the
 * calendar, the board — and waits for the write itself via `advanceOn`. The
 * spotlight says where to look; the action decides when the user is done. The
 * two steps whose target IS a durable control (the create pill, the Todo tab)
 * point straight at it.
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
    id: "schedule-create-event",
    section: "schedule",
    anchor: TOUR_ANCHORS.scheduleAddEvent,
    copyKey: "tour.steps.scheduleCreateEvent",
    advanceOn: { kind: "action", event: TOUR_ACTIONS.scheduleEventCreated },
  },
  {
    // Anchored on the calendar, not on the editor: see the block comment.
    id: "schedule-adjust-event",
    section: "schedule",
    anchor: TOUR_ANCHORS.scheduleCalendar,
    copyKey: "tour.steps.scheduleAdjustEvent",
    advanceOn: { kind: "action", event: TOUR_ACTIONS.scheduleEventTimeChanged },
  },
  {
    id: "schedule-open-todos",
    section: "schedule",
    anchor: TOUR_ANCHORS.scheduleTodoTab,
    copyKey: "tour.steps.scheduleOpenTodos",
    advanceOn: { kind: "action", event: TOUR_ACTIONS.scheduleTodoTabOpened },
  },
  {
    id: "schedule-create-todo",
    section: "schedule",
    anchor: TOUR_ANCHORS.scheduleTodoAdd,
    copyKey: "tour.steps.scheduleCreateTodo",
    advanceOn: { kind: "action", event: TOUR_ACTIONS.scheduleTodoCreated },
  },
  {
    // Completion has several routes (drag to Done, the detail's status row),
    // so this points at the surface that holds them all rather than picking
    // one and teaching the others as wrong.
    id: "schedule-complete-todo",
    section: "schedule",
    anchor: TOUR_ANCHORS.scheduleTodoBoard,
    copyKey: "tour.steps.scheduleCompleteTodo",
    advanceOn: { kind: "action", event: TOUR_ACTIONS.scheduleTodoCompleted },
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
