import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  DailyEntriesPanel,
  type DailyEntriesPanelEntry,
  type DailyMonthCalendarProps,
} from "../src/components";
// Straight from the file: the barrel is outside #2589's scope, and the host
// passes the actions as a literal, so nothing else needs the name.
import type { DailyEntriesPanelActions } from "../src/components/materials/DailyEntriesPanel";

/*
 * Materials mini-plan Step 4 — Daily past-entries panel (rightSidebar, Desktop).
 * Pure presentation: the native date picker forwards its value, the heading +
 * entry rows render from props, and clicking an entry fires onSelectEntry with
 * the entry date. rightSidebar plumbing is covered elsewhere and deliberately
 * not re-tested here.
 *
 * #1189 removed the today / yesterday toggles that this suite used to pin. They
 * set the same selected date the picker and the rows set, so they read as a
 * filter that did nothing — the last assertion below is what remains of them:
 * the panel offers exactly one way to reach a day that has no entry yet.
 */

const ENTRIES: DailyEntriesPanelEntry[] = [
  {
    date: "2026-07-04",
    dayLabel: "7/4（金）",
    excerpt: "予定と実績のズレを振り返った。",
    selected: false,
  },
  {
    date: "2026-07-01",
    dayLabel: "7/1（火）",
    excerpt: "今月の目標を立て直した。",
    isPinned: true,
    selected: false,
  },
];

const LABELS = {
  entriesHeading: "Entries (2)",
  pinnedLabel: "Pinned",
};

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function calendarProps(
  overrides: Partial<DailyMonthCalendarProps> = {},
): DailyMonthCalendarProps {
  return {
    selectedDate: "2026-07-05",
    today: "2026-07-06",
    markedDates: new Set(["2026-07-01", "2026-07-04", "2026-08-02"]),
    onSelectDate: () => {},
    weekdayLabels: WEEKDAYS,
    formatMonthLabel: (year, month) => `${year}-${month}`,
    formatDayLabel: (date, marked) => (marked ? `${date} has entry` : date),
    label: "Calendar",
    prevMonthLabel: "Previous month",
    nextMonthLabel: "Next month",
    ...overrides,
  };
}

const dayButton = (date: string): HTMLButtonElement =>
  screen.getByRole("button", { name: new RegExp(`^${date}`) });

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof DailyEntriesPanel>> = {},
) {
  const props: React.ComponentProps<typeof DailyEntriesPanel> = {
    calendar: calendarProps(),
    entries: ENTRIES,
    onSelectEntry: () => {},
    ...LABELS,
    ...overrides,
  };
  return render(<DailyEntriesPanel {...props} />);
}

