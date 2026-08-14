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
 * Briefing's detail panel below 768px (#609).
 *
 * The tray used to be mounted only on the wide branch, and the reasoning was
 * sound at the time: narrow had no way to OPEN the drawer, so a tray there
 * would have been UI nobody could reach. #609 supplies the opener (a
 * hamburger at the left of the narrow 朝刊/夕刊 band, in MainScreen), which
 * makes the old guard the thing that now hides a reachable panel.
 *
 * Asserting through the portal target rather than a width prop: the guard was
 * a `isWide ? … : null` around the portal, so the only honest check is that
 * the tray's content really lands in the panel body at narrow width.
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

function renderWithPanel(wide: boolean) {
  setWidth(wide);
  const panelBody = document.createElement("div");
  panelBody.setAttribute("data-testid", "panel-body");
  document.body.appendChild(panelBody);
  const sidebar: RightSidebarContextValue = {
    isOpen: true,
    open: () => undefined,
    close: () => undefined,
    // #753: the guarded close. Nothing here holds a draft, so it behaves as
    // the plain one.
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
    <SyncContext.Provider value={value}>
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

describe("Briefing detail panel across widths (#609)", () => {
  beforeEach(() => setWidth(true));
  afterEach(() => {
    document
      .querySelectorAll('[data-testid="panel-body"]')
      .forEach((el) => el.remove());
  });

  it("mounts the Todo tray into the panel below 768px", async () => {
    const panelBody = renderWithPanel(false);
    await waitFor(() =>
      expect(panelBody.textContent).toContain("Today's Todo"),
    );
    // The paper itself is still there — the tray is an addition, not a swap.
    expect(screen.getByText("LIFE EDITOR BRIEFING")).toBeTruthy();
  });

  it("still mounts it on the wide layout (no regression)", async () => {
    const panelBody = renderWithPanel(true);
    await waitFor(() =>
      expect(panelBody.textContent).toContain("Today's Todo"),
    );
  });
});
