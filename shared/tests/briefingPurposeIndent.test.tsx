import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  BriefingView,
  type BriefingData,
  type BriefingLabels,
} from "../src/components";

/*
 * #1821 — the purpose line hangs under its own todo's TITLE, at every root
 * font size.
 *
 * The indent has to clear the same four columns the row above it draws: the
 * time cell (`w-14`), the `gap-3`, the checkbox (`min-w-11`) and the second
 * `gap-3`. All four are rem, so the only honest indent is rem too. Written as
 * `ml-[124px]` it matched exactly one step of the Settings font scale: at the
 * 18px root the columns measured 139.5px and the「◈」started 16px to the left
 * of the title it belongs to.
 *
 * jsdom has no layout (CLAUDE.md §7.1), so this pins the CLASS rather than
 * measuring the offset — which is also the only form that can state the rule
 * ("no px here"), since a px value and a rem value measure the same at the
 * 16px root and a measurement would pass either way.
 */

const LABELS: BriefingLabels = {
  masthead: "BRIEFING",
  focusLabel: "FOCUS",
  aiTitle: "AI",
  aiSource: "Claude",
  noFocus: "No focus",
  goalMark: "Goals:",
  scheduleTitle: "PROMISES",
  addScheduleItem: "Add to today's schedule",
  noSchedule: "Nothing scheduled",
  routineTag: "Routine",
  allDay: "All day",
  carryoverTitle: "CARRYOVER",
  todoStatus: "Status",
  statusNotStarted: "Not started",
  statusDone: "Done",
  edit: "Edit",
  delete: "Delete",
  deleteScheduleHint: "Delete this event",
  deleteTodoHint: "Delete this todo",
  jumpToSchedule: "Open in Schedule",
  jumpToTodos: "Open in Todos",
};

const DATA: BriefingData = {
  dateLine: "2026-09-21",
  briefing: null,
  schedule: [],
  todos: [
    {
      id: "t1",
      title: "Write report",
      status: "NOT_STARTED",
      startTime: "",
      purposes: ["Ship the migration"],
      goals: ["Pass the proposal"],
    },
  ],
  carryover: [],
  sessions: [],
  todoNodes: [],
};

function renderMorning() {
  render(
    <BriefingView
      loading={false}
      data={DATA}
      labels={LABELS}
      focusText={null}
      onToggleTodo={vi.fn()}
      onDeleteScheduleItem={vi.fn()}
      onDeleteTodo={vi.fn()}
      onAddScheduleItem={vi.fn()}
      onJumpToSchedule={vi.fn()}
      onJumpToTodos={vi.fn()}
    />,
  );
}

/** The paragraph carrying the「◈」purpose line. */
function purposeLine(): HTMLElement {
  const mark = screen.getByText(/◈/);
  const line = mark.closest("p");
  if (line === null) throw new Error("no purpose line");
  return line;
}

describe("#1821 — the purpose line's indent follows the columns", () => {
  it("indents in rem, by exactly the four columns above it", () => {
    renderMorning();
    // 3.5rem (w-14) + 0.75 (gap-3) + 2.75 (min-w-11) + 0.75 (gap-3).
    expect(purposeLine().className).toContain("ml-[7.75rem]");
  });

  it("carries no px indent of any kind", () => {
    renderMorning();
    // The whole point: a px indent is right at one root size and wrong at the
    // rest, so the class must not name one at all.
    expect(purposeLine().className).not.toMatch(/ml-\[\d+px\]/);
  });

  it("gives the goal line (#2106) the same indent", () => {
    renderMorning();
    const goalLine = screen.getByText("Pass the proposal").closest("p");
    expect(goalLine?.className).toContain("ml-[7.75rem]");
  });
});
