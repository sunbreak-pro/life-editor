import { describe, it, expect, vi, type Mock } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { ReactNode } from "react";
import type {
  AgendaItem,
  MonthGridItem,
  ScheduleLoadState,
  WeekTimeGridItem,
} from "@life-editor/shared";
import { CalendarDesktopLayout } from "../src/schedule/CalendarDesktopLayout";
import type { CalendarDesktopLayoutProps } from "../src/schedule/CalendarDesktopLayout";
import { CalendarNarrowLayout } from "../src/schedule/CalendarNarrowLayout";
import type { CalendarNarrowLayoutProps } from "../src/schedule/CalendarNarrowLayout";

/*
 * #889 — the Calendar's two main areas, pulled out of CalendarTab.
 *
 * ONE file for two components on purpose: the thing worth pinning is a rule
 * implemented TWICE. Loading, "could not load" and the calendar itself are
 * three EXCLUSIVE states, and each layout folds between them in its own return
 * — which is exactly the arrangement that let the two overlay lists drift apart
 * before (see the ScheduleOverlays header). `ScheduleLoadState` exists to stop
 * that, and an it.each across both renderers is what makes the two answer the
 * same question. Every regression here is a blank calendar, which reads as
 * "my items are gone" rather than as a bug.
 *
 * The rest are the differences that are supposed to survive, and each one is a
 * pair of near-identical lines that could quietly become one:
 *
 *   - the chrome sits OUTSIDE the fold. An error state still has to offer the
 *     steppers, or a failed range fetch traps the user on a day they cannot
 *     leave — with the retry as the only control on screen.
 *   - the #296 banner rides ABOVE a calendar that still has rows on it. Both
 *     have to draw content and banner together, or the "degrade quietly"
 *     half of #296 is gone and only the blanking half is left.
 *   - a month cell means different things by width: Desktop opens the creation
 *     panel on it (#224), narrow only moves the picked day (#878). One
 *     callback wired to the other layout's handler is invisible in review.
 *   - the same `monthItems` render at two densities (#878): Desktop draws
 *     title chips, narrow draws dots and answers "what is it" with the list
 *     underneath. A compact grid that lost its flag would put 42 cells of text
 *     on a phone.
 *   - the two "N hidden" counts are DIFFERENT numbers (#466 repeat filter vs
 *     #468 lens) and now travel in two separate prop bundles.
 *
 * `useTranslation` is stubbed to echo its key, with the count appended when
 * there is one — a plain echo would let the two hidden-counts above swap
 * places without a single assertion noticing.
 *
 * No jest-dom in web/: presence comes from getBy* throwing, absence from
 * queryBy* being null (same convention as scheduleSidebar.test.tsx). Nothing
 * below reads a coordinate — jsdom has no layout, so the gestures are driven
 * through DOM events and the positions handed to the handlers are values we
 * supply, never values the page measured.
 */

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number }) =>
      opts?.count === undefined ? key : `${key}:${opts.count}`,
  }),
}));

const TODAY = "2026-08-16";
/** Parked four days off today, so "which day is this?" has exactly one answer. */
const ANCHOR = "2026-08-20";
const WEEK_START = "2026-08-16";

const PERIOD_LABEL = "August 2026";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STATUS_LABELS = {
  notStarted: "Not started",
  inProgress: "In progress",
  done: "Done",
};
const VIEW_OPTIONS = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];
// Distinct from the echoed keys so a toolbar stepper cannot be confused with
// the narrow layout's own, which resolves its label through `t`.
const TOOLBAR_LABELS = {
  today: "toolbar.today",
  prev: "toolbar.prev",
  next: "toolbar.next",
  openSettings: "toolbar.openSettings",
  view: "toolbar.view",
};

/*
 * Three different titles for three different surfaces. The month cell, the
 * week block and the day list all draw "an item", and giving them one title
 * would make "the grid is showing it" and "the list is showing it"
 * indistinguishable.
 */