describe("DailyEntriesPanel", () => {
  it("renders the heading and every entry's day label + excerpt", () => {
    renderPanel();
    expect(screen.getByText("Entries (2)")).toBeInTheDocument();
    expect(screen.getByText("7/4（金）")).toBeInTheDocument();
    expect(screen.getByText("7/1（火）")).toBeInTheDocument();
    expect(
      screen.getByText("予定と実績のズレを振り返った。"),
    ).toBeInTheDocument();
    // The pinned entry surfaces its pin indicator via aria-label.
    expect(screen.getByLabelText("Pinned")).toBeInTheDocument();
  });

  it("offers no day jump beside the calendar without its actions (#1189)", () => {
    const { container } = renderPanel();
    expect(screen.queryByRole("button", { name: "Today" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Yesterday" })).toBeNull();
    // Outside the calendar, every button in the panel is an entry row.
    const outside = Array.from(container.querySelectorAll("button")).filter(
      (b) => !b.closest('section[aria-label="Calendar"]'),
    );
    expect(outside).toHaveLength(ENTRIES.length);
  });

  it("opens the calendar on the selected day's month, Sunday first (#2588)", () => {
    renderPanel();
    const calendar = screen.getByRole("region", { name: "Calendar" });
    within(calendar).getByRole("heading", { name: "2026-7" });
    expect(
      within(calendar).getAllByRole("button", { name: /^2026-07-/ }),
    ).toHaveLength(31);
    expect(calendar.textContent).toContain(WEEKDAYS.join(""));
  });

  it("dots the days with an entry and names them so (#2588)", () => {
    renderPanel();
    const dots = screen.getAllByTestId("daily-calendar-dot");
    expect(dots.map((d) => d.closest("button")?.dataset.date)).toEqual([
      "2026-07-01",
      "2026-07-04",
    ]);
    dayButton("2026-07-04 has entry");
    expect(dayButton("2026-07-03")).toHaveAccessibleName("2026-07-03");
  });

  it("fills the selected day and rings today (#2588)", () => {
    renderPanel();
    const selected = dayButton("2026-07-05");
    expect(selected).toHaveAttribute("aria-pressed", "true");
    expect(selected.querySelector("span")).toHaveClass("bg-lumen-accent");
    const today = dayButton("2026-07-06");
    expect(today).toHaveAttribute("aria-current", "date");
    expect(today).toHaveAttribute("aria-pressed", "false");
    expect(today.querySelector("span")).toHaveClass("ring-lumen-accent");
  });

  it("opens the day that is pressed (#2588)", () => {
    const onSelectDate = vi.fn();
    renderPanel({ calendar: calendarProps({ onSelectDate }) });
    fireEvent.click(dayButton("2026-07-20"));
    expect(onSelectDate).toHaveBeenCalledExactlyOnceWith("2026-07-20");
  });

  it("pages months without moving the selection (#2588)", () => {
    const onSelectDate = vi.fn();
    renderPanel({ calendar: calendarProps({ onSelectDate }) });
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    screen.getByRole("heading", { name: "2026-8" });
    // A day outside the first month still gets its dot.
    dayButton("2026-08-02 has entry");
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    screen.getByRole("heading", { name: "2026-6" });
    expect(screen.getAllByRole("button", { name: /^2026-06-/ })).toHaveLength(
      30,
    );
    expect(onSelectDate).not.toHaveBeenCalled();
  });

  it("brings a day opened from outside into view (#2588)", () => {
    const { rerender } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    rerender(
      <DailyEntriesPanel
        calendar={calendarProps({ selectedDate: "2025-12-31" })}
        entries={ENTRIES}
        onSelectEntry={() => {}}
        {...LABELS}
      />,
    );
    screen.getByRole("heading", { name: "2025-12" });
    expect(dayButton("2025-12-31")).toHaveAttribute("aria-pressed", "true");
  });

  it("fires onSelectEntry with the entry date on row click", () => {
    const onSelectEntry = vi.fn();
    renderPanel({ onSelectEntry });
    fireEvent.click(screen.getByRole("button", { name: /7\/1（火）/ }));
    expect(onSelectEntry).toHaveBeenCalledWith("2026-07-01");
  });

  /*
   * #1839 — "Entries (0)" over a blank space said nothing about why it was
   * blank. Notes answers the same question in the same place, so this panel
   * does too, and the glyph says which of the two blanks it is.
   */
  it("says so when a filter leaves nothing", () => {
    renderPanel({
      entries: [],
      emptyMessage: "No entries match that filter",
      searchEmpty: true,
      entriesHeading: "Entries (0)",
    });
    expect(screen.getByText("Entries (0)")).toBeInTheDocument();
    expect(
      screen.getByText("No entries match that filter"),
    ).toBeInTheDocument();
  });

  it("says so when there is nothing yet", () => {
    renderPanel({ entries: [], emptyMessage: "No entries yet" });
    expect(screen.getByText("No entries yet")).toBeInTheDocument();
  });

  it("stays out of the way while there are entries to show", () => {
    renderPanel({ emptyMessage: "No entries yet" });
    expect(screen.queryByText("No entries yet")).toBeNull();
    expect(screen.getByText("7/4（金）")).toBeInTheDocument();
  });

  /*
   * #2590 — every row opens with a CalendarDays glyph. It is decoration: the
   * row's name stays the day label alone, so a screen reader hears the day,
   * not "calendar" before it.
   */
  it("leads every row with a decorative CalendarDays glyph", () => {
    renderPanel();
    const rows = screen.getAllByRole("button", { name: /（/ });
    expect(rows).toHaveLength(ENTRIES.length);
    for (const row of rows) {
      const icon = row.querySelector('[data-testid="daily-entry-icon"]');
      expect(icon).not.toBeNull();
      expect(icon).toHaveClass("lucide-calendar-days");
      expect(icon?.closest('[aria-hidden="true"]')).not.toBeNull();
    }
    // Nothing from the glyph is read before the day.
    expect(rows[0]).toHaveAccessibleName(/^7\/4（金）/);
  });

  /*
   * #2589 — "Today" and "Filter" sit in one row under the calendar, and the
   * filter's search + sort are folded under the second until asked for.
   */
  describe("the row under the calendar (#2589)", () => {
    function actions(
      overrides: Partial<DailyEntriesPanelActions> = {},
    ): DailyEntriesPanelActions {
      return {
        todayLabel: "Today",
        onToday: () => {},
        isToday: false,
        filterLabel: "Filter",
        filterActiveLabel: "filters on",
        filterActive: false,
        filterPanel: <input aria-label="Filter entries" />,
        ...overrides,
      };
    }

    it("puts Today and Filter after the calendar, before the list", () => {
      const { container } = renderPanel({ actions: actions() });
      const calendar = screen.getByRole("region", { name: "Calendar" });
      const today = screen.getByRole("button", { name: "Today" });
      const filter = screen.getByRole("button", { name: "Filter" });
      const heading = screen.getByText("Entries (2)");
      const after = Node.DOCUMENT_POSITION_FOLLOWING;
      expect(calendar.compareDocumentPosition(today) & after).toBeTruthy();
      expect(today.compareDocumentPosition(filter) & after).toBeTruthy();
      expect(filter.compareDocumentPosition(heading) & after).toBeTruthy();
      // Side by side: the two share one row.
      expect(today.parentElement).toBe(filter.parentElement);
      expect(container.querySelector("button[aria-label='Yesterday']")).toBe(
        null,
      );
    });

    it("jumps to today, and goes pale and disabled on today", () => {
      const onToday = vi.fn();
      const { rerender } = renderPanel({ actions: actions({ onToday }) });
      const today = screen.getByRole("button", { name: "Today" });
      expect(today).toBeEnabled();
      expect(today.querySelector(".lucide-calendar-check")).not.toBeNull();
      fireEvent.click(today);
      expect(onToday).toHaveBeenCalledTimes(1);

      rerender(
        <DailyEntriesPanel
          calendar={calendarProps()}
          entries={ENTRIES}
          onSelectEntry={() => {}}
          {...LABELS}
          actions={actions({ onToday, isToday: true })}
        />,
      );
      const pale = screen.getByRole("button", { name: "Today" });
      expect(pale).toBeDisabled();
      expect(pale).toHaveClass("disabled:opacity-50");
      fireEvent.click(pale);
      expect(onToday).toHaveBeenCalledTimes(1);
    });

    it("folds the search and sort under Filter until it is pressed", () => {
      renderPanel({ actions: actions() });
      const filter = screen.getByRole("button", { name: "Filter" });
      // lucide-react's `Filter` is an alias of `Funnel`, which names the class.
      expect(filter.querySelector(".lucide-funnel")).not.toBeNull();
      expect(filter).toHaveAttribute("aria-expanded", "false");
      const panel = document.getElementById(
        filter.getAttribute("aria-controls")!,
      );
      expect(panel).not.toBeNull();
      expect(panel).not.toBeVisible();

      fireEvent.click(filter);
      expect(filter).toHaveAttribute("aria-expanded", "true");
      expect(panel).toBeVisible();
      expect(screen.getByRole("textbox", { name: "Filter entries" })).toBe(
        panel!.querySelector("input"),
      );

      fireEvent.click(filter);
      expect(filter).toHaveAttribute("aria-expanded", "false");
      expect(panel).not.toBeVisible();
    });

    it("dots Filter while a condition is in effect, and says so", () => {
      const { rerender } = renderPanel({ actions: actions() });
      expect(screen.queryByTestId("daily-filter-dot")).toBeNull();

      rerender(
        <DailyEntriesPanel
          calendar={calendarProps()}
          entries={ENTRIES}
          onSelectEntry={() => {}}
          {...LABELS}
          actions={actions({ filterActive: true })}
        />,
      );
      const dot = screen.getByTestId("daily-filter-dot");
      expect(dot).toHaveClass("bg-lumen-accent");
      expect(dot).toHaveAttribute("aria-hidden", "true");
      // Shut, the dot is the only sign; a screen reader hears it in the name.
      expect(
        screen.getByRole("button", { name: "Filter filters on" }),
      ).toHaveAttribute("aria-expanded", "false");
    });
  });

  it("keeps the selected row on the accent border", () => {
    renderPanel({
      entries: [{ ...ENTRIES[0]!, selected: true }, ENTRIES[1]!],
    });
    const [selected, other] = screen.getAllByRole("button", { name: /（/ });
    expect(selected).toHaveClass("border-lumen-accent");
    expect(other).not.toHaveClass("border-lumen-accent");
  });

  describe("a list that is loading or failed to load (#2582)", () => {
    it("draws a named skeleton of title + excerpt bars instead of the rows", () => {
      renderPanel({
        entries: [],
        emptyMessage: "No entries yet",
        isLoading: true,
        loadingLabel: "Loading",
      });
      const status = screen.getByRole("status", { name: "Loading" });
      expect(status).toHaveAttribute("aria-busy", "true");
      // Two bars per row: a short title over a longer excerpt.
      const bars = status.querySelectorAll(".animate-pulse");
      expect(bars.length).toBeGreaterThan(0);
      expect(bars.length % 2).toBe(0);
      const width = (i: number): number =>
        parseFloat((bars[i] as HTMLElement).style.width);
      expect(width(0)).toBeLessThan(width(1));
      expect(screen.queryByText("No entries yet")).toBeNull();
      // The calendar stays.
      screen.getByRole("region", { name: "Calendar" });
    });

    it("shows the failure card with its retry instead of the empty line", () => {
      const onRetry = vi.fn();
      renderPanel({
        entries: [],
        emptyMessage: "No entries yet",
        loadError: {
          message: "Could not load the dailies",
          retryLabel: "Retry",
          onRetry,
        },
        actions: {
          todayLabel: "Today",
          onToday: () => {},
          isToday: false,
          filterLabel: "Filter",
          filterActiveLabel: "filters on",
          filterActive: false,
          filterPanel: null,
        },
      });
      const card = screen.getByRole("alert");
      expect(card).toHaveTextContent("Could not load the dailies");
      expect(screen.queryByText("No entries yet")).toBeNull();

      fireEvent.click(within(card).getByRole("button", { name: "Retry" }));
      expect(onRetry).toHaveBeenCalledTimes(1);
      // The calendar and the Today / Filter row stay.
      screen.getByRole("region", { name: "Calendar" });
      screen.getByRole("button", { name: "Today" });
      screen.getByRole("button", { name: "Filter" });
    });

    it("prefers the failure card over the skeleton", () => {
      renderPanel({
        entries: [],
        isLoading: true,
        loadingLabel: "Loading",
        loadError: { message: "Failed", retryLabel: "Retry", onRetry: vi.fn() },
      });
      screen.getByRole("alert");
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("draws the rows when neither is set", () => {
      renderPanel({ loadError: null, isLoading: false });
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
      screen.getByText("7/4（金）");
    });
  });
});
