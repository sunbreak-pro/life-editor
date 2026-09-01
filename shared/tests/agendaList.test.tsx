import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  AgendaList,
  agendaRowHeightPx,
  type AgendaItem,
} from "../src/components";

/*
 * AgendaList — pure day agenda. All-day rows first, then timed rows in the
 * order given (host sorts). A now-line divider splits past from upcoming when
 * nowMinutes is supplied; the completion circle fires onToggleComplete.
 */

const LABELS = {
  allDay: "All-day",
  empty: "Nothing today",
  nowLabel: "Now",
  complete: "Toggle complete",
  statusLabels: {
    notStarted: "Not started",
    inProgress: "In progress",
    done: "Done",
  },
  todoStatus: "Status",
  todoStatusLabels: {
    statusNotStarted: "Not started",
    statusDone: "Done",
  },
};

const ITEMS: AgendaItem[] = [
  {
    id: "allday",
    title: "Trash day",
    startTime: "00:00",
    endTime: "00:00",
    isAllDay: true,
    status: "inProgress",
  },
  {
    id: "a",
    title: "Stretch",
    startTime: "07:00",
    endTime: "07:15",
    variant: "routine",
    completed: true,
    status: "done",
  },
  {
    id: "b",
    title: "Project review",
    startTime: "15:00",
    endTime: "16:00",
    variant: "event",
    status: "notStarted",
  },
  {
    id: "t",
    title: "Write report",
    startTime: "09:00",
    endTime: "10:00",
    variant: "task",
    status: "notStarted",
  },
];

function renderList(props?: Partial<Parameters<typeof AgendaList>[0]>) {
  const onToggleComplete = vi.fn();
  const onSelectItem = vi.fn();
  render(
    <AgendaList
      items={ITEMS}
      onToggleComplete={onToggleComplete}
      onSelectItem={onSelectItem}
      labels={LABELS}
      {...props}
    />,
  );
  return { onToggleComplete, onSelectItem };
}

