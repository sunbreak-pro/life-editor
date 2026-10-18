import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { AppRecord, DataService } from "@life-editor/shared";
import { AnalyticsScreen } from "../src/analytics/AnalyticsScreen";
import { createBumpableSync, stubDataService } from "./helpers";

/*
 * The Analytics host's records read (#2164): what it asks the DataService for,
 * what it does when a read fails, and the hand-off of the Apps section's
 * "show records" intent into the tab.
 *
 * recharts is stubbed (jsdom has no layout; the bars are covered by the model
 * suite in shared/tests). No jest-dom in web/ — presence comes from getBy*
 * throwing, absence from queryBy* being null.
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

function noon(daysAgo: number): string {
  const d = new Date();
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() - daysAgo,
    12,
  ).toISOString();
}

function rec(over: Partial<AppRecord>): AppRecord {
  return {
    id: "r1",
    sourceApp: "ledger",
    externalId: null,
    kind: "expense",
    occurredAt: noon(1),
    value: 450,
    unit: "JPY",
    dims: {},
    note: null,
    createdAt: noon(1),
    updatedAt: noon(1),
    ...over,
  };
}

const LEDGER_APP = {
  slug: "ledger",
  name: "Household ledger",
  url: null,
  icon: null,
  description: null,
  sortOrder: 0,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
};

function makeDS(over: Partial<Record<keyof DataService, unknown>> = {}) {
  return stubDataService({
    fetchTimerSessions: vi.fn().mockResolvedValue([]),
    fetchTodoTree: vi.fn().mockResolvedValue([]),
    fetchScheduleItemsByDateRange: vi.fn().mockResolvedValue([]),
    fetchEvents: vi.fn().mockResolvedValue([]),
    fetchAllRoutines: vi.fn().mockResolvedValue([]),
    listNotesUnified: vi.fn().mockResolvedValue([]),
    listAllWikiTagsUnified: vi.fn().mockResolvedValue([]),
    listAllTagAssignments: vi.fn().mockResolvedValue([]),
    fetchTimerSettings: vi.fn().mockResolvedValue({ targetSessions: 4 }),
    listAppRecords: vi.fn().mockResolvedValue([rec({})]),
    listExtensionApps: vi.fn().mockResolvedValue([LEDGER_APP]),
    ...over,
  });
}

function mockMatchMedia(matches: boolean) {
  // @ts-expect-error — minimal MediaQueryList stub for jsdom, which has none.
  window.matchMedia = () => ({
    matches,
    media: "",
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

/** The record list rows, as one string (the kind also sits in the filter). */
function listText(): string {
  return Array.from(document.querySelectorAll("section ul li"))
    .map((li) => li.textContent ?? "")
    .join("|");
}

function renderRecords(
  ds: DataService,
  extra: Partial<Parameters<typeof AnalyticsScreen>[0]> = {},
) {
  const sync = createBumpableSync();
  const view = render(
    <sync.wrapper>
      <AnalyticsScreen
        dataService={ds}
        tab="records"
        onTabChange={vi.fn()}
        preset="30d"
        onPresetChange={vi.fn()}
        {...extra}
      />
    </sync.wrapper>,
  );
  return { ...view, sync: sync.sync };
}

beforeEach(() => mockMatchMedia(true));
afterEach(() => {
  cleanup();
  // @ts-expect-error — leave no stub behind for the next file.
  delete window.matchMedia;
});

describe("AnalyticsScreen records read", () => {
  it("asks for the selected range and names the app from the ledger", async () => {
    const ds = makeDS();
    renderRecords(ds);

    await waitFor(() => expect(listText()).toContain("expense"));
    const calls = (ds.listAppRecords as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const [window] = calls[calls.length - 1] as [{ from: string; to: string }];
    // 30 days ending today, `to` exclusive: from the local midnight 29 days
    // back to the local midnight after today.
    const days =
      (new Date(window.to).getTime() - new Date(window.from).getTime()) /
      86_400_000;
    expect(Math.round(days)).toBe(30);
    expect(screen.getAllByText(/Household ledger/).length).toBeGreaterThan(0);
  });

  it("falls back to the slug when only the ledger read fails", async () => {
    const ds = makeDS({
      listExtensionApps: vi.fn().mockRejectedValue(new Error("down")),
    });
    renderRecords(ds);

    await waitFor(() => expect(listText()).toContain("expense"));
    expect(screen.queryByText(/Household ledger/)).toBeNull();
    expect(screen.getAllByText(/ledger/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/could not be loaded/)).toBeNull();
  });

  it("says so, and not 'no records', when the records read fails", async () => {
    const ds = makeDS({
      listAppRecords: vi.fn().mockRejectedValue(new Error("column missing")),
    });
    renderRecords(ds);

    await waitFor(() => screen.getByText(/Records could not be loaded/));
    expect(screen.queryByText("No records in this range")).toBeNull();
  });

  it("shows the empty guidance when nothing is recorded", async () => {
    renderRecords(makeDS({ listAppRecords: vi.fn().mockResolvedValue([]) }));
    await waitFor(() => screen.getByText("No records in this range"));
  });

  it("re-reads when a record lands (the appRecords sync domain)", async () => {
    const listAppRecords = vi.fn().mockResolvedValue([rec({})]);
    const { sync } = renderRecords(makeDS({ listAppRecords }));
    await waitFor(() => expect(listText()).toContain("expense"));
    const before = listAppRecords.mock.calls.length;

    listAppRecords.mockResolvedValue([
      rec({}),
      rec({ id: "r2", kind: "income", value: 3000 }),
    ]);
    act(() => sync.bump("appRecords"));

    await waitFor(() => expect(listText()).toContain("income"));
    expect(listAppRecords.mock.calls.length).toBeGreaterThan(before);
  });
});

describe("AnalyticsScreen pending records source", () => {
  it("opens the tab on the requested app and hands the request back once", async () => {
    const consumed = vi.fn();
    renderRecords(
      makeDS({
        listAppRecords: vi
          .fn()
          .mockResolvedValue([
            rec({}),
            rec({ id: "r2", sourceApp: "claude", kind: "weight", unit: "kg" }),
          ]),
      }),
      { pendingRecordsSource: "claude", onRecordsSourceConsumed: consumed },
    );

    await waitFor(() => expect(listText()).toContain("weight"));
    expect(listText()).not.toContain("expense");
    expect((screen.getByLabelText("App") as HTMLSelectElement).value).toBe(
      "claude",
    );
    expect(consumed).toHaveBeenCalledTimes(1);
  });
});

describe("AnalyticsScreen narrow records block", () => {
  it("shows each kind's average and latest over the last 7 days (#2262)", async () => {
    mockMatchMedia(false);
    renderRecords(
      makeDS({
        listAppRecords: vi
          .fn()
          .mockResolvedValue([
            rec({ id: "a", value: 450, occurredAt: noon(0) }),
            rec({ id: "b", value: 550, occurredAt: noon(2) }),
          ]),
      }),
      { tab: "overview" },
    );

    await waitFor(() => screen.getByText("Last 7 days"));
    expect(screen.getByText("500 JPY")).toBeTruthy();
    // noon(0) is the newest record.
    expect(screen.getByText("450 JPY")).toBeTruthy();
    expect(screen.queryByText(/1,000 JPY/)).toBeNull();
  });
});
