import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  AnalyticsView,
  type AnalyticsViewProps,
} from "../src/components/Analytics/AnalyticsView";
import type { AppRecord } from "../src/types/appRecord";
import type { ExtensionApp } from "../src/types/extensionApp";
import { makeAnalyticsLabels } from "./helpers/analyticsLabels";

/*
 * The Analytics Records tab and the narrow Records block (#2164).
 *
 * Rendered through <AnalyticsView activeTab="records"> so the real tab wiring,
 * the date-range preset and the empty / filter states are all exercised. The
 * numbers themselves come from the shared aggregation (#2162), which has its
 * own suite — what is pinned here is which rows reach it and what is drawn.
 *
 * recharts is stubbed: jsdom has no layout, so the bars cannot be read anyway
 * (the bar model is covered in analyticsRecordsModel.test.ts).
 */

vi.mock("recharts", () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    ResponsiveContainer: Passthrough,
    BarChart: Passthrough,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
  };
});

/** Local noon, `daysAgo` days back — never near a day boundary in any zone. */
function noon(daysAgo: number): string {
  const d = new Date();
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() - daysAgo,
    12,
  ).toISOString();
}

let seq = 0;
function rec(
  over: Partial<AppRecord> & Pick<AppRecord, "occurredAt">,
): AppRecord {
  seq += 1;
  return {
    id: `r${seq}`,
    sourceApp: "ledger",
    externalId: null,
    kind: "expense",
    value: 100,
    unit: "JPY",
    dims: {},
    note: null,
    createdAt: over.occurredAt,
    updatedAt: over.occurredAt,
    ...over,
  };
}

const APPS: ExtensionApp[] = [
  {
    slug: "ledger",
    name: "Household ledger",
    url: null,
    icon: null,
    description: null,
    sortOrder: 0,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  },
];

function props(over: Partial<AnalyticsViewProps> = {}): AnalyticsViewProps {
  return {
    sessions: [],
    nodes: [],
    todayItems: [],
    scheduleItems: [],
    liveEvents: [],
    notes: [],
    routines: [],
    todoNameMap: new Map(),
    tags: [],
    assignments: [],
    targetPerDay: 4,
    labels: makeAnalyticsLabels(),
    activeTab: "records",
    onTabChange: vi.fn(),
    recordApps: APPS,
    ...over,
  };
}

