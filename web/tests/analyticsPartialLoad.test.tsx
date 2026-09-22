import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import type { DataService } from "@life-editor/shared";
import { AnalyticsScreen } from "../src/analytics/AnalyticsScreen";
import { createBumpableSync, stubDataService } from "./helpers";

/*
 * The Analytics host's mount load when its sources do not all answer (#1524).
 *
 * The nine reads used to be bundled with `Promise.all`, so the FIRST rejection
 * threw the other eight answers away, the screen fell back to its all-zero
 * EMPTY, and nothing on it said why. On 2026-09-05 that turned one missing
 * migration on `timer_sessions` into a dashboard reporting no todos, no events
 * and no notes — zeros the user had no way to tell from real ones.
 *
 * shared/tests cannot see any of this: those suites take the numbers in as
 * props. The behaviour lives entirely in this host's fetch, which is why the
 * regression needs a web suite.
 *
 * Both widths are exercised, because they fail differently. Desktop keeps its
 * cards and just loses one card's number; Mobile, when NOTHING loads, hits its
 * "nothing recorded yet" empty state — the exact screen that must not claim
 * the user has no records.
 *
 * No jest-dom in web/ — presence comes from getBy* throwing, absence from
 * queryBy* being null.
 */

const TODOS = [
  { id: "task-1", type: "task", title: "Ship the fix", status: "TODO" },
  { id: "task-2", type: "task", title: "Write the test", status: "DONE" },
];

const NOTES = [{ id: "note-1", title: "Migration notes", isDeleted: false }];

function makeDS(over: Partial<Record<keyof DataService, unknown>> = {}) {
  return stubDataService({
    fetchTimerSessions: vi.fn().mockResolvedValue([]),
    fetchTodoTree: vi.fn().mockResolvedValue(TODOS),
    fetchScheduleItemsByDateRange: vi.fn().mockResolvedValue([]),
    fetchEvents: vi.fn().mockResolvedValue([]),
    fetchAllRoutines: vi.fn().mockResolvedValue([]),
    listNotesUnified: vi.fn().mockResolvedValue(NOTES),
    listAllWikiTagsUnified: vi.fn().mockResolvedValue([]),
    listAllTagAssignments: vi.fn().mockResolvedValue([]),
    fetchTimerSettings: vi.fn().mockResolvedValue({ targetSessions: 4 }),
    ...over,
  });
}

/** The 400 that started this: a column production did not have yet. */
const failing = () =>
  vi
    .fn()
    .mockRejectedValue(
      new Error("column timer_sessions.event_id does not exist"),
    );

/** Every one of the nine down at once — a dead connection, not one bad table. */
function allFailingDS() {
  const dead: Record<string, unknown> = {};
  for (const key of Object.keys(makeDS() as unknown as object)) {
    dead[key] = failing();
  }
  return stubDataService(dead as Partial<Record<keyof DataService, unknown>>);
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

async function renderScreen(ds: DataService, settled: () => unknown) {
  const { wrapper: SyncWrapper } = createBumpableSync();
  render(
    <SyncWrapper>
      <AnalyticsScreen
        dataService={ds}
        tab="overview"
        onTabChange={vi.fn()}
        preset="30d"
        onPresetChange={vi.fn()}
      />
    </SyncWrapper>,
  );
  // The first-load skeleton is up until the mount read settles.
  await waitFor(settled);
}

/** A stat card's number — the node immediately before its label. */
function statValue(label: string): string {
  return screen.getByText(label).previousElementSibling?.textContent ?? "";
}

beforeEach(cleanup);
afterEach(() => {
  // @ts-expect-error — leave no stub behind for the next file.
  delete window.matchMedia;
});

describe("AnalyticsScreen partial load", () => {
  it("keeps every source that answered when one of them fails", async () => {
    mockMatchMedia(true);
    await renderScreen(makeDS({ fetchTimerSessions: failing() }), () =>
      screen.getByText("Todos"),
    );
    expect(statValue("Todos")).toBe("2");
    expect(statValue("Notes")).toBe("1");
  });

  it("names the source it lost on screen, not only in the console", async () => {
    mockMatchMedia(true);
    await renderScreen(makeDS({ fetchTimerSessions: failing() }), () =>
      screen.getByText("Todos"),
    );
    const band = screen.getByRole("status");
    expect(band.textContent).toContain("work sessions");
    // Only the read that failed is named.
    expect(band.textContent).not.toContain("notes");
  });

  it("draws no band at all when every source answers", async () => {
    mockMatchMedia(true);
    await renderScreen(makeDS(), () => screen.getByText("Todos"));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("says so on Mobile even when the failure empties every list", async () => {
    mockMatchMedia(false);
    await renderScreen(allFailingDS(), () =>
      screen.getByText("Nothing recorded yet"),
    );
    // The empty state is still there, but no longer on its own: the band above
    // it says the lists are empty because nothing could be read.
    const band = screen.getByRole("status");
    expect(band.textContent).toContain("work sessions");
    expect(band.textContent).toContain("todos");
  });
});