const MONTH_ITEM: MonthGridItem = {
  id: "event-1",
  date: ANCHOR,
  title: "月セルの予定",
};
const GRID_ITEM: WeekTimeGridItem = {
  id: "event-1",
  date: ANCHOR,
  title: "週グリッドの予定",
  startTime: "10:00",
  endTime: "11:00",
};
const AGENDA_ITEM: AgendaItem = {
  id: "event-1",
  title: "日リストの予定",
  startTime: "10:00",
  endTime: "11:00",
  // #222 replaced the round check with the status tag, so a row without a
  // status has no completion control at all — and `onToggleComplete` would be
  // a prop nothing can reach.
  status: "notStarted",
};

const AGENDA_LABELS = {
  allDay: "agenda.allDay",
  empty: "agenda.empty",
  nowLabel: "09:00",
  complete: "agenda.complete",
  statusLabels: STATUS_LABELS,
};

function renderDesktop(
  over: {
    view?: CalendarDesktopLayoutProps["view"];
    state?: Partial<ScheduleLoadState>;
    banner?: ReactNode;
    toolbar?: Partial<CalendarDesktopLayoutProps["toolbar"]>;
    lens?: Partial<CalendarDesktopLayoutProps["lens"]>;
    data?: Partial<CalendarDesktopLayoutProps["data"]>;
  } = {},
) {
  const onRetry: Mock = vi.fn();
  const toolbarSpies = {
    onToday: vi.fn(),
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onChangeView: vi.fn(),
    onToggleRepeats: vi.fn(),
    onOpenSettings: vi.fn(),
    onAddEvent: vi.fn(),
  };
  const handlers = {
    onItemActivate: vi.fn(),
    onItemDoubleClick: vi.fn(),
    onItemContextMenu: vi.fn(),
    onMonthCreate: vi.fn(),
    onCreateAt: vi.fn(),
    onMoveItem: vi.fn(),
    onResizeItem: vi.fn(),
    onDropAllDay: vi.fn(),
  };
  const props: CalendarDesktopLayoutProps = {
    view: over.view ?? "month",
    toolbar: {
      periodLabel: PERIOD_LABEL,
      viewOptions: VIEW_OPTIONS,
      labels: TOOLBAR_LABELS,
      repeatsHidden: false,
      hiddenRepeats: 0,
      ...toolbarSpies,
      ...over.toolbar,
    },
    lens: {
      chips: [],
      activeId: null,
      hiddenCount: 0,
      onChange: vi.fn(),
      ...over.lens,
    },
    banner: over.banner ?? null,
    state: { loading: false, error: false, ...over.state, onRetry },
    data: {
      anchorDate: ANCHOR,
      weekStart: WEEK_START,
      today: TODAY,
      weekStartsOn: 0,
      monthItems: [MONTH_ITEM],
      gridItems: [GRID_ITEM],
      selectedId: null,
      nowMinutes: 540,
      ...over.data,
    },
    labels: { weekdays: WEEKDAYS, status: STATUS_LABELS },
    handlers,
    // Identity for the cell names so a day can be queried by its key, and a
    // marked column caption so the week's columns can be counted.
    format: { fullDay: (k) => k, dayDate: (k) => `col:${k}` },
  };
  const utils = render(<CalendarDesktopLayout {...props} />);
  return { ...utils, onRetry, toolbarSpies, handlers };
}

function renderNarrow(
  over: {
    state?: Partial<ScheduleLoadState>;
    banner?: ReactNode;
    month?: Partial<CalendarNarrowLayoutProps["month"]>;
    day?: Partial<CalendarNarrowLayoutProps["day"]>;
  } = {},
) {
  const onRetry: Mock = vi.fn();
  const header = {
    periodLabel: PERIOD_LABEL,
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onToday: vi.fn(),
  };
  const monthSpies = { onSelectDay: vi.fn() };
  const daySpies = {
    onAdd: vi.fn(),
    onToggleComplete: vi.fn(),
    onItemActivate: vi.fn(),
    onItemDoubleClick: vi.fn(),
  };
  const props: CalendarNarrowLayoutProps = {
    header,
    banner: over.banner ?? null,
    state: { loading: false, error: false, ...over.state, onRetry },
    month: {
      anchorDate: ANCHOR,
      today: TODAY,
      weekStartsOn: 0,
      weekdayLabels: WEEKDAYS,
      items: [MONTH_ITEM],
      formatDayLabel: (k) => k,
      ...monthSpies,
      ...over.month,
    },
    day: {
      anchorDayLabel: "Thu, August 20",
      agenda: [AGENDA_ITEM],
      nowMinutes: null,
      selectedId: null,
      labels: AGENDA_LABELS,
      formatGapLabel: (m) => `gap:${m}`,
      ...daySpies,
      ...over.day,
    },
  };
  const utils = render(<CalendarNarrowLayout {...props} />);
  return { ...utils, onRetry, header, monthSpies, daySpies };
}

