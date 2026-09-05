import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { agendaRowHeightPx, type AgendaItem } from "@life-editor/shared";
import { ScheduleSidebar } from "../src/schedule/ScheduleSidebar";
import type { ScheduleSidebarProps } from "../src/schedule/ScheduleSidebar";

/*
 * #889 — the Schedule rightSidebar, pulled out of CalendarTab.
 *
 * What is worth pinning here is not the markup (the parts underneath already
 * have their own suites) but the LAYOUT RULES this component carries, every
 * one of which is a silent failure when it breaks:
 *
 *   - every tab renders at both widths since #1153. The Todo tray used to be
 *     Desktop-only (narrow reached its todos through the section's own Todo
 *     tab); that tab is retired, so a narrow fold would leave the phone with
 *     no route to a todo at all.
 *   - the repeat list withholds `onDelete` on narrow (#467): a whole series
 *     must not be deletable from a fingertip-sized target. Passing it through
 *     unconditionally leaves every other test green.
 *   - the routine summary is Desktop-only, and its CTA is the only route from
 *     the flow tab to the repeats tab.
 *   - the repeat-filter notice (#466) shows only while the grid filter is on,
 *     and its button is one of the two ways back off.
 *   - the flow tab is TODAY on Desktop and the PICKED DAY on narrow (#1148),
 *     which is three separate forwards — the now-line, the `dayflow` row
 *     shape, and the create pill — none of which change the markup enough for
 *     another case here to notice.
 *
 * `useTranslation` is stubbed to echo its key — these assertions are about
 * wiring, and an echo makes the queries read as the key that produced them.
 * <TagPicker> is stubbed because it talks to WikiTagsUnifiedContext, which this
 * component neither owns nor needs to exercise.
 *
 * No jest-dom in web/: presence comes from getBy* throwing, absence from
 * queryBy* being null (same convention as trashScreenActions.test.tsx).
 */

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../src/wikitag/TagPicker", () => ({
  TagPicker: ({ itemId }: { itemId: string }) => <span>tag:{itemId}</span>,
}));

const TABS = [
  { id: "flow", label: "Flow" },
  { id: "todo", label: "Todo" },
  { id: "repeats", label: "Repeats" },
];

function makeProps(
  over: {
    isWide?: boolean;
    tab?: "flow" | "todo" | "repeats";
    onTabChange?: (tab: "flow" | "todo" | "repeats") => void;
    flow?: Partial<ScheduleSidebarProps["flow"]>;
    repeats?: Partial<ScheduleSidebarProps["repeats"]>;
    todo?: Partial<ScheduleSidebarProps["todo"]>;
  } = {},
): ScheduleSidebarProps {
  return {
    isWide: over.isWide ?? true,
    tabs: TABS.filter((tb) => (over.isWide ?? true) || tb.id !== "todo"),
    tab: over.tab ?? "flow",
    onTabChange: over.onTabChange ?? vi.fn(),
    flow: {
      todayLabel: "Mon, Aug 16",
      agenda: [],
      agendaLabels: {
        allDay: "All-day",
        empty: "Nothing today",
        nowLabel: "09:00",
        todoStatus: "Status",
        todoStatusLabels: {
          statusNotStarted: "Not started",
          statusDone: "Done",
        },
      },
      nowMinutes: 540,
      selectedId: null,
      skipped: [],
      summaryRows: [],
      onToggleComplete: vi.fn(),
      onItemActivate: vi.fn(),
      onItemDoubleClick: vi.fn(),
      onRestoreSkipped: vi.fn(),
      ...over.flow,
    },
    repeats: {
      hidden: false,
      rows: [],
      onOpen: vi.fn(),
      onDelete: vi.fn(),
      onShowHidden: vi.fn(),
      ...over.repeats,
    },
    todo: {
      placed: [],
      unplaced: [],
      addable: [],
      onToggleComplete: vi.fn(),
      onAddCandidate: vi.fn(),
      onMoveOut: vi.fn(),
      onOpenTodo: vi.fn(),
      onOpenAddable: vi.fn(),
      onDelete: vi.fn(),
      onAdd: vi.fn(),
      ...over.todo,
    },
  };
}

/** The flow tab is the only one that prints the day heading. */
const flowIsShowing = () =>
  screen.queryByText(/Mon, Aug 16/) !== null ||
  screen.queryByText("Mon, Aug 16", { exact: false }) !== null;

