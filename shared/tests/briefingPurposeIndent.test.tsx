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
 * Since #2223 the todo sits in a cell of the time table, so the indent clears
 * the two columns that now stand before its title: the checkbox (`min-w-11`)
 * and the `gap-1` after it — 2.75 + 0.25 = 3rem, `ml-12`. Both are rem, so the
 * only honest indent is rem too. Written as `ml-[124px]` it matched exactly
 * one step of the Settings font scale and started left of the title at the
 * others.
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
  noSchedule: "Nothing scheduled",
  routineTag: "Routine",
  allDay: "All day",
  timeColumn: "Time",
  eventsColumn: "Events",
  todosColumn: "Todos",
  untimed: "No time",
  ongoing: "Now on",
  nowLine: "Current time",
  columnSwitch: "Columns",
  addEvent: "Add an event",
  addTodo: "Add a todo",
  moreCount: (count: number) => `+${count} more`,
  close: "Close",
  carryoverTitle: "CARRYOVER",
  todoStatus: "Status",
  statusNotStarted: "Not started",
  statusDone: "Done",
  edit: "Edit",
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
      onOpenItem={vi.fn()}
      onAddItem={vi.fn()}
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
  it("indents in rem, by exactly the columns before the title", () => {
    renderMorning();
    // 2.75rem (min-w-11) + 0.25 (gap-1).
    expect(purposeLine().className).toContain("ml-12");
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
    expect(goalLine?.className).toContain("ml-12");
  });
});
