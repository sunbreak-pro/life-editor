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

/**
 * #893 folded the grid's props into bundles (`data` / `labels` / `handlers` /
 * `display` / `format`). The cases below still describe their setup in flat
 * terms and are unchanged from before that refactor — the folding happens
 * here, which keeps "same cases, same assertions, still green" a usable
 * no-behaviour-change proof.
 */
function renderGrid(props?: { days?: number }) {
  const onSelectItem = vi.fn();
  render(
    <WeekTimeGrid
      data={{
        weekStart: "2026-06-14",
        items,
        todayKey: "2026-06-14",
        days: props?.days,
      }}
      labels={{ weekdays: WEEKDAYS, allDay: "All-day" }}
      handlers={{ onSelectItem }}
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
 * #563 — column alignment. jsdom has no layout (every rect is 0 and there is no
 * scrollbar), so the misalignment itself cannot be reproduced here. What CAN be
 * pinned is the structure that makes it impossible: the header, the all-day lane
 * and the time grid must divide ONE width inside ONE scroll box. When only the
 * time grid sat inside the scroll box it alone lost the scrollbar's width, and
 * each `1fr` column drifted a fraction of it further left than the lane above.
 */
describe("WeekTimeGrid — column alignment (#563)", () => {
  const BANDS = ["header", "allday", "time"] as const;

  function bands(container: HTMLElement) {
    return BANDS.map((band) => {
      const el = container.querySelector<HTMLElement>(
        `[data-week-grid="${band}"]`,
      );
      expect(el, `missing band: ${band}`).not.toBeNull();
      return el as HTMLElement;
    });
  }

  it("puts all three bands in the same scroll box", () => {
    const { container } = render(
      <WeekTimeGrid
        data={{ weekStart: "2026-06-14", items }}
        labels={{ weekdays: WEEKDAYS, allDay: "All-day" }}
      />,
    );
    const scroll = container.querySelector<HTMLElement>(
      '[data-week-grid="scroll"]',
    );
    expect(scroll).not.toBeNull();
    // Exactly one scrolling box: a second one would give its subtree a private
    // scrollbar and reintroduce the mismatch.
    expect(container.querySelectorAll(".overflow-y-auto")).toHaveLength(1);
    for (const band of bands(container)) {
      expect(band.closest(".overflow-y-auto")).toBe(scroll);
    }
  });

  it("gives all three bands the same column template", () => {
    const { container } = render(
      <WeekTimeGrid
        data={{ weekStart: "2026-06-14", days: 5, items }}
        labels={{ weekdays: WEEKDAYS, allDay: "All-day" }}
      />,
    );
    const templates = bands(container).map(
      (band) => band.style.gridTemplateColumns,
    );
    expect(templates[0]).not.toBe("");
    expect(new Set(templates).size).toBe(1);
    // The template follows `days`, so a 5-day view splits five columns in all
    // three bands rather than only in the one that happens to be visible.
    expect(templates[0]).toContain("repeat(5,");
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
        data={{ weekStart: "2026-06-14", items: [] }}
        labels={{ weekdays: WEEKDAYS, allDay: "All-day" }}
        handlers={{ onCreateAt }}
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
        data={{ weekStart: "2026-06-14", items: oneItem }}
        labels={{ weekdays: WEEKDAYS, allDay: "All-day" }}
        handlers={{ onMoveItem }}
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
        data={{ weekStart: "2026-06-14", items: oneItem }}
        labels={{ weekdays: WEEKDAYS, allDay: "All-day" }}
        handlers={{ onResizeItem }}
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
        data={{ weekStart: "2026-06-14", items: oneItem }}
        labels={{ weekdays: WEEKDAYS, allDay: "All-day" }}
        handlers={{ onMoveItem, onDropAllDay }}
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
        data={{ weekStart: "2026-06-14", items: oneItem }}
        labels={{ weekdays: WEEKDAYS, allDay: "All-day" }}
        handlers={{ onMoveItem }}
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
        data={{ weekStart: "2026-06-14", items: chip }}
        labels={{ weekdays: WEEKDAYS, allDay: "All-day" }}
        handlers={{ onMoveItem, onDropAllDay }}
        display={{ todoInteractive: true }}
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
        data={{ weekStart: "2026-06-14", items: oneItem }}
        labels={{ weekdays: WEEKDAYS, allDay: "All-day" }}
        handlers={{ onMoveItem, onSelectItem }}
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

  /*
   * #563 — the two drag reference points that moved when the header/all-day
   * band went inside the scroll box. The all-zero jsdom rects cannot tell the
   * scroll box's top apart from the lane's bottom (both 0), so these two hand
   * the drag the geometry of a REAL week view instead: the scroll box starts at
   * the viewport top, the sticky band occupies 0–80, and the time grid has
   * scrolled 200px up under it (80 - 200 = -120). Reading the wrong element
   * then lands on a different answer, which is what these assert.
   */
  const SCROLL_TOP = 200;
  const BAND_BOTTOM = 80; // = all-day lane's bottom edge
  const TIME_TOP = BAND_BOTTOM - SCROLL_TOP; // grid origin, scrolled out of view

  function stubGridGeometry(container: HTMLElement) {
    const rectAt = (top: number, height: number) => () =>
      ({
        top,
        bottom: top + height,
        left: 0,
        right: 0,
        width: 0,
        height,
        x: 0,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect;
    const band = (name: string) => {
      const el = container.querySelector<HTMLElement>(
        `[data-week-grid="${name}"]`,
      );
      expect(el, `missing band: ${name}`).not.toBeNull();
      return el as HTMLElement;
    };
    const scroll = band("scroll");
    scroll.getBoundingClientRect = rectAt(0, 600);
    Object.defineProperty(scroll, "scrollTop", {
      configurable: true,
      get: () => SCROLL_TOP,
      set: () => {},
    });
    band("header").getBoundingClientRect = rectAt(0, 50);
    band("allday").getBoundingClientRect = rectAt(50, BAND_BOTTOM - 50);
    band("time").getBoundingClientRect = rectAt(TIME_TOP, 24 * 48);
  }

  /*
   * #564 — every all-day chip reports its click gestures.
   *
   * The Issue reported the lane as having no affordance at all, so the grid's
   * half of that is pinned per gesture and per chip kind. The two kinds take
   * DIFFERENT routes to the same callback: an events/routines chip has a plain
   * onClick, while a todo chip's click is the pointer-up of a place drag that
   * never moved (#297 guard), so a regression in either one is invisible from
   * the other.
   */
  const allDayChips: WeekTimeGridItem[] = [
    {
      id: "ev",
      date: "2026-06-14",
      title: "Vacation",
      startTime: "00:00",
      endTime: "23:59",
      isAllDay: true,
      variant: "event",
    },
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

  function renderAllDayLane() {
    const handlers = {
      onItemActivate: vi.fn(),
      onItemContextMenu: vi.fn(),
      onItemDoubleClick: vi.fn(),
    };
    render(
      <WeekTimeGrid
        data={{ weekStart: "2026-06-14", items: allDayChips }}
        labels={{ weekdays: WEEKDAYS, allDay: "All-day" }}
        handlers={{ onMoveItem: vi.fn(), ...handlers }}
        display={{ todoInteractive: true }}
      />,
    );
    return handlers;
  }

  it("activates an all-day event chip on a plain click", () => {
    const { onItemActivate } = renderAllDayLane();
    fireEvent.click(screen.getByText("Vacation"), { clientX: 7, clientY: 9 });
    expect(onItemActivate).toHaveBeenCalledWith("ev", { x: 7, y: 9 });
  });

  it("activates an all-day todo chip when its place drag never moves", () => {
    const { onItemActivate } = renderAllDayLane();
    // The chip is draggable, so it has no onClick — the gesture is a press and
    // release below the drag threshold.
    firePointerDown(screen.getByText("Candidate"), 10, 10);
    act(() => {
      window.dispatchEvent(
        new MouseEvent("pointerup", { clientX: 10, clientY: 10 }),
      );
    });
    expect(onItemActivate).toHaveBeenCalledWith("tc", { x: 10, y: 10 });
  });

  it("reports a right-click on either kind of all-day chip", () => {
    const { onItemContextMenu } = renderAllDayLane();
    fireEvent.contextMenu(screen.getByText("Vacation"), {
      clientX: 1,
      clientY: 2,
    });
    fireEvent.contextMenu(screen.getByText("Candidate"), {
      clientX: 3,
      clientY: 4,
    });
    expect(onItemContextMenu).toHaveBeenNthCalledWith(1, "ev", { x: 1, y: 2 });
    expect(onItemContextMenu).toHaveBeenNthCalledWith(2, "tc", { x: 3, y: 4 });
  });

  it("reports a double-click on either kind of all-day chip", () => {
    const { onItemDoubleClick } = renderAllDayLane();
    fireEvent.doubleClick(screen.getByText("Vacation"));
    // Pre-#564 the draggable chip had no dblclick handler at all, which left
    // the detail hand-off unreachable from the lane.
    fireEvent.doubleClick(screen.getByText("Candidate"));
    expect(onItemDoubleClick).toHaveBeenNthCalledWith(1, "ev");
    expect(onItemDoubleClick).toHaveBeenNthCalledWith(2, "tc");
  });

  it("still swallows the activation when a place drag actually moves", () => {
    const onMoveItem = vi.fn();
    const onItemActivate = vi.fn();
    render(
      <WeekTimeGrid
        data={{ weekStart: "2026-06-14", items: allDayChips }}
        labels={{ weekdays: WEEKDAYS, allDay: "All-day" }}
        handlers={{ onMoveItem, onItemActivate }}
        display={{ todoInteractive: true }}
      />,
    );
    firePointerDown(screen.getByText("Candidate"), 10, 10);
    act(() => {
      window.dispatchEvent(
        new MouseEvent("pointermove", { clientX: 10, clientY: 100 }),
      );
      window.dispatchEvent(new MouseEvent("pointerup", {}));
    });
    expect(onMoveItem).toHaveBeenCalled();
    expect(onItemActivate).not.toHaveBeenCalled();
  });

  it("treats the all-day lane's own bottom edge as the drop-to-all-day boundary", () => {
    const onMoveItem = vi.fn();
    const onDropAllDay = vi.fn();
    const { container } = render(
      <WeekTimeGrid
        data={{ weekStart: "2026-06-14", items: oneItem }}
        labels={{ weekdays: WEEKDAYS, allDay: "All-day" }}
        handlers={{ onMoveItem, onDropAllDay }}
      />,
    );
    stubGridGeometry(container);
    // Drag the block up from inside the time body to y=40, i.e. onto the band
    // (0–80) but BELOW the scroll box's top (0) — the old reference point would
    // read this as a plain time move.
    firePointerDown(screen.getByText("Standup"), 10, 300);
    act(() => {
      window.dispatchEvent(
        new MouseEvent("pointermove", { clientX: 10, clientY: 40 }),
      );
      window.dispatchEvent(new MouseEvent("pointerup", {}));
    });
    expect(onDropAllDay).toHaveBeenCalledWith("a", "2026-06-14");
    expect(onMoveItem).not.toHaveBeenCalled();
  });

  it("maps a place drop through the time grid's own origin, not the scroll box", () => {
    const onMoveItem = vi.fn();
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
    const { container } = render(
      <WeekTimeGrid
        data={{ weekStart: "2026-06-14", items: chip }}
        labels={{ weekdays: WEEKDAYS, allDay: "All-day" }}
        handlers={{ onMoveItem }}
        display={{ todoInteractive: true }}
      />,
    );
    stubGridGeometry(container);
    // Release at y=100: 100 - (-120) = 220px into the grid → 275min → snap30 →
    // 270 = 04:30 (+ the 60min default duration). Going through the scroll box
    // instead (100 - 0 + scrollTop 200 = 300px) would land on 06:30.
    firePointerDown(screen.getByText("Candidate"), 10, 60);
    act(() => {
      window.dispatchEvent(
        new MouseEvent("pointermove", { clientX: 10, clientY: 100 }),
      );
      window.dispatchEvent(new MouseEvent("pointerup", {}));
    });
    expect(onMoveItem).toHaveBeenCalledWith(
      "tc",
      "2026-06-14",
      "04:30",
      "05:30",
    );
  });
});
