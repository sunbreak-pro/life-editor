import type { SectionId } from "../../sections";
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
 * `briefing-intro` is #1122's starter row, given a real anchor and real copy
 * by #1201. It had pointed at `briefing-today`, a `data-tour-id` no component
 * ever carried, so the step was skipped on every run — safe rather than
 * broken (a step whose anchor is absent is skipped, see anchor.ts), but never
 * seen. It stays row zero under its original id: the id is what a stored
 * resume point names, so renaming it would reset every user's position.
 *
 * WHAT IT HAS TO SAY (#1201)
 * ==========================
 * Briefing is the one screen the user does not fill in — `write_briefing`
 * over MCP does, which needs the desktop app and Claude Code. Someone on the
 * web alone sees an empty page forever and has no way to tell that apart from
 * a broken one. So this step explains the mechanism rather than pointing at a
 * control, and it is the only `next` step in the list for that reason: there
 * is nothing here to do.
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
    anchor: TOUR_ANCHORS.briefingMorningTab,
    copyKey: "tour.steps.briefingIntro",
    advanceOn: { kind: "next" },
  },
  {
    id: "schedule-create-event",
    section: "schedule",
    anchor: TOUR_ANCHORS.scheduleAddEvent,
    // #1250: the create control is NOT durable on narrow. Wide has it in the
    // toolbar, but #1148 moved the phone's only create route into the detail
    // drawer's heading row — and that drawer starts closed every session
    // (RightSidebarContext seeds `isOpen` false and does not persist it), so
    // `<RightSidebarPortal>` renders nothing and the AddPill is not in the
    // document at all. The probe waited out its 2.5s and skipped the step, on
    // the only width where finding "add an event" is genuinely hard.
    //
    // The calendar is where the lesson still holds there. It is not a stand-in
    // for the button: on narrow, tapping a day IS the first half of creating
    // an event — `selectNarrowDay` moves the anchor day AND opens the drawer
    // on it, which is what puts the AddPill on screen. So the spotlight lands
    // on the surface the user must actually touch first, and the step still
    // advances on the write rather than on any press.
    //
    // A FALLBACK rather than moving the attribute, so the drawer's own pill
    // still wins whenever it IS on screen — a narrow user who had the panel
    // open is pointed at the real control, not at the route to it.
    //
    // Three answers considered and rejected, so they are not re-proposed:
    //   - point at the detail-panel hamburger instead. It carries
    //     `aria-expanded`, so the #1192 stand-down would hide the bubble the
    //     instant the user obeyed it.
    //   - fork the registry by width. `totalSteps` and TOUR_SECTION_IDS are
    //     both derived from this one list, so two lists means two tours.
    //   - let both carriers wear the id and rely on document order. That is
    //     right only by accident — `querySelector` returns the first match in
    //     the document, which no layout promises.
    //
    // What this does NOT fix, and is not this step's to fix: the overlay is
    // z-45 and MobileDrawer is z-50, so once that drawer opens the bubble is
    // painted underneath it. Steps 4/5/6 anchor INSIDE the drawer and are
    // therefore only ever "found" in the state where they cannot be read.
    fallbackAnchor: TOUR_ANCHORS.scheduleCalendar,
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

/**
 * The sections a step list can actually teach, in walking order (#1194).
 *
 * Takes the list rather than reading the registry so the Provider's injected
 * `steps` and the shipping registry derive the same way — a test that hands in
 * two Materials steps gets `["materials"]`, not the shipping menu.
 */
export function tourSectionIds(
  steps: readonly TourStep[],
): readonly SectionId[] {
  const seen: SectionId[] = [];
  for (const step of steps) {
    if (!seen.includes(step.section)) seen.push(step.section);
  }
  return seen;
}

/**
 * Sections the shipping tour can start in — what the Settings launcher offers
 * as pickable (#1194).
 *
 * DERIVED, never hand-listed. The launcher's menu is exactly "what the tour
 * can teach", and a parallel literal would go stale the moment a section Issue
 * appends a row: the same non-duplication rule CLAUDE.md §0 states for counts,
 * applied to a set. Order follows the registry, so the menu reads in the order
 * the full walkthrough walks.
 */
export const TOUR_SECTION_IDS: readonly SectionId[] = tourSectionIds(TOUR_STEPS);