describe("ScheduleSidebar — which tab renders", () => {
  it("draws the todo tray on narrow too (#1153)", () => {
    // #467 folded this tab back to the flow, because narrow had a whole Todo
    // tab of its own. It does not any more, so the fold would be a removal.
    render(
      <ScheduleSidebar
        {...makeProps({
          isWide: false,
          tab: "todo",
          todo: { placed: [{ id: "t1", title: "Buy milk", completed: false }] },
        })}
      />,
    );
    expect(screen.getByText("scheduleScreen.todoTodayHeading")).toBeTruthy();
    expect(screen.getByText("Buy milk")).toBeTruthy();
    expect(flowIsShowing()).toBe(false);
  });

  it("shows the tray on the same tab once the layout is wide", () => {
    render(
      <ScheduleSidebar
        {...makeProps({
          isWide: true,
          tab: "todo",
          todo: { placed: [{ id: "t1", title: "Buy milk", completed: false }] },
        })}
      />,
    );
    expect(screen.getByText("Buy milk")).toBeTruthy();
    expect(flowIsShowing()).toBe(false);
  });

  it("keeps the chosen tab intact — folding is per-render, not a reset", () => {
    // Same `tab="todo"` value goes in on both renders; only the width differs.
    // A fold that wrote the state back would make the second render show flow.
    const onTabChange = vi.fn();
    const { unmount } = render(
      <ScheduleSidebar
        {...makeProps({ isWide: false, tab: "todo", onTabChange })}
      />,
    );
    expect(onTabChange).not.toHaveBeenCalled();
    unmount();
    render(
      <ScheduleSidebar
        {...makeProps({
          isWide: true,
          tab: "todo",
          onTabChange,
          todo: { placed: [{ id: "t1", title: "Buy milk", completed: false }] },
        })}
      />,
    );
    expect(screen.getByText("Buy milk")).toBeTruthy();
  });
});

describe("ScheduleSidebar — repeats tab", () => {
  const row = {
    id: "r1",
    title: "Morning run",
    timeLabel: "7:00",
    frequencyLabel: "Daily",
    nextLabel: "Aug 17",
  };

  it("offers the delete action on Desktop", () => {
    render(
      <ScheduleSidebar
        {...makeProps({
          isWide: true,
          tab: "repeats",
          repeats: { rows: [row] },
        })}
      />,
    );
    expect(
      screen.getByLabelText("scheduleScreen.deleteRoutine: Morning run"),
    ).toBeTruthy();
  });

  it("withholds it on narrow so a series cannot go on a fingertip target (#467)", () => {
    render(
      <ScheduleSidebar
        {...makeProps({
          isWide: false,
          tab: "repeats",
          repeats: { rows: [row] },
        })}
      />,
    );
    // The row itself is still there — viewing and navigating stay available.
    expect(screen.getByText("Morning run")).toBeTruthy();
    expect(
      screen.queryByLabelText("scheduleScreen.deleteRoutine: Morning run"),
    ).toBeNull();
  });

  it("shows the grid-filter notice only while the filter is on, and turns it back off (#466)", () => {
    const onShowHidden = vi.fn();
    const { unmount } = render(
      <ScheduleSidebar
        {...makeProps({
          tab: "repeats",
          repeats: { hidden: false, onShowHidden },
        })}
      />,
    );
    expect(screen.queryByText("scheduleScreen.repeatFilterNotice")).toBeNull();
    unmount();

    render(
      <ScheduleSidebar
        {...makeProps({
          tab: "repeats",
          repeats: { hidden: true, onShowHidden },
        })}
      />,
    );
    expect(screen.getByText("scheduleScreen.repeatFilterNotice")).toBeTruthy();
    fireEvent.click(screen.getByText("scheduleScreen.repeatFilterShow"));
    expect(onShowHidden).toHaveBeenCalledTimes(1);
  });
});

describe("ScheduleSidebar — flow tab", () => {
  const skipped = [
    { id: "s1", title: "Standup", startTime: "09:00", isAllDay: false },
  ];

  it("restores a skipped occurrence by id (#296)", () => {
    const onRestoreSkipped = vi.fn();
    render(
      <ScheduleSidebar
        {...makeProps({ flow: { skipped, onRestoreSkipped } })}
      />,
    );
    fireEvent.click(screen.getByText("scheduleScreen.restoreSkipped"));
    expect(onRestoreSkipped).toHaveBeenCalledWith("s1");
  });

  it("renders no restore surface when nothing was skipped", () => {
    render(<ScheduleSidebar {...makeProps()} />);
    expect(screen.queryByText("scheduleScreen.restoreSkipped")).toBeNull();
  });

  it("keeps the routine summary on Desktop only", () => {
    const summaryRows = [
      {
        id: "r1",
        title: "Morning run",
        timeLabel: "7:00",
        frequencyLabel: "Daily",
      },
    ];
    const { unmount } = render(
      <ScheduleSidebar
        {...makeProps({ isWide: true, flow: { summaryRows } })}
      />,
    );
    expect(screen.getByText("scheduleScreen.summaryTitle")).toBeTruthy();
    unmount();

    render(
      <ScheduleSidebar
        {...makeProps({ isWide: false, flow: { summaryRows } })}
      />,
    );
    expect(screen.queryByText("scheduleScreen.summaryTitle")).toBeNull();
  });

  it("routes the summary CTA to the repeats tab — the flow tab's only way there", () => {
    const onTabChange = vi.fn();
    render(
      <ScheduleSidebar
        {...makeProps({
          isWide: true,
          onTabChange,
          flow: {
            summaryRows: [
              {
                id: "r1",
                title: "Morning run",
                timeLabel: "7:00",
                frequencyLabel: "Daily",
              },
            ],
          },
        })}
      />,
    );
    fireEvent.click(screen.getByText("scheduleScreen.openRoutinesCta"));
    expect(onTabChange).toHaveBeenCalledWith("repeats");
  });
});

