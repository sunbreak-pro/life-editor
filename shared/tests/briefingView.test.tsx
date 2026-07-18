import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  BriefingView,
  type BriefingData,
  type BriefingLabels,
} from "../src/components";

/*
 * BriefingView — pure morning-paper view. Every row (schedule / task /
 * carryover) exposes a title button (toggles completion) plus an icon-only
 * jump button (navigates to the owning section). The circle on schedule rows
 * still toggles too. This suite guards the click routing and the no-nested-
 * button a11y invariant.
 */

const LABELS: BriefingLabels = {
  masthead: "BRIEFING",
  focusLabel: "FOCUS",
  aiTitle: "AI",
  aiSource: "Claude",
  noBriefing: "No briefing",
  intentionTitle: "INTENTION",
  intentionCaption: "Saved",
  intentionPlaceholder: "Declare today…",
  scheduleTitle: "PROMISES",
  noSchedule: "Nothing scheduled",
  routineTag: "Routine",
  allDay: "All day",
  tasksTitle: "TASKS",
  noTasks: "No tasks",
  vizTitle: "VIZ",
  carryoverTitle: "CARRYOVER",
  toggleComplete: "Toggle complete",
  jumpToSchedule: "Open in Schedule",
  jumpToTasks: "Open in Tasks",
};

const STREAK_LABELS = {
  title: "Streak",
  current: "Current",
  longest: "Longest",
  days: "days",
  noStreak: "No streak",
};
const TREND_LABELS = { title: "Trend", completedCount: "Completed" };
const BALANCE_LABELS = {
  title: "Balance",
  work: "Work",
  break: "Break",
  longBreak: "Long break",
};

const DATA: BriefingData = {
  dateLine: "2026-07-16",
  briefing: null,
  schedule: [
    {
      id: "s1",
      title: "Morning standup",
      startTime: "09:00",
      completed: false,
      isRoutine: false,
      isAllDay: false,
    },
    {
      id: "s2",
      title: "Done meeting",
      startTime: "10:00",
      completed: true,
      isRoutine: false,
      isAllDay: false,
    },
  ],
  tasks: [
    { id: "t1", title: "Write report", status: "NOT_STARTED", purposes: [] },
    { id: "t2", title: "Ship feature", status: "DONE", purposes: [] },
  ],
  carryover: [
    { id: "c1", title: "Old todo", daysLabel: "day 3", completed: false },
    {
      id: "c2",
      title: "Finished carryover",
      daysLabel: "day 2",
      completed: true,
    },
  ],
  sessions: [],
  taskNodes: [],
};

function renderView(props?: Partial<Parameters<typeof BriefingView>[0]>) {
  const onToggleScheduleItem = vi.fn();
  const onToggleTask = vi.fn();
  const onJumpToSchedule = vi.fn();
  const onJumpToTasks = vi.fn();
  const onIntentionChange = vi.fn();
  const onIntentionBlur = vi.fn();
  const result = render(
    <BriefingView
      loading={false}
      data={DATA}
      labels={LABELS}
      streakLabels={STREAK_LABELS}
      trendLabels={TREND_LABELS}
      balanceLabels={BALANCE_LABELS}
      intentionText=""
      onIntentionChange={onIntentionChange}
      onIntentionBlur={onIntentionBlur}
      onToggleScheduleItem={onToggleScheduleItem}
      onToggleTask={onToggleTask}
      onJumpToSchedule={onJumpToSchedule}
      onJumpToTasks={onJumpToTasks}
      {...props}
    />,
  );
  return {
    ...result,
    onToggleScheduleItem,
    onToggleTask,
    onJumpToSchedule,
    onJumpToTasks,
    onIntentionChange,
    onIntentionBlur,
  };
}

describe("BriefingView row actions", () => {
  it("toggles a schedule item from its title button (no nav)", () => {
    const { onToggleScheduleItem, onJumpToSchedule } = renderView();
    fireEvent.click(screen.getByRole("button", { name: "Morning standup" }));
    expect(onToggleScheduleItem).toHaveBeenCalledWith("s1");
    expect(onJumpToSchedule).not.toHaveBeenCalled();
  });

  it("toggles a schedule item from its completion circle", () => {
    const { onToggleScheduleItem } = renderView();
    const circles = screen.getAllByRole("button", { name: "Toggle complete" });
    fireEvent.click(circles[0]);
    expect(onToggleScheduleItem).toHaveBeenCalledWith("s1");
  });

  it("jumps to Schedule from the schedule move button (no toggle)", () => {
    const { onJumpToSchedule, onToggleScheduleItem } = renderView();
    const jumps = screen.getAllByRole("button", { name: "Open in Schedule" });
    fireEvent.click(jumps[0]);
    expect(onJumpToSchedule).toHaveBeenCalledTimes(1);
    expect(onToggleScheduleItem).not.toHaveBeenCalled();
  });

  it("strikes through a completed schedule row title", () => {
    renderView();
    expect(
      screen.getByRole("button", { name: "Done meeting" }).className,
    ).toContain("line-through");
  });

  it("toggles a task from its title button (no nav)", () => {
    const { onToggleTask, onJumpToTasks } = renderView();
    fireEvent.click(screen.getByRole("button", { name: /Write report/ }));
    expect(onToggleTask).toHaveBeenCalledWith("t1");
    expect(onJumpToTasks).not.toHaveBeenCalled();
  });

  it("jumps to Tasks from a task move button (no toggle)", () => {
    const { onJumpToTasks, onToggleTask } = renderView();
    // Move buttons for tasks and carryover share the label; the first two are
    // the two task rows.
    const jumps = screen.getAllByRole("button", { name: "Open in Tasks" });
    fireEvent.click(jumps[0]);
    expect(onJumpToTasks).toHaveBeenCalledTimes(1);
    expect(onToggleTask).not.toHaveBeenCalled();
  });

  it("strikes through a DONE task title", () => {
    renderView();
    expect(screen.getByText("Ship feature").className).toContain(
      "line-through",
    );
  });

  it("toggles + jumps from a carryover row and strikes completed ones", () => {
    const { onToggleTask, onJumpToTasks } = renderView();
    fireEvent.click(screen.getByRole("button", { name: /Old todo/ }));
    expect(onToggleTask).toHaveBeenCalledWith("c1");

    const jumps = screen.getAllByRole("button", { name: "Open in Tasks" });
    // task rows (2) then carryover rows (2): the third jump button is c1.
    fireEvent.click(jumps[2]);
    expect(onJumpToTasks).toHaveBeenCalledTimes(1);

    expect(screen.getByText("Finished carryover").className).toContain(
      "line-through",
    );
  });

  it("never nests a button inside another button", () => {
    const { container } = renderView();
    expect(container.querySelectorAll("button button").length).toBe(0);
  });
});

describe("BriefingView intention field (宣言 — Step 4)", () => {
  it("shows the stored declaration and reports edits + blur to the host", () => {
    const { onIntentionChange, onIntentionBlur } = renderView({
      intentionText: "Ship the report",
    });
    const field = screen.getByPlaceholderText("Declare today…");
    expect((field as HTMLTextAreaElement).value).toBe("Ship the report");
    fireEvent.change(field, { target: { value: "Ship the report\nRun" } });
    expect(onIntentionChange).toHaveBeenCalledWith("Ship the report\nRun");
    fireEvent.blur(field);
    expect(onIntentionBlur).toHaveBeenCalledTimes(1);
  });
});