/** The calendar itself — both layouts name their grid with the same key. */
const calendarShowing = () =>
  screen.queryByRole("grid", { name: "scheduleScreen.calendar" }) !== null;
const loadingShowing = () =>
  screen.queryByText("scheduleScreen.loading") !== null;
const errorCardShowing = () =>
  screen.queryByText("scheduleScreen.loadError") !== null;

type FoldOverrides = { state?: Partial<ScheduleLoadState>; banner?: ReactNode };
type FoldCase = [
  name: string,
  renderLayout: (over?: FoldOverrides) => { onRetry: Mock },
  /** aria-label of the "next period" stepper — each layout draws its own. */
  nextLabel: string,
];

const FOLD_CASES: FoldCase[] = [
  ["Desktop", renderDesktop, TOOLBAR_LABELS.next],
  ["Mobile", renderNarrow, "scheduleScreen.next"],
];

describe("the load fold — three exclusive states, drawn the same way at both widths", () => {
  it.each(FOLD_CASES)(
    "%s shows the loading card alone while the first fetch is in flight",
    (_name, renderLayout) => {
      renderLayout({ state: { loading: true } });
      expect(loadingShowing()).toBe(true);
      expect(errorCardShowing()).toBe(false);
      expect(calendarShowing()).toBe(false);
    },
  );

  it.each(FOLD_CASES)(
    "%s shows the error card alone, and its retry re-runs the range fetch",
    (_name, renderLayout) => {
      const { onRetry } = renderLayout({ state: { error: true } });
      expect(errorCardShowing()).toBe(true);
      expect(loadingShowing()).toBe(false);
      expect(calendarShowing()).toBe(false);

      fireEvent.click(screen.getByText("scheduleScreen.retry"));
      expect(onRetry).toHaveBeenCalledTimes(1);
    },
  );

  it.each(FOLD_CASES)(
    "%s draws the calendar once the data lands, and neither card with it",
    (_name, renderLayout) => {
      renderLayout();
      expect(calendarShowing()).toBe(true);
      expect(loadingShowing()).toBe(false);
      expect(errorCardShowing()).toBe(false);
    },
  );

  /*
   * The states are a ternary chain, not three independent conditions. A fold
   * rewritten as `{loading && …}{error && …}` passes every case above and
   * stacks two cards the moment a fetch fails while another is in flight.
   */
  it.each(FOLD_CASES)(
    "%s never draws two of the three at once",
    (_name, renderLayout) => {
      renderLayout({ state: { loading: true, error: true } });
      expect(loadingShowing()).toBe(true);
      expect(errorCardShowing()).toBe(false);
      expect(calendarShowing()).toBe(false);
    },
  );

  /*
   * The chrome is deliberately outside the fold. Fold it in and a failed range
   * fetch leaves the retry as the only control on screen — no way to step to a
   * range that might load, and no way to read which range failed.
   */
  it.each(FOLD_CASES)(
    "%s keeps the period label and the steppers reachable through the error state",
    (_name, renderLayout, nextLabel) => {
      renderLayout({ state: { error: true } });
      expect(screen.getByText(PERIOD_LABEL)).toBeTruthy();
      expect(screen.getByLabelText(nextLabel)).toBeTruthy();
    },
  );

  /*
   * #296's other half. The banner exists precisely for "the fetch failed but
   * the calendar still has rows on it", so a layout that drew one or the other
   * would be back to blanking a populated calendar.
   */
  it.each(FOLD_CASES)(
    "%s rides the #296 banner above a calendar that still has rows",
    (_name, renderLayout) => {
      renderLayout({ banner: <div data-testid="range-banner" /> });
      expect(screen.getByTestId("range-banner")).toBeTruthy();
      expect(calendarShowing()).toBe(true);
    },
  );
});

