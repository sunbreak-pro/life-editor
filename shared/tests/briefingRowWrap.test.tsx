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

function renderMorning(data: BriefingData = DATA) {
  render(
    <BriefingView
      loading={false}
      data={data}
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

/*
 * #2182 — the carryover row shares `RowActions`, so it inherited the
 * full-width cluster #1820 gave the narrow paper, but not the `flex-wrap` that
 * lets the cluster leave the line. The 390px screen squeezed the title button
 * to 0px: one character per line, with 編集 pushed past the right edge.
 */
describe("#2182 — the narrow carryover row wraps its action too", () => {
  function renderWithCarryover() {
    renderMorning({
      ...DATA,
      schedule: [],
      todos: [],
      carryover: [
        {
          id: "c1",
          title: "長めの繰り越しタスクの題を最後まで読める形で出す",
          daysLabel: "3日目",
          completed: false,
        },
      ],
    });
  }

  function carryoverRow(): HTMLElement {
    const row = screen
      .getByText("長めの繰り越しタスクの題を最後まで読める形で出す")
      .closest("li");
    if (row === null) throw new Error("no carryover row");
    return row;
  }

  it("lets the row wrap on a phone and holds it to one line on Desktop", () => {
    renderWithCarryover();
    const row = carryoverRow();
    expect(row).toHaveClass("flex-wrap", "md:flex-nowrap");
    expect(row).toHaveClass("gap-x-3", "gap-y-1");
    // The cluster is the same full-width one the rows above use.
    const cluster = clusterOf(`${LABELS.edit}: ${LABELS.jumpToTodos}`);
    expect(cluster.parentElement).toBe(row);
    expect(cluster).toHaveClass("max-md:w-full");
  });

  it("keeps the title on the first line beside its checkbox", () => {
    renderWithCarryover();
    const title = screen
      .getByText("長めの繰り越しタスクの題を最後まで読める形で出す")
      .closest("button");
    if (title === null) throw new Error("no title button");
    // A 0 basis below md: the title cannot wrap down as an item of its own.
    expect(title).toHaveClass("min-w-0", "max-md:flex-1");
    expect(title).not.toHaveClass("flex-1");
  });
});
