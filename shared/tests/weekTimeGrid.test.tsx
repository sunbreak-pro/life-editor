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

  /*
   * #562 — drop on the all-day lane. jsdom rects are all-zero, so the scroll
   * body's top is 0 and "above the time body" is any negative clientY. The
   * zone test is the same one the browser runs (pointer above the body top),
   * just with the jsdom geometry.
   */
  it("reports an all-day drop (not a move) when released over the lane", () => {
    const onMoveItem = vi.fn();
    const onDropAllDay = vi.fn();
    render(
      <WeekTimeGrid
        weekStart="2026-06-14"
        items={oneItem}
        weekdayLabels={WEEKDAYS}
        allDayLabel="All-day"
        onMoveItem={onMoveItem}
        onDropAllDay={onDropAllDay}
      />,
    );
    firePointerDown(screen.getByText("Standup"), 10, 10);
    act(() => {
      window.dispatchEvent(
        new MouseEvent("pointermove", { clientX: 10, clientY: -40 }),
      );
      window.dispatchEvent(new MouseEvent("pointerup", {}));
    });
    expect(onDropAllDay).toHaveBeenCalledWith("a", "2026-06-14");
    expect(onMoveItem).not.toHaveBeenCalled();
  });

  it("clamps an overshooting move inside the window when onDropAllDay is absent", () => {
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
    // Drag 09:00–09:30 far above the top edge: pre-#562 the snap went negative
    // and minutesToTime flattened both ends to 00:00 (the inverted band).
    firePointerDown(screen.getByText("Standup"), 10, 10);
    act(() => {
      window.dispatchEvent(
        new MouseEvent("pointermove", { clientX: 10, clientY: -500 }),
      );
      window.dispatchEvent(new MouseEvent("pointerup", {}));
    });
    expect(onMoveItem).toHaveBeenCalledWith(
      "a",
      "2026-06-14",
      "00:00",
      "00:30",
    );
  });

  it("writes nothing when a place drag returns to the all-day lane", () => {
    const onMoveItem = vi.fn();
    const onDropAllDay = vi.fn();
    const chip: WeekTimeGridItem[] = [
      {
        id: "tc",
        date: "2026-06-14",
        title: "Candidate",
        startTime: "00:00",
        endTime: "00:00",
        isAllDay: true,
        variant: "task",
      },
    ];
    render(
      <WeekTimeGrid
        weekStart="2026-06-14"
        items={chip}
        weekdayLabels={WEEKDAYS}
        allDayLabel="All-day"
        onMoveItem={onMoveItem}
        onDropAllDay={onDropAllDay}
        taskInteractive
      />,
    );
    firePointerDown(screen.getByText("Candidate"), 10, 10);
    act(() => {
      // Down into the time body first (a real "place" gesture in progress)…
      window.dispatchEvent(
        new MouseEvent("pointermove", { clientX: 10, clientY: 100 }),
      );
      // …then back up over the lane and release: the chip never stopped
      // being all-day, so neither callback fires.
      window.dispatchEvent(
        new MouseEvent("pointermove", { clientX: 10, clientY: -20 }),
      );
      window.dispatchEvent(new MouseEvent("pointerup", {}));
    });
    expect(onMoveItem).not.toHaveBeenCalled();
    expect(onDropAllDay).not.toHaveBeenCalled();
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
