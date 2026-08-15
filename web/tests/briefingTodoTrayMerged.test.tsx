import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor, within } from "@testing-library/react";
import {
  RightSidebarContext,
  SyncContext,
  SYNC_DOMAINS,
  todayDateKey,
  type DataService,
  type RightSidebarContextValue,
  type SyncDomain,
  type TodoNode,
  type WebSyncContextValue,
} from "@life-editor/shared";
import { makeTodo, stubDataService } from "./helpers";
import { BriefingScreen } from "../src/briefing/BriefingScreen";

/*
 * Briefing's Todo tray after #795 — the host half of the merge.
 *
 * The pure tray's own suite covers the layout (one heading, time-less rows
 * first, the chip-todo pill). What only the host can answer is whether
 * Briefing actually opts in and which words it opts in WITH: the point of the
 * issue is that「Add from todos → Candidates」became「Todos list → Scheduled」,
 * and that is a translation-catalogue fact the component cannot assert.
 */

const TODAY = todayDateKey();

const syncValue: WebSyncContextValue = {
  syncVersion: 0,
  domainVersions: Object.fromEntries(SYNC_DOMAINS.map((d) => [d, 0])) as Record<
    SyncDomain,
    number
  >,
  triggerSync: async () => undefined,
};

/** Staged as "today, time TBD" — what the tray's own add button writes. */
const UNTIMED: TodoNode = makeTodo({
  id: "t-untimed",
  title: "Draft the outline",
  status: "NOT_STARTED",
  scheduledAt: `${TODAY}T00:00:00.000Z`,
  isAllDay: true,
});
/** Unscheduled, so it shows up in the picker rather than on the list. */
const ADDABLE: TodoNode = makeTodo({
  id: "t-addable",
  title: "Someday todo",
  status: "NOT_STARTED",
});

function makeDS(): DataService {
  return stubDataService({
    fetchScheduleItemsByDate: vi.fn().mockResolvedValue([]),
    fetchTodoTree: vi.fn().mockResolvedValue([UNTIMED, ADDABLE]),
    fetchTimerSessions: vi.fn().mockResolvedValue([]),
    getDailyByDateUnified: vi.fn().mockResolvedValue(null),
    listNotesUnified: vi.fn().mockResolvedValue([]),
    listAllTagConnections: vi.fn().mockResolvedValue([]),
  });
}

function renderWithPanel() {
  const panelBody = document.createElement("div");
  panelBody.setAttribute("data-testid", "panel-body");
  document.body.appendChild(panelBody);
  const sidebar: RightSidebarContextValue = {
    isOpen: true,
    open: () => undefined,
    close: () => undefined,
    requestClose: () => undefined,
    toggle: () => undefined,
    width: 320,
    setWidth: () => undefined,
    portalTarget: panelBody,
    setPortalTarget: () => undefined,
    contentCount: 0,
    registerContent: () => () => undefined,
  };
  render(
    <SyncContext.Provider value={syncValue}>
      <RightSidebarContext.Provider value={sidebar}>
        <BriefingScreen
          dataService={makeDS()}
          onNavigate={vi.fn()}
          tab="morning"
        />
      </RightSidebarContext.Provider>
    </SyncContext.Provider>,
  );
  return panelBody;
}

describe("Briefing Todo tray copy + merge (#795)", () => {
  afterEach(() => {
    document
      .querySelectorAll('[data-testid="panel-body"]')
      .forEach((el) => el.remove());
  });

  it("heads the picker 'Todos list' and the rows 'Scheduled', with no Candidates pen", async () => {
    const panelBody = renderWithPanel();
    await waitFor(() =>
      expect(within(panelBody).getByText("Todos list")).toBeTruthy(),
    );
    expect(within(panelBody).getByText("Scheduled")).toBeTruthy();
    expect(within(panelBody).queryByText("Candidates")).toBeNull();
    expect(within(panelBody).queryByText("Add from todos")).toBeNull();
  });

  it("shows a time-less todo on that one list, marked all-day", async () => {
    const panelBody = renderWithPanel();
    await waitFor(() =>
      expect(within(panelBody).getByText("Draft the outline")).toBeTruthy(),
    );
    const pill = within(panelBody).getByText("All day");
    // Todo colour, not the neutral face an all-day EVENT wears.
    expect(pill.className).toContain("bg-lumen-chip-task-bg");
    // The unscheduled one is still only an offer in the picker.
    expect(within(panelBody).getByText("Someday todo")).toBeTruthy();
  });
});
