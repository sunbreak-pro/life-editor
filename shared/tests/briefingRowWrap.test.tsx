import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  BriefingView,
  type BriefingData,
  type BriefingLabels,
} from "../src/components";

/*
 * #1820 — the narrow paper gives「今日のスケジュール」its title column back.
 *
 * The 390px audit measured a 343px row spent as 時刻 63 + タイトル 69 +
 * Routine タグ 69 + 操作 101 + gap 40. Only the title carries `min-w-0`, so it
 * is the only thing that shrinks: a five-character event title broke over two
 * lines and a 22-character todo over three. The 101px belongs to the 44px
 * touch floor #1559 bought, which this change keeps — it moves the cluster to
 * its own line below `md` instead of shrinking it back.
 *
 * jsdom has no layout (CLAUDE.md §7.1), so nothing here re-measures anything.
 * Every assertion pins the CLASS CONTRACT that produces the wrap, the same way
 * briefingTapTargets.test.tsx pins the one that produces the 44px box.
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
  schedule: [
    {
      id: "e1",
      title: "風呂に入る",
      startTime: "21:00",
      isAllDay: false,
      isRoutine: true,
      completed: false,
    },
  ],
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
        week: { title: "WEEK", range: "9/1 – 9/7", placeholder: "This week…" },
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

/** The action cluster a row's 編集 button sits in. */
function clusterOf(name: string): HTMLElement {
  const btn = screen.getByRole("button", { name });
  const cluster = btn.parentElement;
  if (cluster === null) throw new Error(`no cluster around ${name}`);
  return cluster;
}

describe("#1820 — the narrow schedule row wraps its actions", () => {
  it("drops both rows' action cluster to a line of its own below md", () => {
    renderMorning();
    for (const name of [
      `${LABELS.edit}: ${LABELS.jumpToTodos}`,
      `${LABELS.edit}: ${LABELS.jumpToSchedule}`,
    ]) {
      const cluster = clusterOf(name);
      // A flex item asking for the full width cannot share a line.
      expect(cluster).toHaveClass("max-md:w-full", "max-md:justify-end");
      // Desktop is untouched: no width claim, still pinned right by ml-auto.
      expect(cluster).toHaveClass("ml-auto", "flex-shrink-0");
      expect(cluster).not.toHaveClass("w-full");
    }
  });

  it("lets each row wrap on a phone and holds it to one line on Desktop", () => {
    renderMorning();
    for (const name of [
      `${LABELS.edit}: ${LABELS.jumpToTodos}`,
      `${LABELS.edit}: ${LABELS.jumpToSchedule}`,
    ]) {
      const row = clusterOf(name).parentElement;
      if (row === null) throw new Error(`no row around ${name}`);
      expect(row).toHaveClass("flex-wrap", "md:flex-nowrap");
      // The gap is split: the horizontal one is the row's own rhythm, the
      // vertical one only exists once the cluster has wrapped.
      expect(row).toHaveClass("gap-x-3", "gap-y-1");
      // #1442's floor is still the row's height.
      expect(row).toHaveClass("min-h-11");
    }
  });

  it("keeps the 44px floor that cost the title its width", () => {
    renderMorning();
    // The wrap is what pays for the floor now — the floor itself must not
    // have been given back (the #1559 lever named in the Issue).
    for (const name of [
      `${LABELS.edit}: ${LABELS.jumpToTodos}`,
      `${LABELS.delete}: ${LABELS.deleteTodoHint}`,
      `${LABELS.edit}: ${LABELS.jumpToSchedule}`,
      `${LABELS.delete}: ${LABELS.deleteScheduleHint}`,
    ]) {
      expect(screen.getByRole("button", { name })).toHaveClass(
        "max-md:min-h-11",
        "max-md:min-w-11",
      );
    }
  });
});
