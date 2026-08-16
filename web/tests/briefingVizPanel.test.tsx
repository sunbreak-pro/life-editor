import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import {
  RightSidebarContext,
  SyncContext,
  SYNC_DOMAINS,
  type DataService,
  type RightSidebarContextValue,
  type SyncDomain,
  type WebSyncContextValue,
} from "@life-editor/shared";
import { stubDataService } from "./helpers";
import { BriefingScreen } from "../src/briefing/BriefingScreen";

/*
 * 「きのうまでの自分」moved from the paper's column into the detail panel
 * (#938).
 *
 * Asserted through the portal target, like the tray's own suite (#609): the
 * block's home is decided by WHICH tree it renders into, and the portal target
 * is the only place that distinction is visible. The paper's side of the move
 * (the section is gone, the widget labels are no longer props) is pinned in
 * shared/tests/briefingView.test.tsx; what this suite adds is that the host
 * actually mounts it in the panel, on the right paper, at both widths.
 */

const value: WebSyncContextValue = {
  syncVersion: 0,
  domainVersions: Object.fromEntries(SYNC_DOMAINS.map((d) => [d, 0])) as Record<
    SyncDomain,
    number
  >,
  triggerSync: async () => undefined,
};

function makeDS(): DataService {
  return stubDataService({
    fetchScheduleItemsByDate: vi.fn().mockResolvedValue([]),
    fetchTodoTree: vi.fn().mockResolvedValue([]),
    fetchTimerSessions: vi.fn().mockResolvedValue([]),
    getDailyByDateUnified: vi.fn().mockResolvedValue(null),
    listNotesUnified: vi.fn().mockResolvedValue([]),
    listAllTagConnections: vi.fn().mockResolvedValue([]),
  });
}

/** jsdom has no matchMedia, and useMediaQuery falls back to wide without it. */
function setWidth(wide: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: wide,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

function renderWithPanel(wide: boolean, tab: "morning" | "evening") {
  setWidth(wide);
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
  const view = render(
    <SyncContext.Provider value={value}>
      <RightSidebarContext.Provider value={sidebar}>
        <BriefingScreen dataService={makeDS()} onNavigate={vi.fn()} tab={tab} />
      </RightSidebarContext.Provider>
    </SyncContext.Provider>,
  );
  return { panelBody, view };
}

describe("Briefing visual zone in the detail panel (#938)", () => {
  beforeEach(() => setWidth(true));
  afterEach(() => {
    document
      .querySelectorAll('[data-testid="panel-body"]')
      .forEach((el) => el.remove());
  });

  it("mounts the visual zone into the panel on the morning paper", async () => {
    const { panelBody } = renderWithPanel(true, "morning");
    await waitFor(() =>
      expect(panelBody.textContent).toContain("YOU, UP TO YESTERDAY"),
    );
    // The tray keeps its place above it — two panels in one well, not a swap.
    expect(panelBody.textContent).toContain("Today's Todo");
  });

  it("keeps it out of the paper's own column", async () => {
    const { panelBody, view } = renderWithPanel(true, "morning");
    await waitFor(() =>
      expect(panelBody.textContent).toContain("YOU, UP TO YESTERDAY"),
    );
    expect(view.container.textContent).not.toContain("YOU, UP TO YESTERDAY");
    // The paper is otherwise untouched.
    expect(screen.getByText("LIFE EDITOR BRIEFING")).toBeTruthy();
  });

  it("reaches the panel below 768px too (no width gate)", async () => {
    const { panelBody } = renderWithPanel(false, "morning");
    await waitFor(() =>
      expect(panelBody.textContent).toContain("YOU, UP TO YESTERDAY"),
    );
  });

  it("stays off the evening paper", async () => {
    const { panelBody } = renderWithPanel(true, "evening");
    // The tray IS mounted on 夕刊, so waiting on it proves the panel filled
    // before we assert the visual zone's absence.
    await waitFor(() =>
      expect(panelBody.textContent).toContain("Today's Todo"),
    );
    expect(panelBody.textContent).not.toContain("YOU, UP TO YESTERDAY");
  });
});