describe("ScheduleSidebar — todo tab", () => {
  it("hands the tray its own row extras and delete route", () => {
    const onDelete = vi.fn();
    render(
      <ScheduleSidebar
        {...makeProps({
          isWide: true,
          tab: "todo",
          todo: {
            placed: [{ id: "t1", title: "Buy milk", completed: false }],
            onDelete,
          },
        })}
      />,
    );
    // #555: the tray rows carry the same TagPicker the todo detail uses.
    expect(screen.getByText("tag:t1")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("todoDetail.todoDelete"));
    expect(onDelete).toHaveBeenCalledWith("t1");
  });
});

/*
 * #1153 — the tray as the app's ONLY todo surface.
 *
 * Every route into a todo used to end at the Kanban tab: a row press, the
 * unscheduled list, "make a new one". The tab is retired, so each of those had
 * to land somewhere here instead, and none of them changes the tray's shape
 * enough for the cases above to notice if it went missing.
 */
describe("ScheduleSidebar — the todo tray after the board (#1153)", () => {
  const withTray = (
    over: Partial<ScheduleSidebarProps["todo"]> = {},
  ): ScheduleSidebarProps =>
    makeProps({
      tab: "todo",
      todo: {
        placed: [{ id: "t1", title: "Buy milk", completed: false }],
        addable: [{ id: "t2", title: "Book the dentist" }],
        ...over,
      },
    });

  it("opens a placed row's detail instead of jumping to a board", () => {
    const onOpenTodo = vi.fn();
    render(<ScheduleSidebar {...withTray({ onOpenTodo })} />);

    fireEvent.click(screen.getByText("Buy milk"));

    // With the id: the zero-argument version was the jump to the tab, and
    // dropping the id would open whatever the detail happened to hold.
    expect(onOpenTodo).toHaveBeenCalledWith("t1");
  });

  it("opens an UNSCHEDULED row's detail without placing it", () => {
    // The two are different presses on one row — the title reads it, the "+"
    // puts it on today — and conflating them would schedule a todo the user
    // only meant to look at.
    const onOpenAddable = vi.fn();
    const onAddCandidate = vi.fn();
    render(
      <ScheduleSidebar {...withTray({ onOpenAddable, onAddCandidate })} />,
    );

    fireEvent.click(screen.getByText("Book the dentist"));

    expect(onOpenAddable).toHaveBeenCalledWith("t2");
    expect(onAddCandidate).not.toHaveBeenCalled();
  });

  it("still places an unscheduled todo on today from the same row", () => {
    const onOpenAddable = vi.fn();
    const onAddCandidate = vi.fn();
    render(
      <ScheduleSidebar {...withTray({ onOpenAddable, onAddCandidate })} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "scheduleScreen.todoMoveToToday" }),
    );

    expect(onAddCandidate).toHaveBeenCalledWith("t2");
    expect(onOpenAddable).not.toHaveBeenCalled();
  });

  // #1406: the reverse move, from a today row, and the two-list shape — one
  // "today" heading (the placed / unplaced pair merged) over an "others" one.
  it("takes a today row off today from its own row", () => {
    const onMoveOut = vi.fn();
    render(<ScheduleSidebar {...withTray({ onMoveOut })} />);

    fireEvent.click(
      screen.getByRole("button", { name: "scheduleScreen.todoMoveToOthers" }),
    );

    expect(onMoveOut).toHaveBeenCalledWith("t1");
  });

  it("draws two lists: today and others", () => {
    render(<ScheduleSidebar {...withTray()} />);
    expect(screen.getByText("scheduleScreen.todoTodayHeading")).toBeTruthy();
    expect(screen.getByText("scheduleScreen.todoOthersHeading")).toBeTruthy();
    expect(screen.queryByText("scheduleScreen.todoUnplacedHeading")).toBeNull();
  });

  it("offers the create pill above the tray", () => {
    // Above rather than inside a group: a new todo has no day, so it belongs
    // to none of the three groups underneath.
    const onAdd = vi.fn();
    render(<ScheduleSidebar {...withTray({ onAdd })} />);

    fireEvent.click(screen.getByText("scheduleScreen.todoAddCta"));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("keeps the create pill off the other tabs", () => {
    // It creates a TODO. On the flow or the repeat list it would read as
    // creating whatever that tab is showing.
    render(<ScheduleSidebar {...makeProps({ tab: "flow" })} />);
    expect(screen.queryByText("scheduleScreen.todoAddCta")).toBeNull();
  });
});

