import { describe, it, expect, vi } from "vitest";
import { useCallback, useState } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { MonthGridItem } from "@life-editor/shared";
import { CalendarDesktopLayout } from "../src/schedule/CalendarDesktopLayout";
import type { CalendarDesktopLayoutProps } from "../src/schedule/CalendarDesktopLayout";
import { ScheduleOverlays } from "../src/schedule/ScheduleOverlays";
import type { ScheduleOverlaysProps } from "../src/schedule/ScheduleOverlays";

/*
 * #1582 — why opening the Desktop month view's creation panel felt slow.
 *
 * It was never the panel. Clicking a blank cell sets ONE piece of state in
 * CalendarTab (`createPanel`), and that re-renders the whole host: the panel
 * that is about to appear, and also the month grid underneath it — 42 cells
 * and every item chip on them — which had not changed at all. Profiled in this
 * harness, that redraw was roughly three quarters of the click's render work.
 *
 * <MonthGrid> is memoised now, so the click only builds the panel. A memo is
 * only as good as the identity of what is passed to it, though, and that is
 * the part a type-checker cannot see: `formatMoreCount` was an inline arrow in
 * both layouts, freshly allocated on every render, and one such prop is enough
 * to make the comparison fail every time.
 *
 * So this file does not assert milliseconds — jsdom has no layout or paint, so
 * its numbers describe this runner and not a browser, and a threshold on them
 * would flake on a loaded CI box. It asserts the thing that actually regressed
 * and that IS deterministic: HOW MANY TIMES the grid re-renders.
 *
 * The counter is `format.fullDay`. MonthGrid calls it once per cell while
 * rendering (the accessible name of each day button), so 0 calls after the
 * click means the grid did not render and 42 means it did. Nothing about the
 * measurement depends on a clock.
 */

/*
 * ONE `t`, hoisted — react-i18next caches its own in a ref and hands back the
 * same function until the language or the store revision moves
 * (useTranslation.js `snapshotRef`). A stub that allocated a fresh arrow per
 * call would invalidate every `useCallback([t])` in the layouts once a render,
 * which is a property of the stub rather than of the app — and it would hide
 * exactly the bug this file is about.
 */
const t = (key: string, opts?: { count?: number }) =>
  opts?.count === undefined ? key : `${key}:${opts.count}`;

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useTranslation: () => ({ t }),
}));

const TODAY = "2026-08-16";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/*
 * Cells per grid. Not a constant across months: monthGridKeys lays out whole
 * weeks from the Sunday on or before the 1st, so August 2026 (Sat 1st) needs
 * six rows and September (Tue 1st, 30 days) fits in five.
 */
const AUGUST_CELLS = 42;
const SEPTEMBER_CELLS = 35;

const ITEMS: MonthGridItem[] = Array.from(
  { length: 31 },
  (_, i) => i + 1,
).flatMap((d) =>
  [0, 1, 2].map((n) => ({
    id: `event-${d}-${n}`,
    date: `2026-08-${String(d).padStart(2, "0")}`,
    title: `予定 ${d}-${n}`,
    variant: (n === 2
      ? "task"
      : n === 1
        ? "routine"
        : "event") as MonthGridItem["variant"],
    completed: false,
  })),
);

/*
 * Hoisted for the same reason the layouts memoise their formatter: CalendarTab
 * passes useCallbacks (useScheduleSelection) and useMemos
 * (useScheduleGridFilters) here, so rebuilding them per render would measure
 * the harness instead of the host.
 */
const NOOP = () => {};
const VIEW_OPTIONS = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];
const TOOLBAR_LABELS: CalendarDesktopLayoutProps["toolbar"]["labels"] = {
  today: "today",
  prev: "prev",
  next: "next",
  openFilter: "openFilter",
  filterActive: "filterActive",
  view: "view",
};
const LENS: CalendarDesktopLayoutProps["lens"] = {
  chips: [],
  activeId: null,
  hiddenCount: 0,
  onChange: NOOP,
  filtered: false,
  onClear: NOOP,
};
const LOAD_STATE: CalendarDesktopLayoutProps["state"] = {
  loading: false,
  error: false,
  onRetry: NOOP,
};
const LABELS: CalendarDesktopLayoutProps["labels"] = { weekdays: WEEKDAYS };
const GRID_HANDLERS = {
  onItemActivate: NOOP,
  onItemDoubleClick: NOOP,
  onItemContextMenu: NOOP,
  onCreateAt: NOOP,
  onMoveItem: NOOP,
  onResizeItem: NOOP,
  onDropAllDay: NOOP,
};

