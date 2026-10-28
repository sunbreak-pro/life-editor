import { describe, it, expect, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import {
  SyncContext,
  SYNC_DOMAINS,
  WEEK_STARTS_ON,
  goalPeriodKeys,
  todayDateKey,
  type DataService,
  type Goal,
  type SyncDomain,
  type WebSyncContextValue,
} from "@life-editor/shared";
import { makeTodo, stubDataService } from "./helpers";
import { mockOf } from "./helpers/briefingHarness";
import { BriefingScreen } from "../src/briefing/BriefingScreen";

/*
 * #2327 — the paper reads the goal tables once, whichever tab it opens on.
 *
 * The evening paper used to open its own goal snapshot (useGoalLinkSnapshot,
 * active while 夕刊 is shown) next to the morning paper's, so a launch after
 * 17:00 — when the paper opens on 夕刊 — read goals and their links twice, and
 * switching from 朝刊 to 夕刊 read them again. It now draws on the morning
 * paper's snapshot (useMorningGoals' snapshotState / snapshotFailed).
 *
 * The evening block still has to show the goals, so each case also checks
 * that the moved goal reaches「GOALS MOVED TODAY」.
 */

const TODAY = todayDateKey();
const WEEK = goalPeriodKeys(TODAY, WEEK_STARTS_ON).week;
const NOW_ISO = new Date().toISOString();

const syncValue: WebSyncContextValue = {
  syncVersion: 0,
  domainVersions: Object.fromEntries(SYNC_DOMAINS.map((d) => [d, 0])) as Record<
    SyncDomain,
    number
  >,
  triggerSync: async () => undefined,
};

const WEEK_GOAL: Goal = {
  id: "g-plan",
  title: "企画書を通す",
  periodKind: "week",
  periodKey: WEEK,
  sortOrder: 0,
  parentGoalId: null,
  manualAchievedAt: null,
  periodEndDecision: null,
  decidedAt: null,
  carriedFromGoalId: null,
  legacyKey: null,
  isDeleted: false,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

function makeDS(): DataService {
  return stubDataService({
    fetchScheduleItemsByDate: vi.fn().mockResolvedValue([]),
    fetchTodoTree: vi.fn().mockResolvedValue([
      makeTodo({
        id: "t-done",
        title: "初稿を仕上げる",
        status: "DONE",
        completedAt: NOW_ISO,
      }),
    ]),
    fetchTimerSessions: vi.fn().mockResolvedValue([]),
    getDailyByDateUnified: vi.fn().mockResolvedValue(null),
    listNotesUnified: vi.fn().mockResolvedValue([]),
    listAllTagConnections: vi.fn().mockResolvedValue([]),
    listDailiesUnified: vi.fn().mockResolvedValue([]),
    fetchGoals: vi.fn().mockResolvedValue([WEEK_GOAL]),
    fetchGoalTodoLinks: vi
      .fn()
      .mockResolvedValue([
        { id: "l1", goalId: "g-plan", todoId: "t-done", isDeleted: false },
      ]),
    // No `note-goals` and no focus note: the #2105 migration finds nothing.
    getNoteUnified: vi.fn().mockResolvedValue(null),
  });
}

function paper(ds: DataService, tab: "morning" | "evening") {
  return (
    <SyncContext.Provider value={syncValue}>
      <BriefingScreen
        dataService={ds}
        onNavigate={vi.fn()}
        tab={tab}
        key={TODAY}
      />
    </SyncContext.Provider>
  );
}

/** Let every read land and every effect settle. */
async function settle() {
  for (let i = 0; i < 5; i++) await act(async () => undefined);
}

async function expectEveningGoalShown() {
  await screen.findByText("CLOSING THE DAY");
  const goals = await screen.findByRole("region", {
    name: "GOALS MOVED TODAY",
  });
  await within(goals).findByText("企画書を通す");
}

describe("the goal tables are read once per paper (#2327)", () => {
  it("opened on the evening tab: one fetchGoals, one fetchGoalTodoLinks", async () => {
    const ds = makeDS();
    render(paper(ds, "evening"));

    await expectEveningGoalShown();
    await settle();

    expect(mockOf(ds, "fetchGoals")).toHaveBeenCalledTimes(1);
    expect(mockOf(ds, "fetchGoalTodoLinks")).toHaveBeenCalledTimes(1);
  });

  it("switching from the morning tab to the evening tab reads nothing new", async () => {
    const ds = makeDS();
    const view = render(paper(ds, "morning"));
    await screen.findByText("GOALS AHEAD");
    await settle();
    expect(mockOf(ds, "fetchGoals")).toHaveBeenCalledTimes(1);

    view.rerender(paper(ds, "evening"));
    await expectEveningGoalShown();
    await settle();

    expect(mockOf(ds, "fetchGoals")).toHaveBeenCalledTimes(1);
    expect(mockOf(ds, "fetchGoalTodoLinks")).toHaveBeenCalledTimes(1);
  });
});
