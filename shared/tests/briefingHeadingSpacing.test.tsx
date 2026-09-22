import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { BriefingVizPanel } from "../src/components/briefing/BriefingVizPanel";
import {
  BriefingView,
  type BriefingData,
  type BriefingLabels,
} from "../src/components";

/*
 * #1826 — two pieces of paper chrome that read wrong at a glance.
 *
 * 1.「きのうまでの自分」sits in the SAME detail well as the todo tray, and that
 *    well is a plain div with no gap of its own: the heading top and the tray
 *    bottom both measured 387px, so the heading looked like the last line of
 *    the todo list rather than the start of its own block.
 * 2. The empty focus line lays its icon and its sentence out with
 *    `items-center`. At 390px the sentence wraps to three lines, so the icon
 *    centred itself against the middle one — a mark beside the second line of
 *    a sentence reads as a bullet on that line.
 *
 * jsdom has no layout (CLAUDE.md §7.1): both assertions pin the class contract
 * that produces the spacing, not the measured pixels.
 */

const LABELS: BriefingLabels = {
  masthead: "BRIEFING",
  focusLabel: "FOCUS",
  aiTitle: "AI",
  aiSource: "Claude",
  noFocus: "No focus written last night",
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
  dateLine: "2026-09-21",
  briefing: null,
  schedule: [],
  todos: [],
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
      intentionText=""
      onIntentionChange={vi.fn()}
      onIntentionBlur={vi.fn()}
      goals={{ week: "", month: "", year: "" }}
      goalLabels={{
        week: { title: "WEEK", range: "9/1 – 9/7", placeholder: "…" },
        month: { title: "MONTH", range: "September", placeholder: "…" },
        year: { title: "YEAR", range: "2026", placeholder: "…" },
      }}
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

describe("#1826 — the detail panel heading stands apart", () => {
  afterEach(cleanup);

  it("puts a rule and padding above the panel heading", () => {
    render(
      <BriefingVizPanel
        sessions={[]}
        todoNodes={[]}
        title="YOU, UP TO YESTERDAY"
        streakLabels={{
          title: "Streaks",
          current: "Current",
          longest: "Longest",
          formatDays: (n: number) => (n === 1 ? "day" : "days"),
          noStreak: "No streak yet",
        }}
        trendLabels={{ title: "Completions", completedCount: "Completed" }}
        balanceLabels={{
          title: "Balance",
          work: "Work",
          break: "Break",
          longBreak: "Long break",
        }}
      />,
    );
    const panel = screen.getByText("YOU, UP TO YESTERDAY").closest("section");
    if (panel === null) throw new Error("no panel section");
    // The well stacks its portals with no gap, so the separation is this
    // block's own: a hairline plus padding wider than its internal gap-3.
    expect(panel).toHaveClass("mt-4", "pt-4", "border-t", "border-lumen-border");
  });
});

describe("#1826 — the empty focus icon leads the sentence", () => {
  afterEach(cleanup);

  it("aligns the icon to the first line, not the middle one", () => {
    renderMorning();
    const line = screen.getByText(LABELS.noFocus).closest("p");
    if (line === null) throw new Error("no focus line");
    expect(line).toHaveClass("items-start");
    expect(line).not.toHaveClass("items-center");
    // 2px down, so the 16px glyph meets the cap height of 20px text rather
    // than its ascender — and never shrinks as the sentence wraps.
    const icon = line.querySelector("svg");
    expect(icon?.getAttribute("class")).toContain("mt-0.5");
    expect(icon?.getAttribute("class")).toContain("shrink-0");
  });
});
