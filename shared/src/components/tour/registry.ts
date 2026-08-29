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
 * `briefing-intro` is still the starter row #1122 shipped — its
 * `data-tour-id` is not in the app yet, which is safe rather than broken: a
 * step whose anchor is absent is skipped (see anchor.ts), and a tour that
 * could not show ANY step ends without marking itself complete, so it is
 * still waiting when that anchor arrives.
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
 * calendar, the todo tray — and waits for the write itself via `advanceOn`. The
 * spotlight says where to look; the action decides when the user is done. The
 * two steps whose target IS a durable control (the create pill, the Todo tab)
 * point straight at it.
 *
 * WHAT THE MATERIALS BLOCK ADDS (#1125)
 * =====================================
 * The four `materials-*` rows are #1125, and their anchors ARE in the app.
 * They walk the loop a note actually goes through — make one, write in it,
 * tag it, then use that tag to reach what else carries it — so each one
 * advances on the deed rather than on a "Next" click. Three of the four
 * therefore wait for the host to report the action; the fourth
 * (`materials-tag-follow`) is the payoff and its anchor is CONDITIONAL: the
 * tag filter only renders with more than one tag group to choose between
 * (useNoteListState), so a user with a single tag skips it and the tour still
 * finishes. That is the anchor fallback doing its job, not a hole.
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
    // Completion has several routes (the row's own checkbox, the detail's
    // toggle, the detail's status row), so this points at the surface that
    // holds them all rather than picking one and teaching the others as wrong.
    // It was the Kanban board until #1153 retired it; the tray that replaced
    // it is the same argument on a smaller surface.
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
  {
    id: "materials-note-body",
    section: "materials",
    anchor: "materials-note-body",
    copyKey: "tour.steps.materialsNoteBody",
    // Satisfied by typing, which the host detects from DOM input events with
    // an IME guard — a Japanese conversion raises input on every keystroke of
    // the pre-edit string, and advancing there would move the tour out from
    // under a user who has not committed a character yet.
    advanceOn: { kind: "action", event: "note-typed" },
  },
  {
    id: "materials-note-tag",
    section: "materials",
    anchor: "materials-note-tag",
    copyKey: "tour.steps.materialsNoteTag",
    // Any route counts — the picker or a drag onto a tag heading — because the
    // step teaches "this note now carries a tag", not one particular control.
    advanceOn: { kind: "action", event: "tag-assigned" },
  },
  {
    id: "materials-tag-follow",
    section: "materials",
    anchor: "materials-tag-filter",
    copyKey: "tour.steps.materialsTagFollow",
    advanceOn: { kind: "action", event: "tag-filtered" },
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
