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
      onOpenItem={vi.fn()}
      onAddItem={vi.fn()}
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

/*
 * #1820's wrap was for the row action cluster, and since #2223 the schedule
 * table has no row actions at all — a title opens its editor, deleting is
 * the editor's. What the issue protected still holds there: nothing but the
 * title competes for a cell's width, and the title is the part that shrinks.
 */
describe("#1820 — the schedule table's titles keep their width", () => {
  it("draws no action cluster on a table row", () => {
    renderMorning();
    const table = document.querySelector("table");
    if (table === null) throw new Error("no schedule table");
    // No 編集 ↗ and no 削除 🗑 on any row: only the title and the checkbox.
    expect(
      table.querySelectorAll("tbody svg.lucide-arrow-up-right, tbody svg.lucide-trash-2"),
    ).toHaveLength(0);
  });

  it("lets the title take the cell and shrink before anything else", () => {
    renderMorning();
    for (const name of ["風呂に入る", "Write report"]) {
      expect(screen.getByRole("button", { name })).toHaveClass(
        "min-w-0",
        "flex-1",
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
