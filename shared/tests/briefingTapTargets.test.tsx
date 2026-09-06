import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  BriefingView,
  EveningView,
  type BriefingData,
  type BriefingLabels,
  type EveningLabels,
} from "../src/components";

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
  intentionTitle: "INTENTION",
  intentionCaption: "Saved",
  intentionPlaceholder: "Declare today…",
  goalsTitle: "GOALS",
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
  carryover: [],
  sessions: [],
  todoNodes: [],
};

const GOAL_LABELS = {
  week: { title: "WEEK", range: "9/1 – 9/7", placeholder: "This week…" },
  month: { title: "MONTH", range: "September", placeholder: "This month…" },
  year: { title: "YEAR", range: "2026", placeholder: "This year…" },
};

function renderMorning() {
  render(
    <BriefingView
      loading={false}
      data={DATA}
      labels={LABELS}
      focusText={null}
      intentionText=""
      onIntentionChange={vi.fn()}
      onIntentionBlur={vi.fn()}
      goals={{ week: "", month: "", year: "" }}
      goalLabels={GOAL_LABELS}
      onGoalChange={vi.fn()}
      onGoalBlur={vi.fn()}
      onToggleTodo={vi.fn()}
      onDeleteScheduleItem={vi.fn()}
      onDeleteTodo={vi.fn()}
      onAddScheduleItem={vi.fn()}
      onJumpToSchedule={vi.fn()}
      onJumpToTodos={vi.fn()}
    />,
  );
}

const EVENING_LABELS: EveningLabels = {
  masthead: "EVENING",
  moodTitle: "MOOD",
  moodStars: [1, 2, 3, 4, 5].map((n) => `Mood ${n}/5`),
  intentionTitle: "INTENTION",
  intentionCaption: "Unsaved",
  intentionPlaceholder: "Declare today…",
  reflectionTitle: "CLOSING",
  savedCaption: "Saved",
  focusTitle: "TOMORROW'S FOCUS",
  focusPlaceholder: "Tomorrow's one thing…",
  todosTitle: "REMAINING",
  noTodos: "No todos",
  todoStatus: "Status",
  statusNotStarted: "Not started",
  statusDone: "Done",
  upcomingTitle: "UPCOMING",
  noUpcoming: "Nothing upcoming",
  tomorrowTag: "Tomorrow",
  allDay: "All day",
};

function renderEvening(mood: number | null) {
  render(
    <EveningView
      loading={false}
      dateLine="2026-09-06"
      mood={mood}
      onSelectMood={vi.fn()}
      editorSlot={<div>editor</div>}
      intentionText=""
      intentionEditable={false}
      onIntentionChange={vi.fn()}
      onIntentionBlur={vi.fn()}
      focusText=""
      onFocusChange={vi.fn()}
      onFocusBlur={vi.fn()}
      todos={[]}
      onSetTodoStatus={vi.fn()}
      schedule={[]}
      labels={EVENING_LABELS}
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

  it("floors 「今日のスケジュールに追加」without moving the heading's rule", () => {
    renderMorning();
    const add = screen.getByRole("button", {
      name: LABELS.addScheduleItem,
    });
    // Width grows the box — a heading has slack the h3 was not using.
    expect(add).toHaveClass("max-md:min-w-11", "justify-center");
    // Height does NOT: TAP_TARGET_TALL hangs an invisible 44px ::after over a
    // box that stays 26px tall, so the hairline under the heading holds still.
    expect(add).toHaveClass("relative", "after:h-11", "after:inset-x-0");
    // Desktop: the 26×26 box #623 chose, unchanged in both directions.
    expect(add).toHaveClass("p-1.5");
    expect(add).not.toHaveClass("min-h-11");
    expect(add).not.toHaveClass("min-w-11");
  });

  it("floors a todo row's 編集 / 削除 by growing the boxes, not by ::after", () => {
    renderMorning();
    const row: [string, string][] = [
      ["Edit", LABELS.jumpToTodos],
      ["Delete", LABELS.deleteTodoHint],
    ];
    for (const [label, hint] of row) {
      const btn = screen.getByRole("button", { name: `${label}: ${hint}` });
      expect(btn).toHaveClass("max-md:min-h-11", "max-md:min-w-11");
      expect(btn).toHaveClass("justify-center");
      /*
       * The pair sits `gap-0.5` apart, so the shared TAP_TARGET_TALL trick is
       * the wrong one here: a 44px extension on each would overlap in the 2px
       * between them and a tap meant for 編集 could answer 削除.
       */
      expect(btn).not.toHaveClass("after:h-11");
      // Desktop: same padding and type step as before the floor.
      expect(btn).toHaveClass("px-1.5", "py-1", "text-xs");
      expect(btn).not.toHaveClass("min-h-11");
      expect(btn).not.toHaveClass("min-w-11");
      // #1514 is not undone in passing: the words stay hidden below `md`, so
      // the title keeps the larger half of the width that change won back.
      expect(btn.querySelector("span")).toHaveClass("hidden", "md:inline");
    }
  });
});
