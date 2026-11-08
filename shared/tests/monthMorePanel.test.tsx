import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  MonthMorePanel,
  placeMonthMorePanel,
  type MonthGridItem,
} from "../src/components";

/*
 * MonthMorePanel (#2049) — what a Desktop month cell folded into "他 N 件",
 * listed beside the cell. The rectangle math is pinned with numbers through
 * `placeMonthMorePanel`, because jsdom has no layout (every rect is 0); the
 * rest drives the real panel: focus in on open, Escape back to "他 N 件",
 * presses outside / scrolls / resizes close it, and a row hands its item over.
 */

const WIDTH = 248;

describe("placeMonthMorePanel", () => {
  // jsdom's window is 1024 × 768.
  const cell = { left: 400, right: 540, top: 200 };

  it("opens on the cell's left, leaving the cell in view", () => {
    const at = placeMonthMorePanel(cell, 3, WIDTH, 150);
    expect(at.side).toBe("left");
    expect(at.left).toBe(400 - WIDTH - 8);
    expect(at.top).toBe(200);
  });

  it("opens on the right in the first column", () => {
    const at = placeMonthMorePanel(
      { left: 0, right: 140, top: 200 },
      0,
      WIDTH,
      150,
    );
    expect(at.side).toBe("right");
    expect(at.left).toBe(140 + 8);
  });

  it("falls back to the right when the left would leave the window", () => {
    const at = placeMonthMorePanel(
      { left: 150, right: 290, top: 200 },
      1,
      WIDTH,
      150,
    );
    expect(at.side).toBe("right");
    expect(at.left).toBe(290 + 8);
  });

  it("keeps the last column's panel inside the window", () => {
    const at = placeMonthMorePanel(
      { left: 884, right: 1024, top: 200 },
      6,
      WIDTH,
      150,
    );
    expect(at.side).toBe("left");
    expect(at.left + WIDTH).toBeLessThanOrEqual(1024 - 8);
  });

  it("lifts a panel that would run past the bottom edge", () => {
    const at = placeMonthMorePanel({ ...cell, top: 700 }, 3, WIDTH, 150);
    expect(at.top).toBe(768 - 150 - 8);
  });
});

const ITEMS: MonthGridItem[] = [
  { id: "e1", date: "2026-07-09", title: "Standup", variant: "event" },
  { id: "t1", date: "2026-07-09", title: "Write report", variant: "task" },
  { id: "h1", date: "2026-07-09", title: "Marine Day", variant: "holiday" },
];

