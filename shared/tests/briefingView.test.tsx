import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  BriefingCarryoverPanel,
  BriefingView,
  BriefingVizPanel,
  EveningTodosPanel,
  EveningView,
  type BriefingData,
  type BriefingLabels,
} from "../src/components";
import { EVENING_LABELS, emptyEveningBlocks } from "./helpers/eveningFixtures";

/*
 * BriefingView — pure morning-paper view. 「今日のスケジュール」is a time
 * table since #2223: a row's title opens its editor, a todo's checkbox
 * toggles it. Carryover rows keep a toggling title plus a jump button. This
 * suite guards the click routing, the table's layout rules and the
 * no-nested-button a11y invariant.
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

const STREAK_LABELS = {
  title: "Streak",
  current: "Current",
  longest: "Longest",
  formatDays: (n: number) => (n === 1 ? "day" : "days"),
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

/**
 * The paper and, after it, the carryover block the host mounts in the detail
 * panel from the same data (#2285) — the two halves a reader of 朝刊 sees.
 * The paper is the container's first child.
 */
function renderView(props?: Partial<Parameters<typeof BriefingView>[0]>) {
  const onToggleTodo = vi.fn();
  const onOpenItem = vi.fn();
  const onAddItem = vi.fn();
  const onJumpToTodos = vi.fn();
  const result = render(
    <>
      <BriefingView
        loading={false}
        data={DATA}
        labels={LABELS}
        focusText={null}
        onToggleTodo={onToggleTodo}
        onOpenItem={onOpenItem}
        onAddItem={onAddItem}
        {...props}
      />
      <BriefingCarryoverPanel
        loading={false}
        entries={(props?.data ?? DATA).carryover}
        labels={LABELS}
        onToggleTodo={props?.onToggleTodo ?? onToggleTodo}
        onJumpToTodos={onJumpToTodos}
      />
    </>,
  );
  return {
    ...result,
    onToggleTodo,
    onOpenItem,
    onAddItem,
    onJumpToTodos,
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
 * #1442 — one page, one kind of checkbox. The todo cells of「今日のスケジュール」
 * and the carryover rows both draw the shared <TodoStatusCheckbox>, at its 44px
 * touch floor. Since #2223 the checkbox is the ONLY way a todo cell toggles:
 * the title opens the editor instead (see the time-table suite below).
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
    expect(onToggleTodo).toHaveBeenCalledExactlyOnceWith("t1");
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

/*
 * #2223 —「今日のスケジュール」as a time table. Rows run by time, and a row
 * holds every event and todo starting then, side by side; todos with no clock
 * close the table under「時間なし」; all-day events leave the table for a band
 * above it. jsdom has no layout (CLAUDE.md §7.1), so placement is pinned as
 * DOM structure — which row and which column a title sits in.
 */
describe("Today's schedule as a time table (#2223)", () => {
  const event = (
    over: Partial<BriefingData["schedule"][number]> & { id: string },
  ): BriefingData["schedule"][number] => ({
    title: over.id,
    startTime: "09:00",
    endTime: "10:00",
    completed: false,
    isRoutine: false,
    isAllDay: false,
    ...over,
  });
  const todo = (
    over: Partial<BriefingData["todos"][number]> & { id: string },
  ): BriefingData["todos"][number] => ({
    title: over.id,
    status: "NOT_STARTED",
    startTime: "",
    purposes: [],
    ...over,
  });
  const tag = (name: string) => ({
    id: `tag-${name}`,
    name,
    color: "#3b82f6",
    icon: null,
  });

  const TABLE_DATA: BriefingData = {
    ...DATA,
    schedule: [
      event({ id: "Standup", startTime: "09:00", endTime: "09:30" }),
      event({ id: "Lunch", startTime: "12:00", endTime: "13:00" }),
    ],
    todos: [
      todo({ id: "Prep slides", startTime: "09:00" }),
      todo({ id: "Read paper" }),
    ],
    carryover: [],
  };

  /** The table's body rows, keyed by their time label. */
  function rowAt(time: string): HTMLTableRowElement {
    const row = document.querySelector(`tr[data-briefing-row="${time}"]`);
    if (row === null) throw new Error(`no row at ${time}`);
    return row as HTMLTableRowElement;
  }
  function bodyRowKeys(): string[] {
    return Array.from(
      document.querySelectorAll("tbody tr"),
      (tr) =>
        tr.getAttribute("data-briefing-row") ??
        (tr.hasAttribute("data-briefing-now-line") ? "now" : "?"),
    );
  }
  function headings(): string[] {
    return Array.from(document.querySelectorAll("thead th"), (th) =>
      (th.textContent ?? "").trim(),
    );
  }

  it("puts an event and a todo that start at one time on one row", () => {
    renderView({ data: TABLE_DATA });
    const nine = rowAt("09:00");
    const cells = nine.querySelectorAll("td");
    expect(cells).toHaveLength(2);
    expect(cells[0].textContent).toContain("Standup");
    expect(cells[1].textContent).toContain("Prep slides");
  });

  it("runs the rows by time and closes with the untimed todos", () => {
    renderView({ data: TABLE_DATA });
    expect(bodyRowKeys()).toEqual(["09:00", "12:00", "untimed"]);
    const last = rowAt("untimed");
    expect(last.querySelector("th")?.textContent).toBe("No time");
    expect(last.textContent).toContain("Read paper");
    expect(last.textContent).not.toContain("Standup");
  });

  it("files a clockless event that is not all-day under the one untimed row", () => {
    renderView({
      data: {
        ...TABLE_DATA,
        schedule: [event({ id: "No clock", startTime: "", endTime: "" })],
      },
    });
    expect(bodyRowKeys()).toEqual(["09:00", "untimed"]);
    expect(rowAt("untimed").textContent).toContain("No clock");
    expect(rowAt("untimed").textContent).toContain("Read paper");
  });

  it("puts two spellings of one time on the same row", () => {
    renderView({
      data: {
        ...TABLE_DATA,
        schedule: [event({ id: "Short", startTime: "9:00", endTime: "9:30" })],
      },
    });
    expect(bodyRowKeys()).toEqual(["09:00", "untimed"]);
    expect(rowAt("09:00").textContent).toContain("Short");
  });

  it("sizes the time column to its widest label without wrapping", () => {
    renderView({ data: TABLE_DATA });
    for (const th of document.querySelectorAll(
      "tbody th, thead th:first-child",
    )) {
      expect(th.className).toContain("whitespace-nowrap");
      expect(th.className).toContain("w-px");
    }
  });

  it("heads the columns time, events, todos — with a calendar and a check", () => {
    renderView({ data: TABLE_DATA });
    expect(headings()).toEqual(["Time", "Events", "Todos"]);
    const [, eventsHead, todosHead] = document.querySelectorAll("thead th");
    expect(eventsHead.querySelector("svg.lucide-calendar-days")).not.toBeNull();
    expect(
      todosHead.querySelector(
        "svg.lucide-square-check-big, svg.lucide-check-square",
      ),
    ).not.toBeNull();
  });

  describe("the all-day band", () => {
    const allDay = (id: string) =>
      event({ id, startTime: "", endTime: "", isAllDay: true });

    it("takes the all-day events out of the table and into the band", () => {
      renderView({
        data: {
          ...TABLE_DATA,
          schedule: [...TABLE_DATA.schedule, allDay("Holiday")],
        },
      });
      const band = document.querySelector("[data-briefing-allday]")!;
      expect(band.textContent).toContain("All day");
      expect(band.textContent).toContain("Holiday");
      expect(document.querySelector("table")!.textContent).not.toContain(
        "Holiday",
      );
    });

    it("folds four chips to two and「+N more」, and opens and closes", () => {
      renderView({
        data: {
          ...TABLE_DATA,
          schedule: ["A1", "A2", "A3", "A4"].map(allDay),
        },
      });
      const band = () => document.querySelector("[data-briefing-allday]")!;
      expect(band().textContent).toContain("A1");
      expect(band().textContent).toContain("A2");
      expect(band().textContent).not.toContain("A3");
      fireEvent.click(screen.getByRole("button", { name: "+2 more" }));
      for (const id of ["A1", "A2", "A3", "A4"]) {
        expect(band().textContent).toContain(id);
      }
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(band().textContent).not.toContain("A3");
      expect(screen.getByRole("button", { name: "+2 more" })).toBeTruthy();
    });

    it("shows three chips whole — the fold starts at four", () => {
      renderView({
        data: { ...TABLE_DATA, schedule: ["A1", "A2", "A3"].map(allDay) },
      });
      expect(screen.queryByRole("button", { name: /more/ })).toBeNull();
      expect(
        document.querySelector("[data-briefing-allday]")!.textContent,
      ).toContain("A3");
    });

    it("paints a chip in its tag colour, else the plain event face", () => {
      renderView({
        data: {
          ...TABLE_DATA,
          schedule: [
            { ...allDay("Tagged"), tagColor: "#ff0000" },
            allDay("Plain"),
          ],
        },
      });
      const tagged = screen.getByRole("button", { name: "Tagged" });
      expect(tagged.getAttribute("style")).toContain("background-color");
      const plain = screen.getByRole("button", { name: "Plain" });
      expect(plain.className).toContain("bg-lumen-chip-event-bg");
    });

    it("opens a chip's editor and carries no tags or repeat glyph", () => {
      const { onOpenItem } = renderView({
        data: {
          ...TABLE_DATA,
          schedule: [
            { ...allDay("Retreat"), isRoutine: true, tags: [tag("Work")] },
          ],
        },
      });
      fireEvent.click(screen.getByRole("button", { name: "Retreat" }));
      expect(onOpenItem).toHaveBeenCalledExactlyOnceWith("Retreat", "event");
      const band = document.querySelector("[data-briefing-allday]")!;
      expect(band.textContent).not.toContain("Work");
      expect(band.querySelector("svg.lucide-repeat")).toBeNull();
    });
  });

  describe("the current-time line and the events' state", () => {
    const DAY: BriefingData = {
      ...TABLE_DATA,
      schedule: [
        event({ id: "Early", startTime: "08:00", endTime: "09:00" }),
        event({ id: "Running", startTime: "10:00", endTime: "11:00" }),
        event({ id: "Later", startTime: "15:00", endTime: "16:00" }),
      ],
      todos: [todo({ id: "Untimed todo" })],
    };
    const phaseOf = (id: string) =>
      document
        .querySelector(`[data-briefing-event="${id}"]`)
        ?.getAttribute("data-phase");

    it("draws the line across both columns, before the next row to start", () => {
      renderView({ data: DAY, nowMinutes: 10 * 60 + 30 });
      expect(bodyRowKeys()).toEqual([
        "08:00",
        "10:00",
        "now",
        "15:00",
        "untimed",
      ]);
      const line = document.querySelector("tr[data-briefing-now-line]")!;
      expect(line.querySelector("td")?.getAttribute("colspan")).toBe("2");
      expect(line.textContent).toContain("10:30");
    });

    it("draws it after the last timed row once the clock has passed them all", () => {
      renderView({ data: DAY, nowMinutes: 22 * 60 });
      expect(bodyRowKeys()).toEqual([
        "08:00",
        "10:00",
        "15:00",
        "now",
        "untimed",
      ]);
    });

    it("keeps an event whose end is not after its start running to the day's end", () => {
      // Schedule's grid lays such a row out to midnight; the paper agrees.
      renderView({
        data: {
          ...DAY,
          schedule: [
            event({ id: "Open", startTime: "09:00", endTime: "09:00" }),
          ],
        },
        nowMinutes: 20 * 60,
      });
      expect(phaseOf("Open")).toBe("ongoing");
    });

    it("draws no line without a clock", () => {
      renderView({ data: DAY });
      expect(document.querySelector("tr[data-briefing-now-line]")).toBeNull();
    });

    it("dims a finished event and marks the one under way", () => {
      renderView({ data: DAY, nowMinutes: 10 * 60 + 30 });
      expect(phaseOf("Early")).toBe("past");
      expect(phaseOf("Running")).toBe("ongoing");
      expect(phaseOf("Later")).toBe("upcoming");
      const running = document.querySelector(
        '[data-briefing-event="Running"]',
      )!;
      expect(running.textContent).toContain("Now on");
      expect(screen.getByRole("button", { name: "Early" }).className).toContain(
        "text-lumen-text-secondary",
      );
      // Only the event under way wears the mark.
      expect(screen.getAllByText("Now on")).toHaveLength(1);
    });
  });

  it("gives a routine event the same calendar glyph, plus its badge", () => {
    renderView({
      data: {
        ...TABLE_DATA,
        schedule: [
          event({ id: "Gym", isRoutine: true }),
          event({ id: "Call", startTime: "11:00" }),
        ],
      },
    });
    for (const id of ["Gym", "Call"]) {
      const cell = document.querySelector(`[data-briefing-event="${id}"]`)!;
      expect(cell.querySelector("svg.lucide-calendar-days")).not.toBeNull();
      expect(cell.querySelector("svg.lucide-repeat")).toBeNull();
    }
    expect(
      document.querySelector('[data-briefing-event="Gym"]')!.textContent,
    ).toContain("Routine");
  });

  describe("pressing an item", () => {
    it("opens an event's editor, not Schedule", () => {
      const { onOpenItem } = renderView({ data: TABLE_DATA });
      fireEvent.click(screen.getByRole("button", { name: "Standup" }));
      expect(onOpenItem).toHaveBeenCalledExactlyOnceWith("Standup", "event");
    });

    it("opens a todo's editor from its title, without toggling it", () => {
      const { onOpenItem, onToggleTodo } = renderView({ data: TABLE_DATA });
      fireEvent.click(screen.getByRole("button", { name: "Prep slides" }));
      expect(onOpenItem).toHaveBeenCalledExactlyOnceWith("Prep slides", "task");
      expect(onToggleTodo).not.toHaveBeenCalled();
    });

    it("puts no delete or jump button on a table row", () => {
      renderView({ data: TABLE_DATA });
      const table = document.querySelector("table")!;
      expect(table.querySelector("svg.lucide-trash-2")).toBeNull();
      expect(table.querySelector("svg.lucide-arrow-up-right")).toBeNull();
    });
  });

  describe("adding", () => {
    it("puts a「+」on each column heading and none on the block heading", () => {
      const { onAddItem } = renderView({ data: TABLE_DATA });
      fireEvent.click(screen.getByRole("button", { name: "Add an event" }));
      fireEvent.click(screen.getByRole("button", { name: "Add a todo" }));
      expect(onAddItem.mock.calls).toEqual([["event"], ["task"]]);
      const heading = screen.getByText("PROMISES").closest("div")!;
      expect(heading.querySelector("svg.lucide-plus")).toBeNull();
    });

    it("keeps both「+」on a day with nothing on it", () => {
      renderView({ data: { ...TABLE_DATA, schedule: [], todos: [] } });
      expect(screen.getByText("Nothing scheduled")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Add an event" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Add a todo" })).toBeTruthy();
    });
  });

  describe("tags", () => {
    it("prints every tag of an item that has three, right-aligned", () => {
      renderView({
        data: {
          ...TABLE_DATA,
          schedule: [
            event({
              id: "Standup",
              tags: [tag("Work"), tag("Team"), tag("Daily")],
            }),
          ],
        },
      });
      const line = document
        .querySelector('[data-briefing-event="Standup"]')!
        .querySelector("[data-briefing-tags]")!;
      expect(line.className).toContain("justify-end");
      expect(line.textContent).toContain("Work");
      expect(line.textContent).toContain("Daily");
      expect(line.querySelector("[data-briefing-tags-more]")).toBeNull();
    });

    it("folds four or more to two and「+N more」naming the rest", () => {
      renderView({
        data: {
          ...TABLE_DATA,
          todos: [
            todo({
              id: "Prep slides",
              tags: [tag("A"), tag("B"), tag("C"), tag("D")],
            }),
          ],
        },
      });
      const line = document
        .querySelector('[data-briefing-todo="Prep slides"]')!
        .querySelector("[data-briefing-tags]")!;
      const items = Array.from(line.children, (el) => el.textContent);
      expect(items).toHaveLength(3);
      expect(items.slice(0, 2)).toEqual(["A", "B"]);
      expect(items[2]?.startsWith("+2 more")).toBe(true);
      const more = line.querySelector("[data-briefing-tags-more]")!;
      expect(more.getAttribute("title")).toBe("C ・ D");
      // The hidden names are in the text too, for a screen reader.
      expect(more.querySelector(".sr-only")?.textContent).toContain("C ・ D");
    });

    it("tints each tag's icon with the tag's colour", () => {
      renderView({
        data: {
          ...TABLE_DATA,
          todos: [todo({ id: "Prep slides", tags: [tag("A")] })],
        },
      });
      const icon = document
        .querySelector("[data-briefing-tags] svg")!
        .getAttribute("style");
      expect(icon).toContain("color");
    });
  });

  describe("showing and hiding the columns", () => {
    function switchButton(name: string): HTMLElement {
      const group = screen.getByRole("group", { name: "Columns" });
      return within(group).getByRole("button", { name });
    }

    it("on Desktop shows both columns, and a press hides one", () => {
      renderView({ data: TABLE_DATA });
      expect(switchButton("Events").getAttribute("aria-pressed")).toBe("true");
      fireEvent.click(switchButton("Todos"));
      expect(headings()).toEqual(["Time", "Events"]);
      expect(rowAt("09:00").querySelectorAll("td")).toHaveLength(1);
      expect(
        document.querySelector('tr[data-briefing-row="untimed"]'),
      ).toBeNull();
      fireEvent.click(switchButton("Todos"));
      expect(headings()).toEqual(["Time", "Events", "Todos"]);
    });

    it("never hides both: the last column's button is locked", () => {
      renderView({ data: TABLE_DATA });
      fireEvent.click(switchButton("Events"));
      expect(headings()).toEqual(["Time", "Todos"]);
      const todos = switchButton("Todos");
      expect(todos).toBeDisabled();
      fireEvent.click(todos);
      expect(headings()).toEqual(["Time", "Todos"]);
    });

    it("hides the all-day band with the events column", () => {
      renderView({
        data: {
          ...TABLE_DATA,
          schedule: [
            event({
              id: "Holiday",
              startTime: "",
              endTime: "",
              isAllDay: true,
            }),
          ],
        },
      });
      expect(document.querySelector("[data-briefing-allday]")).not.toBeNull();
      fireEvent.click(switchButton("Events"));
      expect(document.querySelector("[data-briefing-allday]")).toBeNull();
    });

    it("on a phone shows one column at a time, events first", () => {
      renderView({ data: TABLE_DATA, narrow: true });
      expect(headings()).toEqual(["Time", "Events"]);
      expect(screen.queryByText("Prep slides")).toBeNull();
      fireEvent.click(switchButton("Todos"));
      expect(headings()).toEqual(["Time", "Todos"]);
      expect(screen.getByText("Prep slides")).toBeTruthy();
      expect(screen.queryByText("Standup")).toBeNull();
      expect(switchButton("Events").getAttribute("aria-pressed")).toBe("false");
      // Both buttons stay pressable — switching is the whole control here.
      expect(switchButton("Events")).not.toBeDisabled();
    });
  });

  it("never nests a button inside another button", () => {
    const { container } = renderView({ data: TABLE_DATA, nowMinutes: 600 });
    expect(container.querySelectorAll("button button").length).toBe(0);
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

  // #2285: carryover followed the widgets into the panel, so the schedule
  // table closes the paper and no heading is left behind for it.
  it("ends the paper on the schedule table, with no carryover in it", () => {
    const { container } = renderView();
    const paper = container.firstElementChild as HTMLElement;
    const sections = paper.querySelectorAll("section");
    expect(
      sections[sections.length - 1]!.querySelector("table"),
    ).not.toBeNull();
    expect(paper.textContent).not.toContain("CARRYOVER");
    expect(paper.textContent).not.toContain("Old todo");
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

function renderEvening(props?: Partial<Parameters<typeof EveningView>[0]>) {
  return render(
    <EveningView
      loading={false}
      dateLine="2026-07-25"
      mood={null}
      onSelectMood={vi.fn()}
      editorSlot={<div>editor</div>}
      focusText=""
      onFocusChange={vi.fn()}
      onFocusBlur={vi.fn()}
      labels={EVENING_LABELS}
      {...emptyEveningBlocks()}
      {...props}
    />,
  );
}

/*
 * #2223 — the narrow 朝刊/夕刊 band left both papers. #318 / #879 had it drawn
 * inside the paper, above the masthead, so it scrolled away with the paper;
 * it is the shell header's now (the descriptor no longer asks for it in the
 * body), and neither paper draws a ruled `py-3` band of its own any more.
 */
describe("No in-body tab band on either paper (#2223)", () => {
  function bandCount(container: HTMLElement): number {
    return container.querySelectorAll(
      "div.border-b.border-lumen-border.px-2.py-3",
    ).length;
  }

  it("opens the morning paper on its masthead", () => {
    const { container } = renderView();
    expect(bandCount(container)).toBe(0);
    expect(container.firstElementChild?.querySelector("header")).not.toBeNull();
  });

  it("opens the evening paper on its masthead", () => {
    const { container } = renderEvening();
    expect(bandCount(container)).toBe(0);
  });
});

/*
 * #410 — the jump action used to be a bare 13px ↗ sitting right after the
 * title, so it was both hard to hit and never in the same place twice (the
 * title length moved it). It carries a visible「編集」label and is pinned to
 * the row's right edge. Only the carryover rows draw it since #2223: a table
 * row's title opens the editor in place.
 */
describe("Row edit action (#410)", () => {
  it("labels every carryover jump with the visible edit text", () => {
    renderView();
    expect(screen.getAllByRole("button", { name: /^Edit/ }).length).toBe(2);
  });

  // WCAG 2.5.3: the accessible name must START with the visible label, or
  // voice control ("click 編集") misses the button. It must also keep saying
  // where the jump lands — `title` alone does not carry on touch.
  it("names each jump button with the visible label first, destination after", () => {
    renderView();
    const jump = screen.getAllByTitle("Open in Todos")[0];
    expect(jump.textContent).toContain("Edit");
    expect(jump.getAttribute("aria-label")).toBe("Edit: Open in Todos");
  });

  it("pins every row's action cluster to the right edge with padded hit targets", () => {
    renderView();
    const actions = screen.getAllByRole("button", { name: /^Edit: / });
    expect(actions.length).toBe(2);
    for (const action of actions) {
      expect(action.className).toContain("py-1");
      const cluster = action.parentElement!;
      expect(cluster.className).toContain("ml-auto");
      expect(cluster.className).toContain("-my-1");
      // #1514: NOT the horizontal twin — it hung the cluster 6px outside its
      // own container.
      expect(cluster.className).not.toContain("-mr-");
    }
  });

  it("jumps to Todos from a carryover row without toggling it", () => {
    const { onJumpToTodos, onToggleTodo } = renderView();
    fireEvent.click(screen.getAllByTitle("Open in Todos")[0]);
    expect(onJumpToTodos).toHaveBeenCalledExactlyOnceWith("c1");
    expect(onToggleTodo).not.toHaveBeenCalled();
  });

  it("still toggles a carryover row from its title and strikes completed ones", () => {
    const { onToggleTodo } = renderView();
    fireEvent.click(screen.getByRole("button", { name: /Old todo/ }));
    expect(onToggleTodo).toHaveBeenCalledWith("c1");
    expect(screen.getByText("Finished carryover").className).toContain(
      "line-through",
    );
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
describe("Remaining todos, status control (#796 / #873)", () => {
  const TODOS = [
    { id: "t1", title: "Write the report", status: "NOT_STARTED" as const },
    { id: "t2", title: "Book the room", status: "NOT_STARTED" as const },
    { id: "t3", title: "Send the invite", status: "DONE" as const },
  ];

  // The block lives in the detail panel since #2285; its rows did not change.
  function renderEvening({ todos }: { todos: typeof TODOS }) {
    const onSetTodoStatus = vi.fn();
    render(
      <EveningTodosPanel
        loading={false}
        todos={todos}
        labels={EVENING_LABELS}
        onSetTodoStatus={onSetTodoStatus}
      />,
    );
    return { onSetTodoStatus };
  }

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

/*
 * #1514 — at 390px the row actions' printed words squeezed the titles. The
 * carryover rows still draw「編集」, so the rule that prints the word only
 * from `md` up — while every accessible name keeps it — still applies there.
 */
describe("Narrow rows fit: icon-only actions, nothing overhanging (#1514)", () => {
  it("prints the action word only from the wide breakpoint up", () => {
    renderView();
    const printed = screen.getAllByText(LABELS.edit);
    expect(printed.length).toBeGreaterThan(0);
    for (const node of printed) {
      expect(node.className).toContain("hidden");
      expect(node.className).toContain("@md:inline");
    }
  });

  it("keeps every action named after the word it stops printing", () => {
    renderView();
    expect(screen.getAllByRole("button", { name: /^Edit: / }).length).toBe(2);
  });

  it("grows the icon to 16px while it stands alone, 13px once the word is back", () => {
    const { container } = renderView();
    const icons = container.querySelectorAll(
      'button[title="Open in Todos"] svg',
    );
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.getAttribute("class")).toContain("size-4");
      expect(icon.getAttribute("class")).toContain("@md:size-[13px]");
    }
  });

  it("keeps the column「+」inside the block, with no horizontal overhang", () => {
    renderView();
    for (const name of [LABELS.addEvent, LABELS.addTodo]) {
      const add = screen.getByRole("button", { name });
      expect(add.className).toContain("-my-1");
      expect(add.className).not.toContain("-mr-");
    }
  });
});

/*
 * #1513 — the nameplate reads 「LIFE EDITOR 朝刊」in ja, and CJK text may wrap
 * between any two characters unless a rule forbids it, so at 390px the paper
 * printed 「LIFE EDITOR 夕」over 「刊」— one word split down the middle.
 *
 * jsdom has no layout (CLAUDE.md §7.1), so the wrap itself cannot be measured
 * here. What is pinned instead is the rule that takes the mid-word break point
 * away, on both papers: drop it and the split comes back silently.
 */
describe("Masthead never breaks the paper's name mid-word (#1513)", () => {
  it("holds the morning nameplate's characters together", () => {
    renderView();
    expect(
      screen.getByRole("heading", { name: LABELS.masthead }).className,
    ).toContain("break-keep");
  });

  it("holds the evening nameplate's characters together", () => {
    renderEvening();
    expect(
      screen.getByRole("heading", { name: EVENING_LABELS.masthead }).className,
    ).toContain("break-keep");
  });
});

/*
 * #2106 — the rebuilt morning paper. No 宣言 field, no free-text goal fields,
 * and — the Issue's DoD — no empty frame on a day Claude wrote nothing: the
 * comment block exists only on days it has paragraphs. Goals arrive as a
 * host-built slot, and a todo row names the goals it serves.
 */
describe("Morning paper rebuild (#2106)", () => {
  it.each([
    ["no briefing at all", null],
    ["a briefing with no paragraphs", { paragraphs: [] }],
  ])("draws no comment frame with %s", (_, briefing) => {
    const { container } = renderView({ data: { ...DATA, briefing } });
    expect(screen.queryByText(LABELS.aiTitle)).toBeNull();
    expect(screen.queryByText(LABELS.aiSource)).toBeNull();
    // No section of the paper is drawn empty.
    for (const section of container.querySelectorAll("section")) {
      expect(section.textContent?.trim()).not.toBe("");
    }
  });

  it("has no declaration field", () => {
    renderView();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("prints a todo's goals in order, before its note links", () => {
    const { container } = renderView({
      data: {
        ...DATA,
        todos: [
          {
            id: "t1",
            title: "Write report",
            status: "NOT_STARTED",
            startTime: "",
            purposes: ["Spec note"],
            goals: ["企画書を通す", "3 回走る"],
          },
        ],
      },
    });
    const line = screen.getByText("企画書を通す ・ 3 回走る").closest("p");
    expect(line).not.toBeNull();
    const mark = line!.querySelector(".sr-only");
    expect(mark?.textContent).toBe(LABELS.goalMark);
    const purpose = screen.getByText(/Spec note/).closest("p")!;
    expect(
      line!.compareDocumentPosition(purpose) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(container.textContent).toContain("Goals:");
  });

  it.each([
    ["omitted", undefined],
    ["empty", []],
  ])("draws no goal line when the goals are %s", (_, goals) => {
    renderView({
      data: {
        ...DATA,
        todos: [
          {
            id: "t1",
            title: "Write report",
            status: "NOT_STARTED",
            startTime: "",
            purposes: [],
            goals,
          },
        ],
      },
    });
    expect(screen.queryByText(LABELS.goalMark)).toBeNull();
  });

  it("draws the goals slot between the comment and the schedule", () => {
    renderView({
      data: { ...DATA, briefing: { paragraphs: ["Good work."] } },
      goalsSlot: <section>GOALS SLOT</section>,
    });
    const ai = screen.getByText(LABELS.aiTitle);
    const slot = screen.getByText("GOALS SLOT");
    const schedule = screen.getByText(LABELS.scheduleTitle);
    expect(
      ai.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      slot.compareDocumentPosition(schedule) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