/*
 * #1148 — the flow tab took over narrow's day list.
 *
 * Narrow's main area is the month grid alone now, so this tab is where a
 * tapped day is read. Three capabilities came across with the list, and every
 * one of them is a forwarded prop rather than a shape: lose it and the tab
 * still renders every row, still opens them, still completes them. It just
 * quietly stops being the thing it replaced.
 *
 * The HOST decides which day and which of these to switch on (CalendarTab
 * folds on `isWide`); what this component owes is that the switches arrive.
 */
describe("ScheduleSidebar — the flow tab as narrow's day list (#1148)", () => {
  /** Three hours, so the height is nowhere near the floor a short row lands on. */
  const LONG: AgendaItem = {
    id: "event-long",
    title: "長い予定",
    startTime: "13:00",
    endTime: "16:00",
  };

  const rowOf = (title: string) =>
    screen.getByText(title).closest("button") as HTMLElement;

  it("draws the now-line for today and drops it for any other day", () => {
    // A now-line on a day that is not today marks an hour that means nothing
    // there — which is why `nowMinutes` is nullable at all.
    const withLine = render(
      <ScheduleSidebar {...makeProps({ flow: { agenda: [LONG] } })} />,
    );
    expect(screen.getByText("09:00")).toBeTruthy();
    withLine.unmount();

    render(
      <ScheduleSidebar
        {...makeProps({ flow: { agenda: [LONG], nowMinutes: null } })}
      />,
    );
    expect(screen.queryByText("09:00")).toBeNull();
  });

  it("prints the end time and sizes the row by its duration when dayflow is on", () => {
    render(
      <ScheduleSidebar
        {...makeProps({ flow: { agenda: [LONG], dayflow: true } })}
      />,
    );

    expect(screen.getByText(LONG.endTime)).toBeTruthy();
    /*
     * Read through the shared helper rather than hard-coded: the SCALE is
     * AgendaList's business (its own suite owns the px-per-minute and the
     * cap), and what this case is about is the flag arriving at all. Without
     * it the row carries no inline height whatsoever, so any number fails it.
     */
    expect(rowOf(LONG.title).style.minHeight).toBe(
      `${agendaRowHeightPx(180)}px`,
    );
  });

  it("leaves Desktop's rows one line tall", () => {
    render(<ScheduleSidebar {...makeProps({ flow: { agenda: [LONG] } })} />);
    expect(rowOf(LONG.title).style.minHeight).toBe("");
  });

  /*
   * The free-gap markers ride their OWN prop (`formatGapLabel`) rather than
   * `dayflow` — AgendaList draws them whenever the formatter is supplied. Two
   * separate forwards, so they need two separate cases: pinning only the flag
   * would leave the formatter free to go missing, taking 「空き」 with it while
   * the end times stayed.
   */
  it("calls out the free stretch between two rows", () => {
    render(
      <ScheduleSidebar
        {...makeProps({
          flow: {
            dayflow: true,
            formatGapLabel: (m: number) => `gap:${m}`,
            agenda: [
              { ...LONG, id: "event-am", startTime: "09:00", endTime: "10:00" },
              { ...LONG, id: "event-pm", startTime: "11:00", endTime: "12:00" },
            ],
          },
        })}
      />,
    );
    // The formatter echoes the minutes it was handed — the hole here is
    // 10:00→11:00, and it has to be measured, not assumed.
    expect(screen.getByText("gap:60")).toBeTruthy();
  });

  it("offers the create pill only when the host supplies one", () => {
    // #1148 option A: narrow's single create route, carried over from the day
    // list header #1034 put it in. Desktop passes neither half and keeps its
    // toolbar button as the only one.
    const onAdd = vi.fn();
    const withPill = render(
      <ScheduleSidebar
        {...makeProps({ flow: { onAdd, addLabel: "add-cta" } })}
      />,
    );
    fireEvent.click(screen.getByText("add-cta"));
    expect(onAdd).toHaveBeenCalledTimes(1);
    withPill.unmount();

    render(<ScheduleSidebar {...makeProps()} />);
    expect(screen.queryByText("add-cta")).toBeNull();
  });
});
