import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  BriefingView,
  BriefingVizPanel,
  EveningView,
  type BriefingData,
  type BriefingLabels,
  type EveningLabels,
} from "../src/components";

/*
 * BriefingView — pure morning-paper view. Every row (schedule / todo /
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
  todos: [
    {
      id: "t1",
      title: "Write report",
      status: "NOT_STARTED",
      startTime: "",
      purposes: [],
    },
    {
      id: "t2",
      title: "Ship feature",
      status: "DONE",
      startTime: "",
      purposes: [],
    },
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
  todoNodes: [],
};

const GOAL_LABELS = {
  week: { title: "WEEK", range: "8/10 – 8/16", placeholder: "This week…" },
  month: { title: "MONTH", range: "August", placeholder: "This month…" },
  year: { title: "YEAR", range: "2026", placeholder: "This year…" },
};

const NO_GOALS = { week: "", month: "", year: "" };

function renderView(props?: Partial<Parameters<typeof BriefingView>[0]>) {
  const onToggleTodo = vi.fn();
  const onDeleteScheduleItem = vi.fn();
  const onDeleteTodo = vi.fn();
  const onAddScheduleItem = vi.fn();
  const onJumpToSchedule = vi.fn();
  const onJumpToTodos = vi.fn();
  const onIntentionChange = vi.fn();
  const onIntentionBlur = vi.fn();
  const onGoalChange = vi.fn();
  const onGoalBlur = vi.fn();
  const result = render(
    <BriefingView
      loading={false}
      data={DATA}
      labels={LABELS}
      focusText={null}
      intentionText=""
      onIntentionChange={onIntentionChange}
      onIntentionBlur={onIntentionBlur}
      goals={NO_GOALS}
      goalLabels={GOAL_LABELS}
      onGoalChange={onGoalChange}
      onGoalBlur={onGoalBlur}
      onToggleTodo={onToggleTodo}
      onDeleteScheduleItem={onDeleteScheduleItem}
      onDeleteTodo={onDeleteTodo}
      onAddScheduleItem={onAddScheduleItem}
      onJumpToSchedule={onJumpToSchedule}
      onJumpToTodos={onJumpToTodos}
      {...props}
    />,
  );
  return {
    ...result,
    onToggleTodo,
    onDeleteScheduleItem,
    onDeleteTodo,
    onAddScheduleItem,
    onJumpToSchedule,
    onJumpToTodos,
    onIntentionChange,
    onIntentionBlur,
    onGoalChange,
    onGoalBlur,
  };
}

/** The row <li> that prints `title` — todo, event and carryover rows alike. */
function rowOf(title: string): HTMLElement {
  const li = screen.getByText(title).closest("li");
  if (li === null) throw new Error(`no row prints "${title}"`);
  return li;
}

/** That row's status checkbox. Scoped to the row because the paper now draws
 *  one on the today's-schedule todo rows as well (#1442), so a document-wide
 *  getAllByRole("checkbox") no longer identifies a row by its index. */
function checkboxIn(title: string): HTMLElement {
  const box = rowOf(title).querySelector('[role="checkbox"]');
  if (box === null) throw new Error(`the "${title}" row has no checkbox`);
  return box as HTMLElement;
}

/*
 * #1368 — the carryover rows' date column and their checkbox.
 *
 * The label is「3日目」on one row and「12日目」on the next. It used to size
 * itself, so every row handed the checkbox after it a different left edge and
 * the column of boxes stepped sideways down the list. jsdom has no layout, so
 * these cases pin the two structural facts that make the edges line up rather
 * than measuring them: one width, declared once, for every row.
 */
describe("BriefingView carryover date column (#1368)", () => {
  const MIXED = [
    { id: "c1", title: "One digit", daysLabel: "day 3", completed: false },
    { id: "c2", title: "Two digits", daysLabel: "day 12", completed: true },
  ];

  function renderMixed() {
    return renderView({ data: { ...DATA, carryover: MIXED } });
  }

  it("holds the date column at one width for a 1- and a 2-digit day", () => {
    renderMixed();
    const oneDigit = screen.getByText("day 3");
    const twoDigits = screen.getByText("day 12");
    // Identical classes AND a fixed width: either alone would let the column
    // grow with its text, which is the whole defect.
    expect(oneDigit.className).toBe(twoDigits.className);
    expect(oneDigit.className).toContain("w-14");
    expect(oneDigit.className).toContain("flex-shrink-0");
    // 1 is narrower than 2 in a proportional face — the digits must not shift
    // the label's own text either.
    expect(oneDigit.className).toContain("tabular-nums");
  });

  it("starts the checkbox right after that column on both rows", () => {
    renderMixed();
    for (const label of [
      screen.getByText("day 3"),
      screen.getByText("day 12"),
    ]) {
      expect(label.nextElementSibling?.getAttribute("role")).toBe("checkbox");
    }
  });

  it("draws the shared todo checkbox, at its touch target", () => {
    renderMixed();
    expect(checkboxIn("One digit").getAttribute("aria-checked")).toBe("false");
    expect(checkboxIn("Two digits").getAttribute("aria-checked")).toBe("true");
    for (const title of ["One digit", "Two digits"]) {
      // mobile-scope.md: 44px is the floor. The 16px box it replaced was the
      // other half of「小さくて見づらい」.
      expect(checkboxIn(title).className).toContain("min-h-11");
    }
  });

  it("toggles from the checkbox, not only from the title", () => {
    const { onToggleTodo } = renderMixed();
    fireEvent.click(checkboxIn("One digit"));
    expect(onToggleTodo).toHaveBeenCalledExactlyOnceWith("c1");
  });
});

