import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  AnalyticsView,
  type AnalyticsViewProps,
} from "../src/components/Analytics/AnalyticsView";
import type { AppRecord } from "../src/types/appRecord";
import type { ExtensionApp } from "../src/types/extensionApp";
import type { RecordView } from "../src/types/recordView";
import { makeAnalyticsLabels } from "./helpers/analyticsLabels";
import en from "../src/i18n/locales/en.json";
import ja from "../src/i18n/locales/ja.json";

/*
 * The Analytics Records tab and the narrow Records block (#2164).
 *
 * Rendered through <AnalyticsView activeTab="records"> so the real tab wiring,
 * the date-range preset and the empty / filter states are all exercised. The
 * numbers themselves come from the shared aggregation (#2162), which has its
 * own suite — what is pinned here is which rows reach it and what is drawn.
 *
 * recharts is stubbed: jsdom has no layout, so the bars cannot be read anyway
 * (the bar model is covered in analyticsRecordsModel.test.ts). The series
 * stubs say which shape was drawn and whether it animates (#2264).
 */

vi.mock("recharts", () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    ResponsiveContainer: Passthrough,
    BarChart: Passthrough,
    LineChart: Passthrough,
    Bar: ({ isAnimationActive }: { isAnimationActive?: boolean }) => (
      <div data-testid="records-bar" data-animate={String(isAnimationActive)} />
    ),
    Line: ({ isAnimationActive }: { isAnimationActive?: boolean }) => (
      <div
        data-testid="records-line"
        data-animate={String(isAnimationActive)}
      />
    ),
    XAxis: () => null,
    // Says which value range the axis was handed (#2311); none = recharts' own.
    YAxis: ({ domain }: { domain?: [number, number] }) => (
      <div
        data-testid="records-y-axis"
        data-domain={domain ? domain.join(",") : "auto"}
      />
    ),
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

/**
 * A stat card's number: the node right before its label. The label is a <p>;
 * the same word is also an <option> of the per-kind select (#2263).
 */
function statValue(label: string): string {
  return (
    screen.getByText(label, { selector: "p" }).previousElementSibling
      ?.textContent ?? ""
  );
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
    expect(statValue("Latest")).toBe("450 JPY");
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
    expect(statValue("Latest")).toBe("-");
    expect(screen.getByText("Pick one kind")).toBeInTheDocument();
  });

  it("narrows the list and the three numbers by app", () => {
    render(<AnalyticsView {...props({ records })} />);
    fireEvent.change(select("App"), { target: { value: "claude" } });

    expect(listRows()).toHaveLength(1);
    expect(statValue("Records")).toBe("1");
    expect(statValue("Total")).toBe("62.4 kg");
  });

  it("keeps the 'pick one kind' hint for an app that sent two kinds (#2232)", () => {
    render(<AnalyticsView {...props({ records })} />);
    // The ledger sent expense and income: one app is still two kinds, so the
    // total stays "-" and the hint must not promise that the app alone fixes it.
    fireEvent.change(select("App"), { target: { value: "ledger" } });
    expect(statValue("Total")).toBe("-");
    expect(screen.getByText("Pick one kind")).toBeInTheDocument();

    // Following the hint — one kind — is what brings the numbers.
    fireEvent.change(select("Kind"), { target: { value: "expense" } });
    expect(statValue("Total")).toBe("1010 JPY");
    expect(screen.queryByText("Pick one kind")).toBeNull();
  });

  it("words the hint as 'narrow to one kind', without the app (#2232)", () => {
    const hints = [
      en.analytics.records.stats.needOneKind,
      ja.analytics.records.stats.needOneKind,
    ];
    expect(hints[0]).toMatch(/one kind/);
    expect(hints[0]).not.toMatch(/app/i);
    expect(hints[1]).toMatch(/^種類を 1 つに絞ると/);
    expect(hints[1]).not.toMatch(/アプリ/);
  });

  it("narrows by kind and sums that kind", () => {
    render(<AnalyticsView {...props({ records })} />);
    fireEvent.change(select("Kind"), { target: { value: "expense" } });

    expect(listRows()).toHaveLength(3);
    expect(statValue("Records")).toBe("3");
    expect(statValue("Total")).toBe("1010 JPY");
    expect(statValue("Average")).toBe("336.6666666666667 JPY");
    // noon(1) is the newest expense.
    expect(statValue("Latest")).toBe("450 JPY");
  });

  it("puts average and latest beside the total for two weighings in kg (#2262)", () => {
    render(
      <AnalyticsView
        {...props({
          records: [
            rec({ occurredAt: noon(1), kind: "weight", unit: "kg", value: 62 }),
            rec({
              occurredAt: noon(3),
              kind: "weight",
              unit: "kg",
              value: 62.5,
            }),
          ],
        })}
      />,
    );
    expect(statValue("Records")).toBe("2");
    expect(statValue("Total")).toBe("124.5 kg");
    expect(statValue("Average")).toBe("62.25 kg");
    expect(statValue("Latest")).toBe("62 kg");
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

function savedView(
  kind: string,
  unit: string | null,
  over: Partial<RecordView> = {},
): RecordView {
  return {
    kind,
    unit,
    metric: "sum",
    chart: "bar",
    createdAt: noon(1),
    updatedAt: noon(1),
    ...over,
  };
}

describe("Records tab chart shapes (#2264)", () => {
  const weighings = [
    rec({ occurredAt: noon(1), kind: "weight", unit: "kg", value: 62 }),
    rec({ occurredAt: noon(3), kind: "weight", unit: "kg", value: 62.5 }),
  ];

  it("draws bars for a kind with nothing saved", () => {
    render(<AnalyticsView {...props({ records: weighings })} />);
    screen.getByTestId("records-bar");
    expect(screen.queryByTestId("records-line")).toBeNull();
  });

  it("draws a line for a kind saved as a line", () => {
    render(
      <AnalyticsView
        {...props({
          records: weighings,
          recordViews: [savedView("weight", "kg", { chart: "line" })],
        })}
      />,
    );
    screen.getByTestId("records-line");
    expect(screen.queryByTestId("records-bar")).toBeNull();
  });

  it("keeps the count bars for mixed kinds, whatever one of them saved", () => {
    render(
      <AnalyticsView
        {...props({
          records: [...weighings, rec({ occurredAt: noon(2) })],
          recordViews: [savedView("weight", "kg", { chart: "line" })],
        })}
      />,
    );
    screen.getByTestId("records-bar");
    expect(screen.queryByTestId("records-line")).toBeNull();
  });

  it("animates the line, and stops it when less motion is asked for", () => {
    const recordViews = [savedView("weight", "kg", { chart: "line" })];
    const view = render(
      <AnalyticsView {...props({ records: weighings, recordViews })} />,
    );
    expect(screen.getByTestId("records-line").dataset.animate).toBe("true");
    view.rerender(
      <AnalyticsView
        {...props({ records: weighings, recordViews, reduceMotion: true })}
      />,
    );
    expect(screen.getByTestId("records-line").dataset.animate).toBe("false");
  });

  it("hands a picked shape to the host, keyed by kind and unit", () => {
    const onChooseRecordChart = vi.fn();
    render(
      <AnalyticsView {...props({ records: weighings, onChooseRecordChart })} />,
    );
    const select = screen.getByLabelText("Chart for weight");
    expect((select as HTMLSelectElement).value).toBe("bar");
    fireEvent.change(select, { target: { value: "line" } });
    expect(onChooseRecordChart).toHaveBeenCalledWith("weight", "kg", "line");
  });
});

describe("Records tab value axis (#2311)", () => {
  const weighings = [
    rec({ occurredAt: noon(1), kind: "weight", unit: "kg", value: 68 }),
    rec({ occurredAt: noon(3), kind: "weight", unit: "kg", value: 67 }),
  ];
  const domain = (): string =>
    screen.getByTestId("records-y-axis").dataset.domain ?? "";

  it("fits a line's axis to the values drawn, with a little room", () => {
    render(
      <AnalyticsView
        {...props({
          records: weighings,
          recordViews: [
            savedView("weight", "kg", { chart: "line", metric: "latest" }),
          ],
        })}
      />,
    );
    screen.getByTestId("records-line");
    // 67–68 kg with a tenth of the spread above and below, not 0–68.
    expect(domain()).toBe("66.9,68.1");
  });

  it("keeps the bars standing on zero", () => {
    render(
      <AnalyticsView
        {...props({
          records: weighings,
          recordViews: [
            savedView("weight", "kg", { chart: "bar", metric: "latest" }),
          ],
        })}
      />,
    );
    screen.getByTestId("records-bar");
    expect(domain()).toBe("auto");
  });

  it("still gives a single weighing an axis to stand in", () => {
    render(
      <AnalyticsView
        {...props({
          records: [weighings[0]],
          recordViews: [
            savedView("weight", "kg", { chart: "line", metric: "latest" }),
          ],
        })}
      />,
    );
    screen.getByTestId("records-line");
    const [lo, hi] = domain().split(",").map(Number);
    expect(lo).toBeLessThan(68);
    expect(hi).toBeGreaterThan(68);
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
    // Nothing saved in record_views: every kind leads with its total (#2263).
    expect(lines).toEqual([
      "expense · 2 recordsTotal1000 JPY",
      "weight · 1 recordsTotal62.4 kg",
    ]);
  });

  it("leads each kind with the number saved for it (#2263)", () => {
    mockMatchMedia(false);
    const records = [
      rec({ occurredAt: noon(1), kind: "weight", unit: "kg", value: 62 }),
      rec({ occurredAt: noon(3), kind: "weight", unit: "kg", value: 62.5 }),
    ];
    const recordViews = [
      {
        kind: "weight",
        unit: "kg",
        metric: "latest" as const,
        chart: "bar" as const,
        createdAt: noon(1),
        updatedAt: noon(1),
      },
    ];
    render(
      <AnalyticsView
        {...props({ records, recordViews, activeTab: undefined })}
      />,
    );

    const block = screen.getByText("Last 7 days").closest("div")
      ?.parentElement as HTMLElement;
    const [line] = within(block).getAllByRole("listitem");
    // The #2212 browser check read "weight · 2 records 124.5 kg".
    expect(line.textContent).not.toContain("124.5");
    expect(
      within(line).getByText("Latest").nextElementSibling?.textContent,
    ).toBe("62 kg");
  });

  it("draws each kind's week in the chart shape saved for it (#2264)", () => {
    mockMatchMedia(false);
    const records = [
      rec({ occurredAt: noon(1), kind: "weight", unit: "kg", value: 62 }),
      rec({ occurredAt: noon(2), value: 300 }),
    ];
    render(
      <AnalyticsView
        {...props({
          records,
          recordViews: [savedView("weight", "kg", { chart: "line" })],
          activeTab: undefined,
        })}
      />,
    );

    const block = screen.getByText("Last 7 days").closest("div")
      ?.parentElement as HTMLElement;
    const [expense, weight] = within(block).getAllByRole("listitem");
    const shape = (line: HTMLElement): string | undefined =>
      line.querySelector<SVGElement>("svg[data-chart]")?.dataset.chart;
    expect(shape(weight)).toBe("line");
    // Nothing saved for expense: bars, like the wide tab's default.
    expect(shape(expense)).toBe("bar");
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

  it("draws a skeleton, not 'none', while the records read is in flight (#2214)", () => {
    mockMatchMedia(false);
    // Nothing else is loaded either: the whole-screen empty state must not
    // claim "nothing yet" while the records are still being read.
    const view = render(
      <AnalyticsView
        {...props({ records: [], recordsLoading: true, activeTab: undefined })}
      />,
    );
    const block = screen.getByText("Last 7 days").closest("div")
      ?.parentElement as HTMLElement;
    expect(block.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(screen.queryByText("No records in the last 7 days.")).toBeNull();

    // Once the read settles, the "none" line comes back as before.
    view.rerender(
      <AnalyticsView
        {...props({
          records: [rec({ occurredAt: noon(20) })],
          recordsLoading: false,
          activeTab: undefined,
        })}
      />,
    );
    expect(block.querySelector("[aria-busy='true']")).toBeNull();
    expect(
      screen.getByText("No records in the last 7 days."),
    ).toBeInTheDocument();
  });

  it("puts the failed-read line over the skeleton once the read settles with an error", () => {
    mockMatchMedia(false);
    render(
      <AnalyticsView
        {...props({
          records: [rec({ occurredAt: noon(0) })],
          recordsLoading: false,
          recordsError: "boom",
          activeTab: undefined,
        })}
      />,
    );
    expect(screen.getByText("Records could not be loaded")).toBeInTheDocument();
    expect(document.querySelector("[aria-busy='true']")).toBeNull();
  });
});