const CREATE_LABELS: ScheduleOverlaysProps["create"]["labels"] = {
  typeLabel: "typeLabel",
  typeEvent: "typeEvent",
  typeTodo: "typeTodo",
  attachNote: "attachNote",
  noteSourceLabel: "noteSourceLabel",
  noteSourceNew: "noteSourceNew",
  noteSourceExisting: "noteSourceExisting",
  title: "title",
  eventPlaceholder: "eventPlaceholder",
  todoPlaceholder: "todoPlaceholder",
  date: "date",
  allDay: "allDay",
  startTime: "startTime",
  endTime: "endTime",
  addEvent: "addEvent",
  addEventAndOpen: "addEventAndOpen",
  addTodo: "addTodo",
  placeTodo: "placeTodo",
  sourceLabel: "sourceLabel",
  sourceNew: "sourceNew",
  sourceExisting: "sourceExisting",
  searchTodos: "searchTodos",
  todoPickerEmpty: "todoPickerEmpty",
  todoPickerNoMatch: "todoPickerNoMatch",
  noteTitleLabel: "noteTitleLabel",
  notePlaceholder: "notePlaceholder",
  searchNotes: "searchNotes",
  notePickerEmpty: "notePickerEmpty",
  notePickerNoMatch: "notePickerNoMatch",
  noteLinkHint: "noteLinkHint",
  attachedNote: "attachedNote",
  clearNote: "clearNote",
};

const TAG_FILTER_PANEL: ScheduleOverlaysProps["tagFilter"]["panel"] = {
  tags: [],
  selectedTagIds: [],
  onToggleTag: NOOP,
  onClear: NOOP,
  groups: [],
  onSaveGroup: NOOP,
  onApplyGroup: NOOP,
  onRenameGroup: NOOP,
  onDeleteGroup: NOOP,
  labels: {
    tagsHeading: "t",
    tagsLabel: "t",
    noTags: "t",
    tagsLoading: "t",
    clear: "t",
    selectedCount: "t",
    groupsHeading: "t",
    groupsEmpty: "t",
    namePlaceholder: "t",
    save: "t",
    saveHint: "t",
    apply: "t",
    renameGroup: "t",
    groupEmpty: "t",
  },
};

/**
 * CalendarTab's shape in miniature: one `createPanel` state above BOTH the
 * calendar and the overlay set, which is what makes opening the panel a render
 * of the grid as well.
 *
 * `anchorMonth` is a prop so a test can move the month from outside and check
 * the memo still lets a real change through.
 */
