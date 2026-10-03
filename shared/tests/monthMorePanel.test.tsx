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
    // #1626: a holiday is drawn, not operated — the same rule as the cell.
    expect(screen.queryByRole("button", { name: "Marine Day" })).toBeNull();
    expect(screen.getByText("Marine Day")).toBeInTheDocument();
  });

  it("takes focus on open — the first item", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "Standup" })).toHaveFocus();
  });

  it("takes focus on the close button when nothing in it can be pressed", () => {
    renderPanel([ITEMS[2]!]);
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
});
