import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { WeekTimeGrid, type WeekTimeGridItem } from "../src/components";

/*
 * WeekTimeGrid (W8) — pure presentational grid. It does NOT call useMediaQuery
 * (the host switches wide↔narrow), so no matchMedia mock is needed; it renders
 * identically under jsdom. We assert the header, all-day lane, timed events,
 * and that clicking an event reports its id back to the host.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const items: WeekTimeGridItem[] = [
  {
    id: "a",
    date: "2026-06-14",
    title: "Standup",
    startTime: "09:00",
    endTime: "09:30",
  },
  {
    id: "b",
    date: "2026-06-15",
    title: "Vacation",
    startTime: "00:00",
    endTime: "23:59",
    isAllDay: true,
  },
  {
    id: "c",
    date: "2026-06-14",
    title: "Review",
    startTime: "09:15",
    endTime: "10:00",
  },
];

function renderGrid(props?: Partial<Parameters<typeof WeekTimeGrid>[0]>) {
  const onSelectItem = vi.fn();
  render(
    <WeekTimeGrid
      weekStart="2026-06-14"
      items={items}
      weekdayLabels={WEEKDAYS}
      allDayLabel="All-day"
      todayKey="2026-06-14"
      onSelectItem={onSelectItem}
      {...props}
    />,
  );
  return { onSelectItem };
}

describe("WeekTimeGrid", () => {
  it("renders the weekday header for all seven days", () => {
    renderGrid();
    for (const label of WEEKDAYS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("renders the all-day lane label and an all-day event", () => {
    renderGrid();
    expect(screen.getByText("All-day")).toBeInTheDocument();
    expect(screen.getByText("Vacation")).toBeInTheDocument();
  });

  it("renders timed events", () => {
    renderGrid();
    expect(screen.getByText("Standup")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
  });

  it("reports the clicked event id to the host", () => {
    const { onSelectItem } = renderGrid();
    fireEvent.click(screen.getByText("Standup"));
    expect(onSelectItem).toHaveBeenCalledWith("a");
  });

  it("reports the clicked all-day event id to the host", () => {
    const { onSelectItem } = renderGrid();
    fireEvent.click(screen.getByText("Vacation"));
    expect(onSelectItem).toHaveBeenCalledWith("b");
  });

  it("supports a single-day column via days={1}", () => {
    renderGrid({ days: 1 });
    // Only Sunday's column (2026-06-14) is present.
    expect(screen.getByText("Sun")).toBeInTheDocument();
    expect(screen.queryByText("Mon")).not.toBeInTheDocument();
  });
});

/*
 * Interactive editing (W8 salvage). The grid stays presentational: the host
 * injects onCreateAt / onMoveItem / onResizeItem and the grid reports snapped
 * results back. Geometry under jsdom: getBoundingClientRect() is all-zero, so a
 * vertical pixel offset maps through pxToMinutes(y, hourHeight=48) at 1.25
 * min/px. Drag move/resize attach native pointermove/up listeners to `window`,
 * so those are dispatched on window (wrapped in act) after the pointerdown.
 */
describe("WeekTimeGrid — interactions", () => {
  const oneItem: WeekTimeGridItem[] = [
    {
      id: "a",
      date: "2026-06-14",
      title: "Standup",
      startTime: "09:00",
      endTime: "09:30",
    },
  ];

  // jsdom has no PointerEvent, and RTL's fireEvent.pointerDown drops `button`
  // (→ beginDrag's `e.button !== 0` guard would early-return). Dispatch a native
  // MouseEvent typed "pointerdown" so React's onPointerDown sees button=0 and
  // real coordinates. Wrapped in act() to flush the setDragging() that attaches
  // the window pointermove/up listeners.
  function firePointerDown(el: Element, clientX: number, clientY: number) {
    act(() => {
      el.dispatchEvent(
        new MouseEvent("pointerdown", {
          bubbles: true,
          button: 0,
          clientX,
          clientY,
        }),
      );
    });
  }

  it("reports a snapped create on an empty-slot click", () => {
    const onCreateAt = vi.fn();
    render(
      <WeekTimeGrid
        weekStart="2026-06-14"
        items={[]}
        weekdayLabels={WEEKDAYS}
        allDayLabel="All-day"
        onCreateAt={onCreateAt}
      />,
    );
    // Per-column catcher has aria-label `Create on <key>` (default). y=96px →
    // 96 * 1.25 = 120min → snap30 = 120 (02:00).
    fireEvent.click(screen.getByLabelText("Create on 2026-06-14"), {
      clientY: 96,
    });
    expect(onCreateAt).toHaveBeenCalledWith("2026-06-14", 120);
  });

  it("reports a moved event (vertical drag = new time) on pointer-up", () => {
    const onMoveItem = vi.fn();
    render(
      <WeekTimeGrid
        weekStart="2026-06-14"
        items={oneItem}
        weekdayLabels={WEEKDAYS}
        allDayLabel="All-day"
        onMoveItem={onMoveItem}
      />,
    );
    // pointerdown on the event body, then drag down 48px (= +60min) and release.
    firePointerDown(screen.getByText("Standup"), 10, 10);
    act(() => {
      window.dispatchEvent(
        new MouseEvent("pointermove", { clientX: 10, clientY: 58 }),
      );
      window.dispatchEvent(new MouseEvent("pointerup", {}));
    });
    // 09:00–09:30 shifted +60min → 10:00–10:30, same day (colWidth=0 in jsdom).
    expect(onMoveItem).toHaveBeenCalledWith(
      "a",
      "2026-06-14",
      "10:00",
      "10:30",
    );
  });

  it("reports a resized event (bottom-handle drag = new end) on pointer-up", () => {
    const onResizeItem = vi.fn();
    const { container } = render(
      <WeekTimeGrid
        weekStart="2026-06-14"
        items={oneItem}
        weekdayLabels={WEEKDAYS}
        allDayLabel="All-day"
        onResizeItem={onResizeItem}
      />,
    );
    const handle = container.querySelector("span.cursor-ns-resize");
    expect(handle).not.toBeNull();
    firePointerDown(handle as Element, 10, 10);
    act(() => {
      window.dispatchEvent(
        new MouseEvent("pointermove", { clientX: 10, clientY: 58 }),
      );
      window.dispatchEvent(new MouseEvent("pointerup", {}));
    });
    // End 09:30 dragged down +60min → 10:30; start unchanged.
    expect(onResizeItem).toHaveBeenCalledWith("a", "10:30");
  });

  it("treats a sub-threshold pointer drag as a selection, not a move", () => {
    const onMoveItem = vi.fn();
    const onSelectItem = vi.fn();
    render(
      <WeekTimeGrid
        weekStart="2026-06-14"
        items={oneItem}
        weekdayLabels={WEEKDAYS}
        allDayLabel="All-day"
        onMoveItem={onMoveItem}
        onSelectItem={onSelectItem}
      />,
    );
    firePointerDown(screen.getByText("Standup"), 10, 10);
    act(() => {
      // 2px move < DRAG_THRESHOLD_PX(4) → never counts as a drag.
      window.dispatchEvent(
        new MouseEvent("pointermove", { clientX: 11, clientY: 11 }),
      );
      window.dispatchEvent(new MouseEvent("pointerup", {}));
    });
    expect(onMoveItem).not.toHaveBeenCalled();
    expect(onSelectItem).toHaveBeenCalledWith("a");
  });
});