/*
 * #1442 — one page, two kinds of checkbox. #1368 moved the carryover rows onto
 * the shared <TodoStatusCheckbox>, but the todo rows inside 「今日のスケジュール」
 * kept a 16px box drawn by hand, so the reader met both within one screen. Both
 * kinds of row now draw the shared control, and because that control carries
 * the 44px touch floor the event rows beside it claim the same minimum — a
 * merged list (#939) that stepped down at the hairline would just move the
 * inconsistency rather than remove it.
 */
describe("One checkbox on the whole paper (#1442)", () => {
  it("draws the shared control on a today's-schedule todo row", () => {
    renderView();
    const box = checkboxIn("Write report");
    expect(box.getAttribute("aria-checked")).toBe("false");
    // The accessible name says which row it is about, what it sets, and where
    // that stands — see the #1486 suite below for the row half of it.
    expect(box.getAttribute("aria-label")).toBe(
      "Write report — Status: Not started",
    );
    expect(box.className).toContain("min-h-11");
  });

  it("reports a DONE todo as checked", () => {
    renderView();
    expect(checkboxIn("Ship feature").getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("gives the todo row and the carryover row the same control", () => {
    renderView();
    // Identical class lists: the same component with the same props, not a
    // lookalike that happens to measure 44px today. Both are NOT_STARTED in
    // the fixture, so any difference is the styling, not the status.
    expect(checkboxIn("Write report").className).toBe(
      checkboxIn("Old todo").className,
    );
  });

  it("toggles the todo from its own checkbox", () => {
    const { onToggleTodo } = renderView();
    fireEvent.click(checkboxIn("Write report"));
    // Same write path as before (#1368's onSetStatus split does not reach the
    // paper): one call, the row's own id, nothing else.
    expect(onToggleTodo).toHaveBeenCalledExactlyOnceWith("t1");
  });

  it("keeps the title button toggling too", () => {
    const { onToggleTodo } = renderView();
    fireEvent.click(screen.getByRole("button", { name: /Write report/ }));
    expect(onToggleTodo).toHaveBeenCalledExactlyOnceWith("t1");
  });

  it("holds one row height across the merged list", () => {
    renderView();
    // jsdom has no layout (CLAUDE.md §7.1), so the floor is pinned as the
    // declaration both kinds of row carry rather than measured.
    const todoRow = rowOf("Write report").querySelector("div");
    expect(todoRow?.className).toContain("min-h-11");
    // An event row has no control at all (#1373) — without the same floor the
    // list would shrink by ~18px the moment the todos ran out.
    expect(rowOf("Morning standup").className).toContain("min-h-11");
  });

  it("leaves no hand-rolled 16px box behind", () => {
    const { container } = renderView();
    expect(container.querySelectorAll("span.h-4.w-4")).toHaveLength(0);
  });
});

/*
 * #1486 — the row's checkbox says WHICH todo it checks.
 *
 * PR #1449 (#1442) gave these rows the shared control, so `role="checkbox"` and
 * `aria-checked` have been right since. What stayed wrong is the name: the
 * control announced "Status: Not started" and nothing else, so a paper printing
 * five todos put five identical checkboxes in front of a reader who cannot see
 * the titles beside them. The row's own title now leads the name.
 *
 * The title button next to it keeps toggling (#1442 decided that deliberately)
 * — it is a mouse affordance, and it carries the title as its own name, so the
 * row no longer has a control whose purpose the user has to guess.
 */
describe("Today's-schedule todo checkbox names its row (#1486)", () => {
  it("leads with the todo's title, then what the control sets", () => {
    renderView();
    expect(checkboxIn("Write report").getAttribute("aria-label")).toBe(
      "Write report — Status: Not started",
    );
  });

  it("reports a finished todo's status in that same name", () => {
    renderView();
    const box = checkboxIn("Ship feature");
    expect(box.getAttribute("aria-label")).toBe("Ship feature — Status: Done");
    expect(box.getAttribute("aria-checked")).toBe("true");
  });

  it("tells the two todo rows apart by name alone", () => {
    renderView();
    // The regression this file guards: before #1486 both of these read the
    // same string, so the name could not identify the row at all.
    expect(checkboxIn("Write report").getAttribute("aria-label")).not.toBe(
      checkboxIn("Ship feature").getAttribute("aria-label"),
    );
  });

  it("keeps the hover tooltip on the status alone", () => {
    renderView();
    // The sighted user already has the title on the row; repeating it in the
    // tooltip would just cover the row with the text next to it.
    expect(checkboxIn("Write report").getAttribute("title")).toBe(
      "Not started",
    );
  });

  it("leaves a control that names no row untouched", () => {
    renderView();
    // The carryover rows pass no itemName, so the shared component still
    // produces the short form — the prop is opt-in, not a silent rewrite of
    // every checkbox in the app.
    expect(checkboxIn("Old todo").getAttribute("aria-label")).toBe(
      "Status: Not started",
    );
  });
});

describe("BriefingView row actions", () => {
  it("gives a schedule row no completion control and no strikethrough (#1373)", () => {
    // An event has no "done" any more. "Done meeting" is completed: true in
    // the fixture — the flag the MCP tool still writes — and the paper must
    // neither strike it nor offer a way to flip it.
    renderView();
    expect(
      screen.queryByRole("button", { name: "Toggle complete" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Morning standup" })).toBeNull();
    expect(screen.getByText("Done meeting").className).not.toContain(
      "line-through",
    );
  });

  it("jumps to Schedule from the schedule move button", () => {
    const { onJumpToSchedule } = renderView();
    const jumps = screen.getAllByTitle("Open in Schedule");
    fireEvent.click(jumps[0]);
    expect(onJumpToSchedule).toHaveBeenCalledTimes(1);
  });

  it("toggles a todo from its title button (no nav)", () => {
    const { onToggleTodo, onJumpToTodos } = renderView();
    fireEvent.click(screen.getByRole("button", { name: /Write report/ }));
    expect(onToggleTodo).toHaveBeenCalledWith("t1");
    expect(onJumpToTodos).not.toHaveBeenCalled();
  });

  it("jumps to Todos from a todo move button (no toggle)", () => {
    const { onJumpToTodos, onToggleTodo } = renderView();
    // Move buttons for todos and carryover share the label; the first two are
    // the two todo rows.
    const jumps = screen.getAllByTitle("Open in Todos");
    fireEvent.click(jumps[0]);
    expect(onJumpToTodos).toHaveBeenCalledTimes(1);
    expect(onToggleTodo).not.toHaveBeenCalled();
  });

  it("strikes through a DONE todo title", () => {
    renderView();
    expect(screen.getByText("Ship feature").className).toContain(
      "line-through",
    );
  });

  it("toggles + jumps from a carryover row and strikes completed ones", () => {
    const { onToggleTodo, onJumpToTodos } = renderView();
    fireEvent.click(screen.getByRole("button", { name: /Old todo/ }));
    expect(onToggleTodo).toHaveBeenCalledWith("c1");

    const jumps = screen.getAllByTitle("Open in Todos");
    // todo rows (2) then carryover rows (2): the third jump button is c1.
    fireEvent.click(jumps[2]);
    expect(onJumpToTodos).toHaveBeenCalledTimes(1);

    expect(screen.getByText("Finished carryover").className).toContain(
      "line-through",
    );
  });

  it("opens the host's creation panel from the schedule heading + (#623)", () => {
    const { onAddScheduleItem, onJumpToSchedule } = renderView();
    const add = screen.getByRole("button", {
      name: "Add to today's schedule",
    });
    fireEvent.click(add);
    expect(onAddScheduleItem).toHaveBeenCalledTimes(1);
    expect(onJumpToSchedule).not.toHaveBeenCalled();
  });

  it("keeps the + reachable when the day has nothing scheduled (#623)", () => {
    const { onAddScheduleItem } = renderView({
      // Both halves of the merged block are empty (#939) — that is what the
      // empty state now means.
      data: { ...DATA, schedule: [], todos: [] },
    });
    // The empty state is exactly when the button matters most — it must not
    // ride along with the row list.
    expect(screen.getByText("Nothing scheduled")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Add to today's schedule" }),
    );
    expect(onAddScheduleItem).toHaveBeenCalledTimes(1);
  });

  it("deletes a schedule row without navigating (#585)", () => {
    const { onDeleteScheduleItem, onJumpToSchedule } = renderView();
    const deletes = screen.getAllByTitle("Delete this event");
    expect(deletes).toHaveLength(2);
    fireEvent.click(deletes[0]);
    expect(onDeleteScheduleItem).toHaveBeenCalledWith("s1");
    expect(onJumpToSchedule).not.toHaveBeenCalled();
  });

  it("deletes a todo row without toggling or navigating (#585)", () => {
    const { onDeleteTodo, onToggleTodo, onJumpToTodos } = renderView();
    const deletes = screen.getAllByTitle("Delete this todo");
    // Todo rows only — carryover keeps the jump alone.
    expect(deletes).toHaveLength(2);
    fireEvent.click(deletes[1]);
    expect(onDeleteTodo).toHaveBeenCalledWith("t2");
    expect(onToggleTodo).not.toHaveBeenCalled();
    expect(onJumpToTodos).not.toHaveBeenCalled();
  });

  it("names every delete button by its visible label first (WCAG 2.5.3)", () => {
    renderView();
    // The visible text is「削除」/ "Delete"; the accessible name leads with it
    // and only then says which row it acts on.
    const byName = screen.getAllByRole("button", {
      name: "Delete: Delete this event",
    });
    expect(byName).toHaveLength(2);
    expect(byName[0].textContent).toContain("Delete");
  });

  it("never nests a button inside another button", () => {
    const { container } = renderView();
    expect(container.querySelectorAll("button button").length).toBe(0);
  });
});

/*
 * #939 — 「今日の Todo と、その目的」is gone as a block of its own: the todo rows
 * moved into 「今日のスケジュール」, above the all-day items, with a hairline
 * between the two kinds of row. The order (todos → rule → all-day → timed) and
 * the two empty states are the whole contract, so they are pinned by DOM order
 * rather than by geometry (jsdom has no layout — CLAUDE.md §7.1).
 */
describe("Merged today's-schedule block (#939)", () => {
  /** The one <ul> of the block headed by `scheduleTitle`. */
  function scheduleList(): HTMLUListElement {
    const section = screen.getByText("PROMISES").closest("section");
    const list = section?.querySelector("ul");
    if (list === null || list === undefined) {
      throw new Error("the schedule block has no row list");
    }
    return list;
  }

  /** Row texts in DOM order; the hairline reads as "" (it has no content). */
  function rowTexts(): string[] {
    return Array.from(scheduleList().children).map(
      (el) => el.textContent ?? "",
    );
  }

  const ALL_DAY = {
    id: "s3",
    title: "Conference day",
    startTime: "",
    completed: false,
    isRoutine: false,
    isAllDay: true,
  };

  it("keeps the todo rows inside the schedule block, not a block of their own", () => {
    renderView();
    const section = screen.getByText("PROMISES").closest("section");
    expect(section?.contains(screen.getByText("Write report"))).toBe(true);
    // The retired heading had its own <section>; nothing else on the paper
    // announces todos now.
    expect(screen.queryByText("TODOS")).toBeNull();
  });

  it("runs todos → hairline → all-day → timed", () => {
    renderView({ data: { ...DATA, schedule: [DATA.schedule[0], ALL_DAY] } });
    const texts = rowTexts();
    expect(texts[0]).toContain("Write report");
    expect(texts[1]).toContain("Ship feature");
    expect(texts[2]).toBe(""); // the hairline
    expect(texts[3]).toContain("Conference day");
    expect(texts[4]).toContain("Morning standup");
  });

  it("draws exactly one hairline, and only between the two kinds", () => {
    renderView();
    expect(
      scheduleList().querySelectorAll('li[aria-hidden="true"]'),
    ).toHaveLength(1);
  });

  it("drops the hairline when the day has no todos", () => {
    renderView({ data: { ...DATA, todos: [] } });
    expect(
      scheduleList().querySelectorAll('li[aria-hidden="true"]'),
    ).toHaveLength(0);
    expect(rowTexts()[0]).toContain("Morning standup");
  });

  it("drops the hairline when the day has nothing scheduled", () => {
    renderView({ data: { ...DATA, schedule: [] } });
    expect(
      scheduleList().querySelectorAll('li[aria-hidden="true"]'),
    ).toHaveLength(0);
    // A todo-only day still lists its todos — the empty state is not for it.
    expect(screen.getByText("Write report")).toBeTruthy();
    expect(screen.queryByText("Nothing scheduled")).toBeNull();
  });

  it("shows the empty state only when both halves are empty", () => {
    renderView({ data: { ...DATA, schedule: [], todos: [] } });
    expect(screen.getByText("Nothing scheduled")).toBeTruthy();
  });

  it("keeps the todo row's toggle, jump and delete working after the move", () => {
    const { onToggleTodo, onJumpToTodos, onDeleteTodo } = renderView();
    fireEvent.click(screen.getByRole("button", { name: /Write report/ }));
    expect(onToggleTodo).toHaveBeenCalledWith("t1");
    fireEvent.click(screen.getAllByTitle("Open in Todos")[0]);
    expect(onJumpToTodos).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getAllByTitle("Delete this todo")[0]);
    expect(onDeleteTodo).toHaveBeenCalledWith("t1");
  });

  it("still hangs a todo's purposes under its title", () => {
    renderView({
      data: {
        ...DATA,
        todos: [
          {
            id: "t1",
            title: "Write report",
            status: "NOT_STARTED",
            startTime: "",
            purposes: ["Ship the quarter"],
          },
        ],
      },
    });
    expect(screen.getByText(/Ship the quarter/)).toBeTruthy();
  });
});

/*
 * #1369 — the paper printed no clock at all on a todo row, so a todo placed
 * at 09:30 and one merely dropped on today read exactly alike; the only way to
 * tell them apart was to open Schedule. Timed todos now print HH:MM in the
 * SAME column and the SAME type style as the event rows, and untimed ones keep
 * the empty column they had (nothing to say ≠ "終日", which is the all-day
 * band's own label below the hairline). The #939 order is untouched.
 */
describe("Timed todo rows print their clock (#1369)", () => {
  /** The row <li> that prints `title` (todo rows and event rows alike). */
  function row(title: string): HTMLElement {
    const li = screen.getByText(title).closest("li");
    if (li === null) throw new Error(`no row prints "${title}"`);
    return li;
  }

  /** A row's leading time cell — the fixed-width column both kinds share. */
  function timeCell(title: string): HTMLElement {
    const cell = row(title).querySelector("span.w-14");
    if (cell === null) throw new Error(`the "${title}" row has no time cell`);
    return cell as HTMLElement;
  }

  const TIMED_TODO = {
    id: "t9",
    title: "Draft the deck",
    status: "NOT_STARTED" as const,
    startTime: "09:30",
    purposes: [],
  };

  const ALL_DAY = {
    id: "s3",
    title: "Conference day",
    startTime: "",
    completed: false,
    isRoutine: false,
    isAllDay: true,
  };

  it("prints a timed todo's HH:MM where an event prints its own", () => {
    renderView({ data: { ...DATA, todos: [TIMED_TODO] } });
    expect(timeCell("Draft the deck").textContent).toBe("09:30");
    // Same cell, not a lookalike: identical class list = one column width and
    // one type style, so the two kinds of row line up down the page.
    expect(timeCell("Draft the deck").className).toBe(
      timeCell("Morning standup").className,
    );
  });

  it("leaves an untimed todo's cell empty — no blank label, no 00:00", () => {
    renderView({ data: { ...DATA, todos: [{ ...TIMED_TODO, startTime: "" }] } });
    const cell = timeCell("Draft the deck");
    expect(cell.textContent).toBe("");
    // A spacer, not an empty label: it holds the width and stays out of the
    // accessibility tree, so a screen reader hears the title, not a pause.
    expect(cell.getAttribute("aria-hidden")).toBe("true");
    expect(row("Draft the deck").textContent).not.toContain("All day");
  });

  it("keeps the all-day event's own label untouched", () => {
    renderView({ data: { ...DATA, schedule: [ALL_DAY] } });
    expect(timeCell("Conference day").textContent).toBe("All day");
  });

  it("does not move a timed todo out of the todo band (#939 order)", () => {
    renderView({
      data: {
        ...DATA,
        todos: [TIMED_TODO],
        schedule: [DATA.schedule[0], ALL_DAY],
      },
    });
    const section = screen.getByText("PROMISES").closest("section");
    const list = section?.querySelector("ul");
    const texts = Array.from(list?.children ?? []).map(
      (el) => el.textContent ?? "",
    );
    // todos → hairline → all-day → timed, exactly as before: a clock on a
    // todo is a label, not a promotion into the timed band.
    expect(texts[0]).toContain("Draft the deck");
    expect(texts[1]).toBe("");
    expect(texts[2]).toContain("Conference day");
    expect(texts[3]).toContain("Morning standup");
  });
});

/*
 * #938 —「きのうまでの自分」left the paper's column for the shared detail
 * panel. The paper must no longer print it (nor take the widget labels), and
 * the panel component must render the same three widgets from the same
 * BriefingData the paper is fed.
 */
describe("Visual zone moved to the detail panel (#938)", () => {
  it("no longer prints the visual zone on the paper", () => {
    renderView();
    expect(screen.queryByText("Streak")).toBeNull();
    expect(screen.queryByText("Trend")).toBeNull();
    expect(screen.queryByText("Balance")).toBeNull();
  });

  it("leaves carryover as the paper's last section, unruled", () => {
    const { container } = renderView();
    const sections = container.querySelectorAll("section");
    const last = sections[sections.length - 1]!;
    expect(last.textContent).toContain("CARRYOVER");
    // The rule above it is the previous section's border-b — a border of its
    // own would double the line now that the viz section is gone.
    expect(last.className).not.toContain("border-t");
    expect(last.className).not.toContain("border-b");
  });

  it("renders the three widgets in the panel under one heading", () => {
    render(
      <BriefingVizPanel
        sessions={[]}
        todoNodes={[]}
        title="VIZ"
        streakLabels={STREAK_LABELS}
        trendLabels={TREND_LABELS}
        balanceLabels={BALANCE_LABELS}
      />,
    );
    expect(screen.getByText("VIZ")).toBeTruthy();
    expect(screen.getByText("Streak")).toBeTruthy();
    expect(screen.getByText("Trend")).toBeTruthy();
    expect(screen.getByText("Balance")).toBeTruthy();
  });

  it("stacks the panel in one column (the well is ~320px)", () => {
    const { container } = render(
      <BriefingVizPanel
        sessions={[]}
        todoNodes={[]}
        title="VIZ"
        streakLabels={STREAK_LABELS}
        trendLabels={TREND_LABELS}
        balanceLabels={BALANCE_LABELS}
      />,
    );
    // The paper laid these out `sm:grid-cols-2`; at panel width that squeezes
    // each chart below what its axis labels need.
    expect(container.querySelectorAll(".sm\\:grid-cols-2")).toHaveLength(0);
  });
});

/*
 * AI attribution badge (#1210).
 *
 * The comment block is the one paragraph on the paper the user did not write,
 * and until now it announced itself in the same small grey type every section
 * hint uses. The wording did not change here — what is pinned is that the
 * attribution is still SHOWN, still says what it always said, and now carries
 * a mark of its own rather than sitting flat next to the annotations.
 */
describe("AI comment attribution (#1210)", () => {
  const WITH_BRIEFING = {
    ...DATA,
    briefing: { paragraphs: ["Yesterday went well."] },
  };

  it("shows nothing at all when there is no briefing", () => {
    renderView();
    expect(screen.queryByText("Claude")).not.toBeInTheDocument();
  });

  it("keeps the existing source wording beside the comment", () => {
    renderView({ data: WITH_BRIEFING });
    expect(screen.getByText("Yesterday went well.")).toBeInTheDocument();
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("Claude")).toBeInTheDocument();
  });

  it("wraps the attribution in a badge rather than plain hint text", () => {
    renderView({ data: WITH_BRIEFING });
    const badge = screen.getByText("Claude");
    expect(badge.className).toContain("rounded-full");
    expect(badge.className).toContain("border-lumen-briefing-kohaku");
    // The icon is decorative: it must not add a second reading of the source.
    expect(badge.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
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

/*
 * #391 — the 宣言 block on the evening paper. Wide keeps the original reading
 * (a morning artifact read back, hidden on a blank day); below 768px 夕刊 is a
 * Quick capture surface (mobile-scope #3), so the block becomes the live input
 * — otherwise a phone user who lands on 夕刊 cannot declare at all.
 */
describe("EveningView intention block (#391)", () => {
  it("reads the declaration back with no save caption on the wide layout", () => {
    renderEvening({ intentionText: "Ship the report" });
    expect(screen.getByText("Ship the report")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Declare today…")).toBeNull();
    // Nothing to save while read-only — the caption must not contradict it.
    expect(screen.queryByText("Unsaved")).toBeNull();
  });

  it("hides the whole block on the wide layout when nothing is declared", () => {
    renderEvening();
    expect(screen.queryByText("INTENTION")).toBeNull();
  });

  it("reports edits + blur to the host on the narrow layout", () => {
    const { onIntentionChange, onIntentionBlur } = renderEvening({
      intentionEditable: true,
      intentionText: "Ship the report",
    });
    const field = screen.getByPlaceholderText("Declare today…");
    expect((field as HTMLTextAreaElement).value).toBe("Ship the report");
    fireEvent.change(field, { target: { value: "Ship the report\nRun" } });
    expect(onIntentionChange).toHaveBeenCalledWith("Ship the report\nRun");
    fireEvent.blur(field);
    expect(onIntentionBlur).toHaveBeenCalledTimes(1);
  });

  // Only the presence of the caption row is a view concern — WHICH caption is
  // host-computed (BriefingScreen), and web has no test runner, so the copy
  // itself is out of reach here.
  it("keeps an empty field reachable on the narrow layout and shows a caption", () => {
    renderEvening({ intentionEditable: true });
    expect(screen.getByPlaceholderText("Declare today…")).toBeTruthy();
    expect(screen.getByText("Unsaved")).toBeTruthy();
  });
});

/*
 * #318 — below 768px the shell drops its header slot, so the SectionHeader
 * 朝刊/夕刊 band disappears and 夕刊 becomes unreachable. Both paper views take
 * an optional in-body `tabSwitcher` the narrow host fills; the wide host leaves
 * it undefined so the header keeps owning the tabs.
 */
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

function renderEvening(props?: Partial<Parameters<typeof EveningView>[0]>) {
  const onIntentionChange = vi.fn();
  const onIntentionBlur = vi.fn();
  const onSetTodoStatus = vi.fn();
  const result = render(
    <EveningView
      loading={false}
      dateLine="2026-07-25"
      mood={null}
      onSelectMood={vi.fn()}
      editorSlot={<div>editor</div>}
      intentionText=""
      intentionEditable={false}
      onIntentionChange={onIntentionChange}
      onIntentionBlur={onIntentionBlur}
      focusText=""
      onFocusChange={vi.fn()}
      onFocusBlur={vi.fn()}
      todos={[]}
      onSetTodoStatus={onSetTodoStatus}
      schedule={[]}
      labels={EVENING_LABELS}
      {...props}
    />,
  );
  return { ...result, onIntentionChange, onIntentionBlur, onSetTodoStatus };
}

/**
 * Counts the in-body switcher band. Mirrors the wrapper markup in both views —
 * the only `py-3` ruled divider on a paper otherwise built from `py-5`/`py-6`
 * sections — so an empty band (slot guard letting `null` through) is caught.
 */
function bandCount(container: HTMLElement): number {
  return container.querySelectorAll(
    "div.border-b.border-lumen-border.px-2.py-3",
  ).length;
}

describe("Briefing narrow-width tab switcher (#318)", () => {
  const switcher = <button type="button">夕刊</button>;

  it("renders the host switcher in the morning paper", () => {
    const { container } = renderView({ tabSwitcher: switcher });
    expect(screen.getByRole("button", { name: "夕刊" })).toBeTruthy();
    expect(bandCount(container)).toBe(1);
  });

  it("keeps the switcher reachable while the morning paper loads", () => {
    renderView({ loading: true, tabSwitcher: switcher });
    expect(screen.getByRole("button", { name: "夕刊" })).toBeTruthy();
  });

  it("renders the host switcher in the evening paper", () => {
    const { container } = renderEvening({ tabSwitcher: switcher });
    expect(screen.getByRole("button", { name: "夕刊" })).toBeTruthy();
    expect(bandCount(container)).toBe(1);
  });

  it("keeps the switcher reachable while the evening paper loads", () => {
    renderEvening({ loading: true, tabSwitcher: switcher });
    expect(screen.getByRole("button", { name: "夕刊" })).toBeTruthy();
  });

  it("renders no band in the morning paper on the wide layout", () => {
    const { container } = renderView();
    expect(screen.queryByRole("button", { name: "夕刊" })).toBeNull();
    expect(bandCount(container)).toBe(0);
  });

  it("renders no band in the evening paper on the wide layout", () => {
    const { container } = renderEvening();
    expect(screen.queryByRole("button", { name: "夕刊" })).toBeNull();
    expect(bandCount(container)).toBe(0);
  });

  // A host writing `cond ? <X/> : null` must not leave an empty ruled band
  // behind — the slot guard rejects null, not just undefined.
  it("renders no band when the host passes null", () => {
    expect(bandCount(renderView({ tabSwitcher: null }).container)).toBe(0);
    expect(bandCount(renderEvening({ tabSwitcher: null }).container)).toBe(0);
  });
});

/*
 * #879 — the band carries the narrow layout's hamburger (#609), and every
 * other section draws that row at the top of the page. Briefing used to print
 * its masthead above it, so the one screen with a title band had its chrome in
 * a different order than the rest. Asserted as DOM order (jsdom has no
 * layout — CLAUDE.md §7.1), which is what decides the stacking here.
 */
describe("Briefing narrow-width header order (#879)", () => {
  const switcher = <button type="button">夕刊</button>;

  /** True when the switcher band precedes the masthead in document order. */
  function bandPrecedesMasthead(container: HTMLElement): boolean {
    const band = container.querySelector(
      "div.border-b.border-lumen-border.px-2.py-3",
    );
    const masthead = container.querySelector("header");
    if (band === null || masthead === null) return false;
    return (
      (band.compareDocumentPosition(masthead) &
        Node.DOCUMENT_POSITION_FOLLOWING) !==
      0
    );
  }

  it("puts the band above the masthead in the morning paper", () => {
    const { container } = renderView({ tabSwitcher: switcher });
    expect(screen.getByText("BRIEFING")).toBeTruthy();
    expect(bandPrecedesMasthead(container)).toBe(true);
  });

  it("puts the band above the masthead in the evening paper", () => {
    const { container } = renderEvening({ tabSwitcher: switcher });
    expect(screen.getByText("EVENING")).toBeTruthy();
    expect(bandPrecedesMasthead(container)).toBe(true);
  });
});

/*
 * #410 — the jump action used to be a bare 13px ↗ sitting right after the
 * title, so it was both hard to hit and never in the same place twice (the
 * title length moved it). It now carries a visible「編集」label and is pinned
 * to the row's right edge.
 */
describe("Row edit action (#410)", () => {
  it("labels every jump button with the visible edit text", () => {
    renderView();
    // 2 schedule rows + 2 todo rows + 2 carryover rows.
    expect(screen.getAllByRole("button", { name: /Edit/ }).length).toBe(6);
  });

  // WCAG 2.5.3: the accessible name must START with the visible label, or
  // voice control ("click 編集") misses the button. It must also keep saying
  // where the jump lands — six buttons all named「編集」would be
  // indistinguishable in a screen reader's button list, and `title` alone
  // does not carry on touch.
  it("names each jump button with the visible label first, destination after", () => {
    renderView();
    const jump = screen.getAllByTitle("Open in Schedule")[0];
    expect(jump.textContent).toContain("Edit");
    expect(jump.getAttribute("aria-label")).toBe("Edit: Open in Schedule");
    expect(screen.getAllByLabelText("Edit: Open in Todos").length).toBe(4);
  });

  it("pins every row's action cluster to the right edge with padded hit targets", () => {
    renderView();
    const actions = screen.getAllByRole("button", { name: /^Edit: / });
    expect(actions.length).toBe(6);
    for (const action of actions) {
      // #585: the cluster owns the right-edge pin and the negative margins
      // now that two actions share it — the button keeps the padding that
      // buys its 24x24 target (WCAG 2.5.8), and the row height and right
      // edge stay exactly where they were with one action.
      expect(action.className).toContain("py-1");
      const cluster = action.parentElement!;
      expect(cluster.className).toContain("ml-auto");
      expect(cluster.className).toContain("-my-1");
      expect(cluster.className).toContain("-mr-1.5");
    }
  });

  it("gives the delete button the same hit target as its jump neighbour", () => {
    renderView();
    const deletes = screen.getAllByRole("button", { name: /^Delete: / });
    expect(deletes.length).toBe(4);
    for (const del of deletes) {
      expect(del.className).toContain("py-1");
      expect(del.className).toContain("px-1.5");
      expect(del.className).toContain("text-xs");
    }
  });

  it("keeps the routine tag beside the title, ahead of the edit button", () => {
    const { container } = renderView({
      data: {
        ...DATA,
        // Todos now share the block and render first (#939), so the schedule
        // row has to be picked by content rather than by being the first <li>.
        todos: [],
        schedule: [{ ...DATA.schedule[0], isRoutine: true }],
      },
    });
    const row = container.querySelector("li")!;
    const kids = Array.from(row.children).map((el) => el.textContent ?? "");
    expect(kids.indexOf("Routine")).toBeGreaterThan(-1);
    expect(kids.indexOf("Routine")).toBeLessThan(
      kids.findIndex((s) => s.includes("Edit")),
    );
  });
});

/*
 * #427 — a day with no declaration at all has nothing to report a save state
 * for. The host omits `intentionCaption` then; both papers must render the
 * 宣言 heading without any caption beside it.
 */
describe("Intention caption omission (#427)", () => {
  it("renders no caption when the host omits intentionCaption (morning)", () => {
    const { container } = renderView({
      labels: { ...LABELS, intentionCaption: undefined },
    });
    expect(screen.getByText("INTENTION")).toBeTruthy();
    expect(screen.queryByText("Saved")).toBeNull();
    expect(container.textContent).not.toContain("Unsaved");
  });

  it("renders no caption when the host omits intentionCaption (evening)", () => {
    const { container } = renderEvening({
      intentionEditable: true,
      labels: { ...EVENING_LABELS, intentionCaption: undefined },
    });
    expect(screen.getByText("INTENTION")).toBeTruthy();
    expect(container.textContent).not.toContain("Unsaved");
  });

  it("still renders the caption once the host supplies one", () => {
    renderView({ labels: { ...LABELS, intentionCaption: "Saved" } });
    expect(screen.getByText("Saved")).toBeTruthy();
  });
});

/*
 * #796 — the REMAINING TODOS rows speak the Todo's real status.
 *
 * The block drew a checkbox-shaped <span> with nothing listening to it, which
 * left the row unpressable. It is a real control now, and a row moved to Done
 * stays listed struck through so the press is visible and reversible. #873 took
 * the status set down to two values, so the control is a checkbox and reports
 * checked / unchecked rather than cycling.
 */
describe("EveningView remaining todos, status control (#796 / #873)", () => {
  const TODOS = [
    { id: "t1", title: "Write the report", status: "NOT_STARTED" as const },
    { id: "t2", title: "Book the room", status: "NOT_STARTED" as const },
    { id: "t3", title: "Send the invite", status: "DONE" as const },
  ];

  it("names each row's current status", () => {
    renderEvening({ todos: TODOS });
    expect(screen.getAllByLabelText("Status: Not started")).toHaveLength(2);
    expect(screen.getByLabelText("Status: Done")).toBeTruthy();
  });

  it("checks an unfinished row and unchecks a done one", () => {
    const { onSetTodoStatus } = renderEvening({ todos: TODOS });
    const [first] = screen.getAllByLabelText("Status: Not started");
    expect(first.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(first);
    expect(onSetTodoStatus).toHaveBeenLastCalledWith("t1", "DONE");
    const done = screen.getByLabelText("Status: Done");
    expect(done.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(done);
    expect(onSetTodoStatus).toHaveBeenLastCalledWith("t3", "NOT_STARTED");
  });

  it("keeps a Done row listed, struck through", () => {
    renderEvening({ todos: TODOS });
    expect(screen.getByText("Send the invite").className).toContain(
      "line-through",
    );
    expect(screen.getByText("Book the room").className).not.toContain(
      "line-through",
    );
  });

  it("gives every control the phone minimum touch target", () => {
    renderEvening({ todos: TODOS });
    for (const el of screen.getAllByRole("checkbox")) {
      // mobile-scope.md: 44px is the floor, and a 16px box cannot meet it.
      expect(el.className).toContain("min-h-11");
    }
  });
});