describe("AgendaList", () => {
  it("renders all-day badge then timed rows", () => {
    renderList();
    expect(screen.getByText("All-day")).toBeInTheDocument();
    expect(screen.getByText("Trash day")).toBeInTheDocument();
    expect(screen.getByText("Stretch")).toBeInTheDocument();
    expect(screen.getByText("Project review")).toBeInTheDocument();
  });

  it("places the now-line divider between past and upcoming rows", () => {
    renderList({ nowMinutes: 14 * 60 + 30 }); // 14:30
    const past = screen.getByText("Stretch"); // 07:00 → above the line
    const now = screen.getByText("Now");
    const future = screen.getByText("Project review"); // 15:00 → below the line
    // DOM order: past ... now ... future
    expect(
      past.compareDocumentPosition(now) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      now.compareDocumentPosition(future) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("omits the now-line when nowMinutes is null", () => {
    renderList({ nowMinutes: null });
    expect(screen.queryByText("Now")).toBeNull();
  });

  it("trails the now-line after the list when every row is past", () => {
    renderList({ nowMinutes: 23 * 60 }); // 23:00 → both timed rows are past
    const last = screen.getByText("Project review"); // 15:00, final timed row
    const now = screen.getByText("Now");
    expect(
      last.compareDocumentPosition(now) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("leads with the now-line when every row is upcoming", () => {
    renderList({ nowMinutes: 5 * 60 }); // 05:00 → both timed rows upcoming
    const now = screen.getByText("Now");
    const first = screen.getByText("Stretch"); // 07:00, first timed row
    expect(
      now.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("fires onToggleComplete from the timed-row status tag", () => {
    const { onToggleComplete } = renderList();
    // Only timed rows expose a clickable status tag; the all-day row's tag is
    // informational (no toggle), and #1367 moved the todo row to a checkbox —
    // so this query sees the two EVENT/ROUTINE rows only, and toggles[0] is
    // "a".
    const toggles = screen.getAllByRole("button", { name: "Toggle complete" });
    expect(toggles).toHaveLength(2);
    fireEvent.click(toggles[0]);
    expect(onToggleComplete).toHaveBeenCalledWith("a");
  });

  it("shows the empty label when there are no items", () => {
    render(<AgendaList items={[]} labels={LABELS} />);
    expect(screen.getByText("Nothing today")).toBeInTheDocument();
  });

  it("renders a todo row with the todo dot and the CheckSquare glyph (#593)", () => {
    renderList();
    const row = screen.getByText("Write report").closest("li");
    expect(row).not.toBeNull();
    expect(row?.querySelector(".bg-lumen-chip-task-dot")).not.toBeNull();
    // #593: the row's variant cue is a shape (CheckSquare), not the dot's hue.
    expect(row?.querySelector("svg")).not.toBeNull();
    // Event rows keep dot-only (no glyph — #593 touches todo only).
    const eventRow = screen.getByText("Project review").closest("li");
    expect(eventRow?.querySelector("svg")).toBeNull();
  });

  /*
   * #761: a todo row answers the same press an event does. #1367: it answers
   * with the 朝刊's checkbox — same role, same aria-checked, same words — not
   * with the event pill. Asserted through the row's own control rather than a
   * click position: jsdom has no layout, so anything read off coordinates
   * here would pass on a broken list.
   */
  it("fires onToggleComplete from a todo row's checkbox (#1367)", () => {
    const { onToggleComplete } = renderList();
    const row = screen.getByText("Write report").closest("li");
    const box = row?.querySelector<HTMLButtonElement>('[role="checkbox"]');
    expect(box).not.toBeNull();
    expect(box).toHaveAttribute("aria-label", "Status: Not started");
    expect(box).toHaveAttribute("aria-checked", "false");
    fireEvent.click(box!);
    expect(onToggleComplete).toHaveBeenCalledWith("t");
  });

  it("reads a completed todo as a checked box with a struck title (#1367)", () => {
    render(
      <AgendaList
        items={[
          {
            id: "done",
            title: "Write report",
            startTime: "09:00",
            endTime: "10:00",
            variant: "task",
            completed: true,
            status: "done",
          },
        ]}
        onToggleComplete={vi.fn()}
        labels={LABELS}
      />,
    );
    expect(
      screen.getByRole("checkbox", { name: "Status: Done" }),
    ).toHaveAttribute("aria-checked", "true");
    // The same treatment the 朝刊 gives a DONE row (EveningView).
    expect(screen.getByText("Write report").className).toContain(
      "line-through",
    );
  });

  it("leaves the EVENT rows on the status pill (#1373 is a separate call)", () => {
    renderList();
    const eventRow = screen.getByText("Project review").closest("li");
    expect(eventRow?.querySelector('[role="checkbox"]')).toBeNull();
    expect(eventRow?.textContent).toContain("Not started");
  });

  it("keeps the control on an ALL-DAY todo row, unlike an all-day event", () => {
    // A todo staged as "today, time TBD" is all-day by construction, and it is
    // the commonest row on the Mobile day list — leaving it informational
    // would put completion out of reach exactly where it is wanted (#761,
    // carried across to the checkbox by #1367).
    const onToggleComplete = vi.fn();
    render(
      <AgendaList
        items={[
          {
            id: "staged",
            title: "Buy stamps",
            startTime: "00:00",
            endTime: "00:00",
            isAllDay: true,
            variant: "task",
            status: "inProgress",
          },
          {
            id: "trash",
            title: "Trash day",
            startTime: "00:00",
            endTime: "00:00",
            isAllDay: true,
            status: "inProgress",
          },
        ]}
        onToggleComplete={onToggleComplete}
        labels={LABELS}
      />,
    );
    // The all-day EVENT's pill stays a read-only span, so nothing on that row
    // is pressable.
    expect(
      screen.queryByRole("button", { name: "Toggle complete" }),
    ).toBeNull();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(1); // the todo row only
    fireEvent.click(boxes[0]);
    expect(onToggleComplete).toHaveBeenCalledWith("staged");
  });
});

/*
 * Dayflow (#691) — Mobile's stand-in for the week grid. jsdom has no layout,
 * so nothing here reads a measured box: durations are asserted through the
 * inline minHeight the component writes, gaps and end times through text.
 */
const DAYFLOW_ITEMS: AgendaItem[] = [
  // 13:30–16:30 (180 min) — in progress at 14:32.
  { id: "long", title: "Workshop", startTime: "13:30", endTime: "16:30" },
  // 60-minute hole, then a 60-minute row.
  { id: "short", title: "Standup", startTime: "17:30", endTime: "18:30" },
  // Back-to-back with the row above → no gap marker.
  { id: "next", title: "Dinner", startTime: "18:30", endTime: "19:00" },
];

const formatGapLabel = (m: number) => `Free ${m}m`;

function renderDayflow(props?: Partial<Parameters<typeof AgendaList>[0]>) {
  render(
    <AgendaList
      items={DAYFLOW_ITEMS}
      dayflow
      formatGapLabel={formatGapLabel}
      labels={LABELS}
      {...props}
    />,
  );
}

describe("AgendaList — dayflow (#691)", () => {
  it("puts an in-progress row BELOW the now-line", () => {
    // 14:32, inside 13:30–16:30. Splitting on the start time filed it under
    // "past" while its own status said 着手中.
    renderDayflow({ nowMinutes: 14 * 60 + 32 });
    const now = screen.getByText("Now");
    const running = screen.getByText("Workshop");
    expect(
      now.compareDocumentPosition(running) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("still files a finished row above the now-line", () => {
    renderDayflow({ nowMinutes: 17 * 60 }); // 17:00 — Workshop ended at 16:30
    const past = screen.getByText("Workshop");
    const now = screen.getByText("Now");
    expect(
      past.compareDocumentPosition(now) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("draws the now-line on a day with nothing on it", () => {
    render(<AgendaList items={[]} nowMinutes={9 * 60} labels={LABELS} />);
    expect(screen.getByText("Now")).toBeInTheDocument();
    expect(screen.getByText("Nothing today")).toBeInTheDocument();
  });

  it("shows the end time under the start time", () => {
    renderDayflow();
    const row = screen.getByText("Workshop").closest("li");
    expect(row?.textContent).toContain("13:30");
    expect(row?.textContent).toContain("16:30");
  });

  it("leaves the end time off without dayflow (Desktop sidebar column)", () => {
    render(<AgendaList items={DAYFLOW_ITEMS} labels={LABELS} />);
    const row = screen.getByText("Workshop").closest("li");
    expect(row?.textContent).toContain("13:30");
    expect(row?.textContent).not.toContain("16:30");
  });

  it("gives a longer row more height, up to the cap", () => {
    renderDayflow();
    const long = screen
      .getByText("Workshop")
      .closest("li")
      ?.querySelector("button");
    const short = screen
      .getByText("Dinner")
      .closest("li")
      ?.querySelector("button");
    expect(long?.style.minHeight).toBe(`${agendaRowHeightPx(180)}px`);
    expect(short?.style.minHeight).toBe(`${agendaRowHeightPx(30)}px`);
    expect(agendaRowHeightPx(180)).toBeGreaterThan(agendaRowHeightPx(30));
    // Capped: a whole day off must not push everything after it off screen.
    expect(agendaRowHeightPx(600)).toBe(agendaRowHeightPx(300));
    expect(agendaRowHeightPx(600)).toBeLessThan(120);
  });

  it("marks the free stretch between two rows, but not a back-to-back pair", () => {
    renderDayflow();
    expect(screen.getByText("Free 60m")).toBeInTheDocument();
    // Standup 17:30–18:30 → Dinner 18:30: zero hole, so no marker.
    expect(screen.queryByText("Free 0m")).toBeNull();
    expect(screen.getAllByText(/^Free /)).toHaveLength(1);
  });

  it("omits gap markers when no formatter is supplied", () => {
    render(<AgendaList items={DAYFLOW_ITEMS} dayflow labels={LABELS} />);
    expect(screen.queryByText(/^Free /)).toBeNull();
  });
});