describe("CalendarDesktopLayout — the view decides which grid", () => {
  it("draws the month grid in month view", () => {
    renderDesktop({ view: "month" });
    expect(screen.getByText(MONTH_ITEM.title)).toBeTruthy();
    // The week grid's all-day lane is its cheapest tell.
    expect(screen.queryByText("scheduleScreen.allDay")).toBeNull();
  });

  it("draws seven columns of the time grid in week view, starting at weekStart", () => {
    renderDesktop({ view: "week" });
    expect(screen.getByText("scheduleScreen.allDay")).toBeTruthy();
    expect(screen.getAllByText(/^col:/)).toHaveLength(7);
    expect(screen.getByText(`col:${WEEK_START}`)).toBeTruthy();
    expect(calendarShowing()).toBe(false);
  });

  /*
   * Day view is the ANCHOR's column, not the week's first — the two are
   * different dates whenever the user has stepped within a week, and the
   * layout picks between them with a conditional that reads as boilerplate.
   */
  it("narrows to the anchor day — not the week start — in day view", () => {
    renderDesktop({ view: "day" });
    expect(screen.getAllByText(/^col:/)).toHaveLength(1);
    expect(screen.getByText(`col:${ANCHOR}`)).toBeTruthy();
  });

  it("opens the creation panel on a month cell (#224)", () => {
    const { handlers } = renderDesktop({ view: "month" });
    fireEvent.click(screen.getByLabelText(ANCHOR));
    expect(handlers.onMonthCreate).toHaveBeenCalledWith(ANCHOR);
  });

  /*
   * Two "N hidden" numbers on one screen, now in two prop bundles: the repeat
   * filter's count belongs on the toolbar button, the lens's count beside the
   * chips. Crossed, each line confidently states the other's number.
   */
  it("keeps the repeat count and the lens count on their own lines (#466 / #468)", () => {
    renderDesktop({
      toolbar: { repeatsHidden: true, hiddenRepeats: 3 },
      lens: {
        chips: [{ id: "cal-1", label: "Work" }],
        activeId: "cal-1",
        hiddenCount: 5,
      },
    });
    expect(
      screen.getByText("scheduleScreen.repeatFilterHidden:3"),
    ).toBeTruthy();
    expect(
      screen.getByText("scheduleScreen.calendarFilterHidden:5"),
    ).toBeTruthy();
  });
});

describe("CalendarNarrowLayout — the month grid and the day under it", () => {
  it("draws the picked day's caption and its list below the grid", () => {
    renderNarrow();
    expect(screen.getByText("Thu, August 20")).toBeTruthy();
    expect(screen.getByText(AGENDA_ITEM.title)).toBeTruthy();
    expect(calendarShowing()).toBe(true);
  });

  it("only picks the day when a month cell is tapped (#878)", () => {
    const { monthSpies } = renderNarrow();
    fireEvent.click(screen.getByLabelText(ANCHOR));
    expect(monthSpies.onSelectDay).toHaveBeenCalledWith(ANCHOR);
  });

  it("creates from the day-list header (#1034)", () => {
    const { daySpies } = renderNarrow();
    fireEvent.click(screen.getByText("scheduleScreen.addCta"));
    expect(daySpies.onAdd).toHaveBeenCalledTimes(1);
  });

  /*
   * The add pill lives INSIDE the fold, with the list it belongs to. Left
   * outside it, a failed fetch would offer "add to this day" above a card
   * saying the day could not be read.
   */
  it("takes the add affordance away with the list", () => {
    renderNarrow({ state: { error: true } });
    expect(screen.queryByText("scheduleScreen.addCta")).toBeNull();
    expect(screen.queryByText(AGENDA_ITEM.title)).toBeNull();
  });
});

