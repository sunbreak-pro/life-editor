import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import type { DataService } from "@life-editor/shared";
import { stubDataService, createBumpableSync } from "./helpers";
import { WorkHistoryPanel } from "../src/work/WorkHistoryPanel";

/*
 * #2054 / D-20261003-work-2 — the Mobile drawer's history reads today AND
 * yesterday, each under its own heading; the Desktop card keeps the single
 * latest day. Mounted bare (no WorkScreen) so the pair is the only thing on
 * the page.
 */

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) =>
        opts ? `${key}|${Object.values(opts).join(",")}` : key,
      i18n: { language: "en" },
    }),
  };
});

/** `daysAgo` days back at hh:00, local time. */
function at(daysAgo: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function work(id: number, startedAt: Date) {
  return {
    id,
    todoId: null,
    eventId: null,
    sessionType: "WORK",
    startedAt,
    completedAt: new Date(startedAt.getTime() + 25 * 60_000),
    duration: 1500,
    completed: true,
    label: null,
  };
}

function makeDs(): DataService {
  return stubDataService({
    fetchTimerSessions: vi.fn(async () => [
      work(1, at(0, 9)),
      work(2, at(1, 21)),
      work(3, at(1, 8)),
      work(4, at(2, 9)),
    ]),
    fetchTodoTree: vi.fn(async () => []),
    fetchScheduleItemsByDateRange: vi.fn(async () => []),
    listAllWikiTagsUnified: vi.fn(async () => []),
    listAllTagAssignments: vi.fn(async () => []),
  }) as DataService;
}

const { wrapper: SyncWrapper } = createBumpableSync();

describe("WorkHistoryPanel days (#2054)", () => {
  it("lists today and yesterday under their own headings on Mobile", async () => {
    render(
      <SyncWrapper>
        <WorkHistoryPanel dataService={makeDs()} variant="rows" />
      </SyncWrapper>,
    );
    const today = await screen.findByRole("list", {
      name: "work.history.today",
    });
    const yesterday = screen.getByRole("list", {
      name: "work.history.yesterday",
    });
    expect(within(today).getAllByTestId("work-history-row")).toHaveLength(1);
    // Oldest first within the day; two days back is not part of the pair.
    const rows = within(yesterday).getAllByTestId("work-history-row");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("08:00–08:25");
    expect(rows[1].textContent).toContain("21:00–21:25");
    expect(screen.getAllByTestId("work-history-row")).toHaveLength(3);
  });

  it("keeps the Desktop card on today alone", async () => {
    render(
      <SyncWrapper>
        <WorkHistoryPanel dataService={makeDs()} />
      </SyncWrapper>,
    );
    await screen.findAllByTestId("work-history-row");
    expect(screen.getAllByTestId("work-history-row")).toHaveLength(1);
    screen.getByText("work.history.today");
    expect(screen.queryByText("work.history.yesterday")).toBeNull();
  });
});

describe("WorkHistoryPanel failed read (#2054)", () => {
  it("says the read failed and reads again on retry", async () => {
    const sessions = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue([work(1, at(0, 9))]);
    const ds = stubDataService({
      fetchTimerSessions: sessions,
      fetchTodoTree: vi.fn(async () => []),
      fetchScheduleItemsByDateRange: vi.fn(async () => []),
      listAllWikiTagsUnified: vi.fn(async () => []),
      listAllTagAssignments: vi.fn(async () => []),
    }) as DataService;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(
        <SyncWrapper>
          <WorkHistoryPanel dataService={ds} variant="rows" />
        </SyncWrapper>,
      );
      const failed = await screen.findByTestId("work-load-failed");
      expect(failed.textContent).toContain("work.history.loadFailedTitle");
      expect(screen.queryByText("work.history.emptyTitle")).toBeNull();
      fireEvent.click(
        screen.getByRole("button", { name: "work.history.retry" }),
      );
      expect(await screen.findAllByTestId("work-history-row")).toHaveLength(1);
      expect(screen.queryByTestId("work-load-failed")).toBeNull();
      expect(sessions).toHaveBeenCalledTimes(2);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