function Host({
  fullDay,
  anchorMonth = "2026-08-16",
}: {
  fullDay: (k: string) => string;
  anchorMonth?: string;
}) {
  const [panel, setPanel] = useState<{
    date: string;
    start: string;
    end: string;
  } | null>(null);
  const onMonthCreate = useCallback(
    (day: string) => setPanel({ date: day, start: "09:00", end: "10:00" }),
    [],
  );
  const onClose = useCallback(() => setPanel(null), []);
  return (
    <>
      <CalendarDesktopLayout
        view="month"
        toolbar={{
          periodLabel: "August 2026",
          viewOptions: VIEW_OPTIONS,
          labels: TOOLBAR_LABELS,
          repeatsHidden: false,
          hiddenRepeats: 0,
          onToday: NOOP,
          onPrev: NOOP,
          onNext: NOOP,
          onChangeView: NOOP,
          onToggleRepeats: NOOP,
          onOpenFilter: NOOP,
          filterActive: false,
          onAddEvent: NOOP,
        }}
        lens={LENS}
        banner={null}
        state={LOAD_STATE}
        data={{
          anchorDate: anchorMonth,
          weekStart: TODAY,
          today: TODAY,
          monthItems: ITEMS,
          gridItems: [],
          selectedId: null,
          nowMinutes: 600,
        }}
        labels={LABELS}
        handlers={{ ...GRID_HANDLERS, onMonthCreate }}
        format={{ fullDay, dayDate: (k) => k }}
      />
      <ScheduleOverlays
        isWide
        frames={{ editor: null, todoDetail: null }}
        popover={{
          state: null,
          selected: null,
          todoChip: null,
          onClose: NOOP,
          onOpenDetail: NOOP,
          itemActions: {
            onRename: NOOP,
            onDuplicate: NOOP,
            onConvertToTodo: NOOP,
            onDelete: NOOP,
          },
          todoActions: {
            onRename: NOOP,
            onDelete: NOOP,
            onConvertToEvent: NOOP,
          },
        }}
        create={{
          panel,
          anchorDate: anchorMonth,
          onClose,
          pools: { todos: [], notes: [] },
          handlers: {
            onSubmitEvent: NOOP,
            onSubmitEventAndOpen: NOOP,
            onCreateTodo: NOOP,
            onPlaceTodo: NOOP,
          },
          formatDuration: (m: number) => `${m}`,
          labels: CREATE_LABELS,
        }}
        tagFilter={{ open: false, onClose: NOOP, panel: TAG_FILTER_PANEL }}
        scope={{ request: null, onChoose: NOOP, onClose: NOOP }}
        confirm={{ request: null, onResolve: NOOP }}
      />
    </>
  );
}

describe("#1582 — opening the month creation panel does not redraw the grid", () => {
  it("re-renders no month cell when the panel opens", () => {
    const fullDay = vi.fn((k: string) => k);
    render(<Host fullDay={fullDay} />);
    // The first render names all 42 cells; everything after this point is the
    // click's own cost.
    expect(fullDay).toHaveBeenCalledTimes(AUGUST_CELLS);
    fullDay.mockClear();

    act(() => {
      fireEvent.click(screen.getByLabelText("2026-08-21"));
    });

    // The panel is up …
    expect(screen.getByLabelText("title")).toBeTruthy();
    // … and not one cell was rebuilt to put it there.
    expect(fullDay).toHaveBeenCalledTimes(0);
  });

  it("closing the panel does not redraw the grid either", () => {
    const fullDay = vi.fn((k: string) => k);
    render(<Host fullDay={fullDay} />);
    act(() => {
      fireEvent.click(screen.getByLabelText("2026-08-21"));
    });
    fullDay.mockClear();

    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });

    expect(screen.queryByLabelText("title")).toBeNull();
    expect(fullDay).toHaveBeenCalledTimes(0);
  });

  it("still redraws when the month itself moves", () => {
    const fullDay = vi.fn((k: string) => k);
    const { rerender } = render(<Host fullDay={fullDay} />);
    fullDay.mockClear();

    rerender(<Host fullDay={fullDay} anchorMonth="2026-09-16" />);

    // The guard against over-memoising: a grid that never re-renders is a grid
    // stuck on August.
    expect(fullDay).toHaveBeenCalledTimes(SEPTEMBER_CELLS);
    expect(screen.getByLabelText("2026-09-30")).toBeTruthy();
  });

  /*
   * The state of things before this issue: the memo is defeated by ONE unstable
   * prop, and both layouts pass formatters that are trivial to write as inline
   * arrows. This states the cost of doing so, so an edit that reintroduces one
   * fails here rather than in someone's stopwatch.
   */
  it("an unstable formatter prop puts every cell back on the re-render", () => {
    const fullDay = vi.fn((k: string) => k);
    const { rerender } = render(<Host fullDay={(k) => fullDay(k)} />);
    fullDay.mockClear();

    // A NEW arrow, the way `formatMoreCount` was built on every render before
    // #1582 — one such prop and the comparison fails.
    rerender(<Host fullDay={(k) => fullDay(k)} />);

    expect(fullDay).toHaveBeenCalledTimes(AUGUST_CELLS);
  });
});