describe("the same month, two densities (#878)", () => {
  /*
   * `compact` is what makes 42 cells legible on a phone: dots say WHERE
   * something is, and the list underneath says WHAT. Lose the flag and the
   * grid puts Desktop's title chips into cells a seventh of a phone wide.
   */
  it("Desktop names the items in the cells; narrow leaves that to the list", () => {
    const wide = renderDesktop({ view: "month" });
    expect(screen.getByText(MONTH_ITEM.title)).toBeTruthy();
    wide.unmount();

    renderNarrow();
    expect(screen.queryByText(MONTH_ITEM.title)).toBeNull();
    expect(screen.getByText(AGENDA_ITEM.title)).toBeTruthy();
  });

  /*
   * Only narrow has a picked day, so only narrow marks one. MonthGrid omits
   * `aria-selected` entirely without a `selectedKey` on purpose — a grid whose
   * every cell says "false" tells a screen reader there is a selection to
   * make, and Desktop's month view has none.
   */
  it("marks the picked cell on narrow and nowhere on Desktop", () => {
    const cell = () =>
      screen.getByLabelText(ANCHOR).closest('[role="gridcell"]');

    const wide = renderDesktop({ view: "month" });
    expect(cell()?.getAttribute("aria-selected")).toBeNull();
    wide.unmount();

    renderNarrow();
    expect(cell()?.getAttribute("aria-selected")).toBe("true");
  });
});

/*
 * The chrome and the gestures — the half of a prop-forwarding extraction that
 * nothing else can catch.
 *
 * Both layouts BUILD these callbacks and hand them on, and every assertion
 * above is about what is drawn rather than about what a press does. Swap the
 * two bindings in the narrow header (ChevronLeft gets onNext, ChevronRight
 * gets onPrev) and every other case in this file stays green while the
 * calendar pages backwards at both widths; write `onItemDoubleClick:
 * handlers.onItemActivate` in the week-grid block and the detail hand-off is
 * gone with the same silence.
 *
 * So each case fires ONE control and requires every sibling spy to stay
 * silent. A crossed pair then fails twice — once on the callback that did not
 * run, once on the one that ran in its place — which is what tells a swap
 * apart from a dropped prop.
 */

type ToolbarSpy =
  | "onToday"
  | "onPrev"
  | "onNext"
  | "onChangeView"
  | "onToggleRepeats"
  | "onOpenSettings"
  | "onAddEvent";

/** Each toolbar control: the spy it must reach, how to press it, what it carries. */
const TOOLBAR_CASES: [ToolbarSpy, () => HTMLElement, unknown[]][] = [
  ["onToday", () => screen.getByText(TOOLBAR_LABELS.today), []],
  ["onPrev", () => screen.getByLabelText(TOOLBAR_LABELS.prev), []],
  ["onNext", () => screen.getByLabelText(TOOLBAR_LABELS.next), []],
  // The switcher is the one that carries a value, and the value is the whole
  // point: a segment wired to the wrong id lands the body on another grid.
  ["onChangeView", () => screen.getByText("Week"), ["week"]],
  [
    "onToggleRepeats",
    () => screen.getByText("scheduleScreen.repeatFilterHide"),
    [],
  ],
  [
    "onOpenSettings",
    () => screen.getByLabelText(TOOLBAR_LABELS.openSettings),
    [],
  ],
  ["onAddEvent", () => screen.getByText("scheduleScreen.addEvent"), []],
];

const NARROW_CHROME = ["onPrev", "onNext", "onToday"] as const;

const NARROW_CHROME_CASES: [
  (typeof NARROW_CHROME)[number],
  () => HTMLElement,
][] = [
  ["onPrev", () => screen.getByLabelText("scheduleScreen.prev")],
  ["onNext", () => screen.getByLabelText("scheduleScreen.next")],
  ["onToday", () => screen.getByText("scheduleScreen.today")],
];

describe("the chrome — one control, one callback", () => {
  it.each(TOOLBAR_CASES)(
    "Desktop's %s runs on its own control and on no other",
    (name, findControl, args) => {
      const { toolbarSpies } = renderDesktop();

      fireEvent.click(findControl());

      expect(toolbarSpies[name]).toHaveBeenCalledTimes(1);
      if (args.length > 0) {
        expect(toolbarSpies[name]).toHaveBeenCalledWith(...args);
      }
      for (const [other, spy] of Object.entries(toolbarSpies)) {
        if (other !== name) expect(spy).not.toHaveBeenCalled();
      }
    },
  );

  it.each(NARROW_CHROME_CASES)(
    "narrow's %s runs on its own control and on no other",
    (name, findControl) => {
      const { header } = renderNarrow();

      fireEvent.click(findControl());

      expect(header[name]).toHaveBeenCalledTimes(1);
      for (const other of NARROW_CHROME) {
        if (other !== name) expect(header[other]).not.toHaveBeenCalled();
      }
    },
  );
});