function mockMatchMedia(matches: boolean): void {
  // @ts-expect-error — minimal MediaQueryList stub for jsdom.
  window.matchMedia = () => ({
    matches,
    media: "",
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

afterEach(() => {
  // @ts-expect-error — back to the wide fallback for the next test.
  delete window.matchMedia;
});

/** A stat card's number: the node right before its label. */
function statValue(label: string): string {
  return screen.getByText(label).previousElementSibling?.textContent ?? "";
}

function listRows(): HTMLElement[] {
  const list = screen.getByText("Record list").closest("section");
  return within(list as HTMLElement).queryAllByRole("listitem");
}

const select = (label: string): HTMLSelectElement =>
  screen.getByLabelText(label) as HTMLSelectElement;

describe("Records tab states", () => {
  it("shows the first-record guidance when the range has no records", () => {
    render(<AnalyticsView {...props({ records: [] })} />);
    expect(screen.getByText("No records in this range")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Filter records" })).toBeNull();
  });

  it("draws a skeleton while the read is in flight", () => {
    const { container } = render(
      <AnalyticsView {...props({ recordsLoading: true })} />,
    );
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(screen.queryByText("No records in this range")).toBeNull();
  });

  it("says the read failed instead of claiming there are no records", () => {
    render(<AnalyticsView {...props({ records: [], recordsError: "boom" })} />);
    expect(screen.getByText("Records could not be loaded")).toBeInTheDocument();
    expect(screen.queryByText("No records in this range")).toBeNull();
  });

  it("renders one record: count, total, average, and the row itself", () => {
    const records = [
      rec({
        occurredAt: noon(1),
        value: 450,
        dims: { shop: "lawson" },
        note: "coffee",
      }),
    ];
    render(<AnalyticsView {...props({ records })} />);

    expect(statValue("Records")).toBe("1");
    expect(statValue("Total")).toBe("450 JPY");
    expect(statValue("Average")).toBe("450 JPY");
    const [row] = listRows();
    expect(row.textContent).toContain("expense");
    expect(row.textContent).toContain("shop: lawson");
    expect(row.textContent).toContain("Household ledger");
    expect(row.textContent).toContain("coffee");
    expect(row.textContent).toContain("450 JPY");
  });

  it("names Claude's own records and falls back to the slug for an unregistered app", () => {
    const records = [
      rec({ occurredAt: noon(1), sourceApp: "claude" }),
      rec({ occurredAt: noon(2), sourceApp: "ghost-app" }),
    ];
    render(<AnalyticsView {...props({ records })} />);
    const text = listRows()
      .map((r) => r.textContent)
      .join("|");
    expect(text).toContain("Claude");
    expect(text).toContain("ghost-app");
  });
});

describe("Records tab filters", () => {
  const records = [
    rec({
      occurredAt: noon(1),
      sourceApp: "ledger",
      kind: "expense",
      value: 450,
    }),
    rec({
      occurredAt: noon(2),
      sourceApp: "ledger",
      kind: "expense",
      value: 550,
    }),
    rec({
      occurredAt: noon(3),
      sourceApp: "ledger",
      kind: "income",
      value: 3000,
    }),
    rec({
      occurredAt: noon(2),
      sourceApp: "claude",
      kind: "weight",
      value: 62.4,
      unit: "kg",
    }),
    rec({
      occurredAt: noon(12),
      sourceApp: "ledger",
      kind: "expense",
      value: 10,
    }),
  ];

  it("does not add up unlike things", () => {
    render(<AnalyticsView {...props({ records })} />);
    expect(statValue("Records")).toBe("5");
    // expense + income + kg: a total would mean nothing.
    expect(statValue("Total")).toBe("-");
    expect(statValue("Average")).toBe("-");
    expect(screen.getByText("Pick one kind")).toBeInTheDocument();
  });

  it("narrows the list and the three numbers by app", () => {
    render(<AnalyticsView {...props({ records })} />);
    fireEvent.change(select("App"), { target: { value: "claude" } });

    expect(listRows()).toHaveLength(1);
    expect(statValue("Records")).toBe("1");
    expect(statValue("Total")).toBe("62.4 kg");
  });

  it("narrows by kind and sums that kind", () => {
    render(<AnalyticsView {...props({ records })} />);
    fireEvent.change(select("Kind"), { target: { value: "expense" } });

    expect(listRows()).toHaveLength(3);
    expect(statValue("Records")).toBe("3");
    expect(statValue("Total")).toBe("1010 JPY");
    expect(statValue("Average")).toBe("336.6666666666667 JPY");
  });

  it("offers only the kinds the chosen app sent, and resets a kind it never sent", () => {
    render(<AnalyticsView {...props({ records })} />);
    fireEvent.change(select("Kind"), { target: { value: "income" } });
    fireEvent.change(select("App"), { target: { value: "claude" } });

    expect(select("Kind").value).toBe("*");
    const kinds = within(select("Kind"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(kinds).toEqual(["All kinds", "weight"]);
  });

  it("narrows by the date-range preset", () => {
    render(<AnalyticsView {...props({ records })} />);
    // 30 days (the default) holds all five; 7 days drops the 12-day-old one.
    expect(statValue("Records")).toBe("5");
    fireEvent.click(screen.getByRole("radio", { name: "7 days" }));
    expect(statValue("Records")).toBe("4");
  });

  it("says when the filters hide every record, and keeps the filters to change", () => {
    render(
      <AnalyticsView
        {...props({
          records: [
            rec({ occurredAt: noon(20), sourceApp: "claude" }),
            rec({ occurredAt: noon(1), sourceApp: "ledger" }),
          ],
        })}
      />,
    );
    fireEvent.change(select("App"), { target: { value: "claude" } });
    expect(listRows()).toHaveLength(1);

    // The only Claude record is 20 days old: 7 days leaves the app chosen and
    // the list empty, which is not the same as "nothing recorded".
    fireEvent.click(screen.getByRole("radio", { name: "7 days" }));
    expect(screen.getByText("No records match")).toBeInTheDocument();
    expect(screen.queryByText("No records in this range")).toBeNull();
    expect(select("App").value).toBe("claude");
  });
});

describe("Records tab pending app (the Apps section's entry)", () => {
  const records = [
    rec({ occurredAt: noon(1), sourceApp: "ledger", value: 450 }),
    rec({
      occurredAt: noon(1),
      sourceApp: "claude",
      kind: "weight",
      unit: "kg",
    }),
  ];

  it("opens filtered to the requested app and consumes the request once", () => {
    const consumed = vi.fn();
    render(
      <AnalyticsView
        {...props({
          records,
          pendingRecordsSource: "ledger",
          onRecordsSourceConsumed: consumed,
        })}
      />,
    );
    expect(select("App").value).toBe("ledger");
    expect(listRows()).toHaveLength(1);
    expect(consumed).toHaveBeenCalledTimes(1);
  });

  it("keeps the requested app selectable even when it has no records in range", () => {
    render(
      <AnalyticsView
        {...props({
          records,
          pendingRecordsSource: "new-app",
          onRecordsSourceConsumed: vi.fn(),
        })}
      />,
    );
    expect(select("App").value).toBe("new-app");
    expect(screen.getByText("No records match")).toBeInTheDocument();
  });

  it("takes a second request for another app while the tab is open", () => {
    const view = render(
      <AnalyticsView {...props({ records, pendingRecordsSource: "ledger" })} />,
    );
    expect(select("App").value).toBe("ledger");
    view.rerender(
      <AnalyticsView {...props({ records, pendingRecordsSource: null })} />,
    );
    view.rerender(
      <AnalyticsView {...props({ records, pendingRecordsSource: "claude" })} />,
    );
    expect(select("App").value).toBe("claude");
  });
});

describe("narrow Records block", () => {
  it("totals the last 7 days per kind and leaves older records out", () => {
    mockMatchMedia(false);
    const records = [
      rec({ occurredAt: noon(0), kind: "expense", value: 450 }),
      rec({ occurredAt: noon(3), kind: "expense", value: 550 }),
      rec({ occurredAt: noon(2), kind: "weight", value: 62.4, unit: "kg" }),
      // The 8th calendar day back: outside the window.
      rec({ occurredAt: noon(7), kind: "expense", value: 9999 }),
    ];
    render(<AnalyticsView {...props({ records, activeTab: undefined })} />);

    const block = screen.getByText("Last 7 days").closest("div")
      ?.parentElement as HTMLElement;
    const lines = within(block)
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(lines).toEqual([
      "expense · 2 records1000 JPY",
      "weight · 1 records62.4 kg",
    ]);
  });

  it("says there are none, and still shows the block, when the last 7 days are empty", () => {
    mockMatchMedia(false);
    const records = [rec({ occurredAt: noon(20) })];
    render(<AnalyticsView {...props({ records, activeTab: undefined })} />);
    expect(
      screen.getByText("No records in the last 7 days."),
    ).toBeInTheDocument();
  });

  it("says the read failed instead of 'none'", () => {
    mockMatchMedia(false);
    render(
      <AnalyticsView
        {...props({
          records: [rec({ occurredAt: noon(0) })],
          recordsError: "boom",
          activeTab: undefined,
        })}
      />,
    );
    expect(screen.getByText("Records could not be loaded")).toBeInTheDocument();
  });
});