function renderPanel(items: MonthGridItem[] = ITEMS) {
  // The panel reads its cell off the anchor, the way MonthGrid draws it.
  const cell = document.createElement("div");
  cell.setAttribute("data-month-cell", "2026-07-09");
  cell.setAttribute("data-month-column", "4");
  const anchor = document.createElement("button");
  anchor.textContent = "+3 more";
  cell.appendChild(anchor);
  document.body.appendChild(cell);
  const onItemActivate = vi.fn();
  const onClose = vi.fn();
  render(
    <MonthMorePanel
      anchor={anchor}
      items={items}
      title="The rest of Thu, Jul 9"
      closeLabel="Close"
      onItemActivate={onItemActivate}
      onClose={onClose}
    />,
  );
  return { anchor, cell, onItemActivate, onClose };
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("MonthMorePanel", () => {
  it("lists the folded items as a dialog named for the day", () => {
    renderPanel();
    const dialog = screen.getByRole("dialog", {
      name: "The rest of Thu, Jul 9",
    });
    expect(dialog.getAttribute("data-month-more-panel")).toBe("2026-07-09");
    expect(screen.getByRole("button", { name: "Standup" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Write report" }),
    ).toBeInTheDocument();
    // #2565: a holiday opens its read-only bubble, the same as the cell's.
    expect(
      screen.getByRole("button", { name: "Marine Day" }),
    ).toBeInTheDocument();
  });

  it("hands a holiday row over like any other row (#2565)", () => {
    const { onClose, onItemActivate } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Marine Day" }), {
      detail: 1,
      clientX: 50,
      clientY: 60,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onItemActivate).toHaveBeenCalledWith(
      "h1",
      { x: 50, y: 60 },
      { focus: false },
    );
  });

  it("opens a holiday row from the keyboard, asking the bubble for focus (#2565)", () => {
    const { onItemActivate } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Marine Day" }), {
      detail: 0,
    });
    expect(onItemActivate).toHaveBeenCalledWith(
      "h1",
      { x: 0, y: 0 },
      { focus: true },
    );
  });

  it("marks each row with its kind, named like the month chips (#2551)", () => {
    const cell = document.createElement("div");
    cell.setAttribute("data-month-cell", "2026-07-09");
    cell.setAttribute("data-month-column", "4");
    const anchor = document.createElement("button");
    cell.appendChild(anchor);
    document.body.appendChild(cell);
    render(
      <MonthMorePanel
        anchor={anchor}
        items={[
          ...ITEMS,
          { id: "r1", date: "2026-07-09", title: "Gym", variant: "routine" },
          {
            id: "t2",
            date: "2026-07-09",
            title: "Done thing",
            variant: "task",
            completed: true,
          },
        ]}
        title="The rest of Thu, Jul 9"
        closeLabel="Close"
        kindLabels={{ event: "Event", task: "Todo", routine: "Repeating" }}
        onItemActivate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    for (const [title, kind, label] of [
      ["Standup", "event", "Event"],
      ["Write report", "task", "Todo"],
      ["Gym", "routine", "Repeating"],
    ] as const) {
      const row = screen.getByRole("button", { name: `${label} ${title}` });
      const mark = row.querySelector("svg");
      expect(mark?.getAttribute("data-chip-kind")).toBe(kind);
      expect(mark?.getAttribute("role")).toBe("img");
    }
    // #1373 stays: a completed todo is still struck through and faded.
    const done = screen.getByRole("button", { name: "Todo Done thing" });
    expect(done.className).toContain("line-through");
    expect(done.className).toContain("opacity-55");
    // A holiday keeps no mark.
    expect(screen.getByText("Marine Day").querySelector("svg")).toBeNull();
  });

  it("takes focus on open — the first item", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "Standup" })).toHaveFocus();
  });

  it("takes focus on a holiday row when it is the only one (#2565)", () => {
    renderPanel([ITEMS[2]!]);
    expect(screen.getByRole("button", { name: "Marine Day" })).toHaveFocus();
  });

  it("takes focus on the close button when the list is empty", () => {
    renderPanel([]);
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("closes on Escape and hands focus back to 他 N 件", () => {
    const { anchor, onClose } = renderPanel();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(anchor).toHaveFocus();
  });

  it("leaves Escape to the IME while a conversion is open", () => {
    const { onClose } = renderPanel();
    fireEvent.keyDown(document, { key: "Escape", isComposing: true });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on the close button, also back to 他 N 件", () => {
    const { anchor, onClose } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(anchor).toHaveFocus();
  });

  it("closes on a press outside, but not on one inside or on 他 N 件", () => {
    const { anchor, onClose } = renderPanel();
    fireEvent.mouseDown(screen.getByText("Marine Day"));
    // The anchor's own click is the host's toggle.
    fireEvent.mouseDown(anchor);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the page scrolls or the window resizes", () => {
    const { cell, onClose } = renderPanel();
    fireEvent.scroll(cell);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent(window, new Event("resize"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("does not close when its own list scrolls", () => {
    const { onClose } = renderPanel();
    fireEvent.scroll(screen.getByRole("list"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("hands a mouse press over at the pointer, without asking for focus", () => {
    const { onClose, onItemActivate } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Standup" }), {
      detail: 1,
      clientX: 120,
      clientY: 240,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onItemActivate).toHaveBeenCalledWith(
      "e1",
      { x: 120, y: 240 },
      { focus: false },
    );
  });

  it("hands a keyboard press over from the row, asking the bubble for focus", () => {
    const { onItemActivate } = renderPanel();
    // A key press reaches a button as a click with detail 0.
    fireEvent.click(screen.getByRole("button", { name: "Write report" }), {
      detail: 0,
    });
    expect(onItemActivate).toHaveBeenCalledWith(
      "t1",
      { x: 0, y: 0 },
      { focus: true },
    );
  });

  it("walks the rows with the arrow keys, Home and End", () => {
    renderPanel([
      ...ITEMS.slice(0, 2),
      { id: "e2", date: "2026-07-09", title: "Lunch", variant: "event" },
    ]);
    const list = screen.getByRole("list");
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(screen.getByRole("button", { name: "Write report" })).toHaveFocus();
    fireEvent.keyDown(list, { key: "End" });
    expect(screen.getByRole("button", { name: "Lunch" })).toHaveFocus();
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(screen.getByRole("button", { name: "Lunch" })).toHaveFocus();
    fireEvent.keyDown(list, { key: "Home" });
    expect(screen.getByRole("button", { name: "Standup" })).toHaveFocus();
    fireEvent.keyDown(list, { key: "ArrowUp" });
    expect(screen.getByRole("button", { name: "Standup" })).toHaveFocus();
  });

  it("walks onto a holiday row with the arrow keys (#2565)", () => {
    renderPanel();
    fireEvent.keyDown(screen.getByRole("list"), { key: "End" });
    expect(screen.getByRole("button", { name: "Marine Day" })).toHaveFocus();
  });
});

/*
 * #2623 — the rows wear the cell chips' colour rule: the kind's light face, the
 * tag colour on the 3px left line (the kind's colour without one), and a
 * holiday in its Settings colour as a light face and a line.
 */
describe("MonthMorePanel — the face and the left line (#2623)", () => {
  it("draws a row's tag colour on its line and keeps the kind's face", () => {
    renderPanel([
      { ...ITEMS[0]!, tagColor: "#1e3a8a" },
      ITEMS[1]!,
      { ...ITEMS[2]!, tagColor: "#e03e3e" },
    ]);
    const tagged = screen.getByRole("button", { name: "Standup" });
    expect(tagged.style.borderLeftColor).toBe("rgb(30, 58, 138)");
    expect(tagged.style.backgroundColor).toBe("");
    expect(tagged.className).toContain("border-l-[3px]");
    expect(tagged.className).toContain("bg-lumen-chip-event-bg");

    const plain = screen.getByRole("button", { name: "Write report" });
    expect(plain.style.borderLeftColor).toBe("");
    expect(plain.className).toContain("border-l-lumen-chip-task-dot");

    const holiday = screen.getByText("Marine Day");
    expect(holiday.style.borderLeftColor).toBe("rgb(224, 62, 62)");
    expect(holiday.className).toContain("border-l-[3px]");
    expect(holiday.className).toContain("text-lumen-text");
  });
});