/*
 * A press and release that never moves. A movable block has no onClick — the
 * drag hook owns the gesture and turns a pointer-up below the drag threshold
 * into the activation (#297 / #564) — so a plain click on a week block would
 * assert nothing. Coordinates are values handed IN, as everywhere else here:
 * jsdom measures nothing.
 */
function pressAndRelease(el: Element, x: number, y: number) {
  act(() => {
    el.dispatchEvent(
      new MouseEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: x,
        clientY: y,
      }),
    );
  });
  act(() => {
    window.dispatchEvent(
      new MouseEvent("pointerup", { clientX: x, clientY: y }),
    );
  });
}

describe("the item gestures — three presses, three handlers, per surface", () => {
  it("Desktop keeps a month chip's three apart (#224 stays out of them)", () => {
    const { handlers } = renderDesktop({ view: "month" });
    const chip = screen.getByRole("button", { name: MONTH_ITEM.title });

    fireEvent.click(chip, { clientX: 5, clientY: 6 });
    fireEvent.doubleClick(chip);
    fireEvent.contextMenu(chip, { clientX: 7, clientY: 8 });

    expect(handlers.onItemActivate).toHaveBeenCalledTimes(1);
    expect(handlers.onItemActivate).toHaveBeenCalledWith(MONTH_ITEM.id, {
      x: 5,
      y: 6,
    });
    expect(handlers.onItemDoubleClick).toHaveBeenCalledTimes(1);
    expect(handlers.onItemDoubleClick).toHaveBeenCalledWith(MONTH_ITEM.id);
    expect(handlers.onItemContextMenu).toHaveBeenCalledTimes(1);
    expect(handlers.onItemContextMenu).toHaveBeenCalledWith(MONTH_ITEM.id, {
      x: 7,
      y: 8,
    });
    // The cell's day-select target sits under the chip: a chip press that
    // reached it would open the creation panel behind the bubble (#224).
    expect(handlers.onMonthCreate).not.toHaveBeenCalled();
  });

  it("Desktop keeps a week block's three apart", () => {
    const { handlers } = renderDesktop({ view: "week" });
    const block = screen.getByText(GRID_ITEM.title);

    pressAndRelease(block, 5, 6);
    fireEvent.doubleClick(block);
    fireEvent.contextMenu(block, { clientX: 7, clientY: 8 });

    expect(handlers.onItemActivate).toHaveBeenCalledTimes(1);
    expect(handlers.onItemActivate).toHaveBeenCalledWith(GRID_ITEM.id, {
      x: 5,
      y: 6,
    });
    expect(handlers.onItemDoubleClick).toHaveBeenCalledTimes(1);
    expect(handlers.onItemDoubleClick).toHaveBeenCalledWith(GRID_ITEM.id);
    expect(handlers.onItemContextMenu).toHaveBeenCalledTimes(1);
    expect(handlers.onItemContextMenu).toHaveBeenCalledWith(GRID_ITEM.id, {
      x: 7,
      y: 8,
    });
    // A press that never moved is not a move — the write path stays shut.
    expect(handlers.onMoveItem).not.toHaveBeenCalled();
  });

  it("narrow keeps the day list's three apart", () => {
    const { daySpies } = renderNarrow();
    const row = screen.getByText(AGENDA_ITEM.title);

    fireEvent.click(row, { clientX: 5, clientY: 6 });
    fireEvent.doubleClick(row);
    // Completion is the status tag since #222, and it sits OUTSIDE the row
    // button — pressing it must not read as opening the row.
    fireEvent.click(screen.getByLabelText(AGENDA_LABELS.complete));

    expect(daySpies.onItemActivate).toHaveBeenCalledTimes(1);
    expect(daySpies.onItemActivate).toHaveBeenCalledWith(AGENDA_ITEM.id, {
      x: 5,
      y: 6,
    });
    expect(daySpies.onItemDoubleClick).toHaveBeenCalledTimes(1);
    expect(daySpies.onItemDoubleClick).toHaveBeenCalledWith(AGENDA_ITEM.id);
    expect(daySpies.onToggleComplete).toHaveBeenCalledTimes(1);
    expect(daySpies.onToggleComplete).toHaveBeenCalledWith(AGENDA_ITEM.id);
    expect(daySpies.onAdd).not.toHaveBeenCalled();
  });
});
