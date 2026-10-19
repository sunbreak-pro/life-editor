import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  BriefingCarryoverPanel,
  BriefingView,
  EveningView,
  type BriefingData,
  type BriefingLabels,
} from "../src/components";
import { EVENING_LABELS, emptyEveningBlocks } from "./helpers/eveningFixtures";

/*
 * #1559 — the 44px touch floor on the BRIEFING lane's own controls.
 *
 * The 390px audit (#1512) measured three targets on the papers themselves: the
 * 夕刊 mood stars at 35×35, the「今日のスケジュールに追加」+ at 31.5 tall, and a
 * todo row's 編集 / 削除 at the same 31.5. The shared chrome around them was
 * settled in #1556 (shared/tests/sharedTapTargets.test.tsx); this file is that
 * suite's per-section twin and asserts nothing outside briefing/.
 *
 * jsdom has no layout (CLAUDE.md §7.1), so none of this re-measures anything:
 * every assertion pins the CLASS CONTRACT that produces the size, exactly as
 * sharedTapTargets.test.tsx and web/tests/taskListCheckboxSize.test.ts do.
 *
 * Each case has a Desktop half, because all three controls are drawn by ONE
 * component at every width. A bare `min-h-11` would grow the mouse-sized box
 * too, so the floors are `max-md:`-prefixed and the painted padding is pinned
 * beside them.
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
  dateLine: "2026-09-06",
  briefing: null,
  schedule: [],
  todos: [
    {
      id: "t1",
      title: "Write report",
      status: "NOT_STARTED",
      startTime: "",
      purposes: [],
    },
  ],
  carryover: [
    { id: "c1", title: "Old todo", daysLabel: "3日目", completed: false },
  ],
  sessions: [],
  todoNodes: [],
};

// The paper and, beside it, the carryover block it keeps in the panel (#2285).
function renderMorning() {
  render(
    <>
      <BriefingView
        loading={false}
        data={DATA}
        labels={LABELS}
        focusText={null}
        onToggleTodo={vi.fn()}
        onOpenItem={vi.fn()}
        onAddItem={vi.fn()}
      />
      <BriefingCarryoverPanel
        loading={false}
        entries={DATA.carryover}
        labels={LABELS}
        onToggleTodo={vi.fn()}
        onJumpToTodos={vi.fn()}
      />
    </>,
  );
}

function renderEvening(mood: number | null) {
  render(
    <EveningView
      loading={false}
      dateLine="2026-09-06"
      mood={mood}
      onSelectMood={vi.fn()}
      editorSlot={<div>editor</div>}
      focusText=""
      onFocusChange={vi.fn()}
      onFocusBlur={vi.fn()}
      labels={EVENING_LABELS}
      {...emptyEveningBlocks()}
    />,
  );
}

describe("#1559 — the briefing papers' own controls meet the 44px floor", () => {
  it("floors all five 夕刊 mood stars, filled and empty alike", () => {
    // mood=2 so the row renders BOTH className branches: the floor lives in a
    // shared base and a copy-paste that only reached one branch would leave
    // three of the five stars at 35px.
    renderEvening(2);
    for (const n of [1, 2, 3, 4, 5]) {
      const star = screen.getByRole("button", { name: `Mood ${n}/5` });
      expect(star).toHaveClass("max-md:min-h-11", "max-md:min-w-11");
      // Without centring the glyph would sit against the box's leading edge
      // as soon as the box is wider than the 26px star.
      expect(star).toHaveClass("inline-flex", "items-center", "justify-center");
      // Desktop: the painted 34px box (26px glyph in p-1) is untouched.
      expect(star).toHaveClass("p-1");
      expect(star).not.toHaveClass("min-h-11");
      expect(star).not.toHaveClass("min-w-11");
    }
  });

  it("floors each column's「+」without moving the heading's rule (#2223)", () => {
    renderMorning();
    for (const name of [LABELS.addEvent, LABELS.addTodo]) {
      const add = screen.getByRole("button", { name });
      // Width grows the box — a heading has slack the label was not using.
      expect(add).toHaveClass("max-md:min-w-11", "justify-center");
      // Height does NOT: TAP_TARGET_TALL hangs an invisible 44px ::after over
      // a box that stays 26px tall, so the hairline under the headings holds.
      expect(add).toHaveClass("relative", "after:h-11", "after:inset-x-0");
      // Desktop: the 26×26 box #623 chose, unchanged in both directions.
      expect(add).toHaveClass("p-1.5");
      expect(add).not.toHaveClass("min-h-11");
      expect(add).not.toHaveClass("min-w-11");
    }
  });

  it("floors the column switch on a phone only", () => {
    renderMorning();
    for (const name of [LABELS.eventsColumn, LABELS.todosColumn]) {
      const btn = screen.getByRole("button", { name });
      expect(btn).toHaveClass("max-md:min-h-11");
      expect(btn).not.toHaveClass("min-h-11");
    }
  });

  it("floors a carryover row's 編集 by growing the box, not by ::after", () => {
    renderMorning();
    const btn = screen.getByRole("button", {
      name: `${LABELS.edit}: ${LABELS.jumpToTodos}`,
    });
    expect(btn).toHaveClass("max-md:min-h-11", "max-md:min-w-11");
    expect(btn).toHaveClass("justify-center");
    expect(btn).not.toHaveClass("after:h-11");
    // Desktop: same padding and type step as before the floor.
    expect(btn).toHaveClass("px-1.5", "py-1", "text-xs");
    expect(btn).not.toHaveClass("min-h-11");
    expect(btn).not.toHaveClass("min-w-11");
    // #1514: the word stays hidden below `md`.
    expect(btn.querySelector("span")).toHaveClass("hidden", "md:inline");
  });
});
