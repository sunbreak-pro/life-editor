import { afterEach, describe, it, expect, vi } from "vitest";
import { useEffect } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  ItemPanelProvider,
  SyncContext,
  SYNC_DOMAINS,
  todayDateKey,
  useItemPanelContext,
  type DataService,
  type ItemPanelRequest,
  type ScheduleItem,
  type SyncDomain,
  type TodoNode,
  type WebSyncContextValue,
  type WikiTagAssignmentUnified,
  type WikiTagUnified,
} from "@life-editor/shared";
import { stubDataService } from "./helpers";
import { createDetailPanel } from "./helpers/detailPanel";
import { BriefingScreen } from "../src/briefing/BriefingScreen";

/*
 * Pressing an item on the morning paper (#2223).
 *
 * A row's title — event or todo — and an all-day chip open Schedule's own
 * editor IN PLACE, through the entry point #2218 built, instead of carrying
 * the reader off to Schedule. The panel itself is ItemPanelHost's (its suite
 * covers the drawing and the「予定の画面で開く」button); what only this host
 * can answer is the REQUEST: the row's own id, the right role, today's date
 * for an event, and the open-in-Schedule hand-off that makes the panel offer
 * that button at all.
 *
 * The carryover rows keep their「編集」jump (#1824): they are past days'
 * todos showing through, and #2223 leaves that block as it was. Since #2285
 * the block is in the detail panel, so every render here mounts one.
 */

const TODAY = todayDateKey();
const YESTERDAY = (() => {
  const d = new Date(`${TODAY}T12:00:00`);
  d.setDate(d.getDate() - 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();

function scheduleItem(over: Partial<ScheduleItem> & { id: string }) {
  return {
    date: TODAY,
    title: "Manual event",
    startTime: "09:00",
    endTime: "10:00",
    completed: false,
    completedAt: null,
    routineId: null,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    ...over,
  } as ScheduleItem;
}

function todoNode(over: Partial<TodoNode> & { id: string }) {
  return {
    type: "task",
    title: "Write report",
    status: "NOT_STARTED",
    scheduledAt: `${TODAY}T00:00:00`,
    isAllDay: true,
    parentId: null,
    order: 0,
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    ...over,
  } as TodoNode;
}

const EVENT = scheduleItem({ id: "s-manual", title: "Dentist" });
const ALL_DAY = scheduleItem({
  id: "s-allday",
  title: "Holiday",
  startTime: "00:00",
  endTime: "23:59",
  isAllDay: true,
});
const TODO = todoNode({ id: "t1", title: "Write report" });
const OLD = todoNode({
  id: "t-old",
  title: "Old todo",
  scheduledAt: `${YESTERDAY}T00:00:00`,
});

function tag(id: string, name: string): WikiTagUnified {
  return {
    id,
    name,
    color: "#3b82f6",
    icon: null,
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    isDeleted: false,
    deletedAt: null,
  } as WikiTagUnified;
}
function assign(itemId: string, tagId: string): WikiTagAssignmentUnified {
  return {
    id: `${itemId}:${tagId}`,
    itemId,
    tagId,
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    isDisplayColor: false,
    isDeleted: false,
    deletedAt: null,
  } as WikiTagAssignmentUnified;
}

function makeDS(): DataService {
  return stubDataService({
    fetchScheduleItemsByDate: vi
      .fn()
      .mockImplementation((date: string) =>
        Promise.resolve(date === TODAY ? [EVENT, ALL_DAY] : []),
      ),
    fetchTodoTree: vi.fn().mockResolvedValue([TODO, OLD]),
    fetchTimerSessions: vi.fn().mockResolvedValue([]),
    getDailyByDateUnified: vi.fn().mockResolvedValue(null),
    listNotesUnified: vi.fn().mockResolvedValue([]),
    listAllTagConnections: vi.fn().mockResolvedValue([]),
    listAllWikiTagsUnified: vi
      .fn()
      .mockResolvedValue([tag("tag-work", "Work"), tag("tag-home", "Home")]),
    listAllTagAssignments: vi
      .fn()
      .mockResolvedValue([
        assign("s-manual", "tag-work"),
        assign("t1", "tag-home"),
      ]),
  });
}

const SYNC: WebSyncContextValue = {
  syncVersion: 0,
  domainVersions: Object.fromEntries(SYNC_DOMAINS.map((d) => [d, 0])) as Record<
    SyncDomain,
    number
  >,
  triggerSync: async () => undefined,
};

/** Reads the open panel request off the context, as ItemPanelHost would. */
let lastRequest: ItemPanelRequest | null = null;
function RequestProbe() {
  const { request } = useItemPanelContext();
  useEffect(() => {
    lastRequest = request;
  });
  return null;
}

const panels: ReturnType<typeof createDetailPanel>[] = [];
afterEach(() => {
  panels.splice(0).forEach((panel) => panel.remove());
});

function renderScreen(
  over: {
    onNavigate?: () => void;
    onNavigateToItem?: (t: { id: string; role: string; date?: string }) => void;
  } = {},
  withPanel = true,
) {
  lastRequest = null;
  const onNavigate = over.onNavigate ?? vi.fn();
  const panel = createDetailPanel();
  panels.push(panel);
  const screenEl = (
    <BriefingScreen
      dataService={makeDS()}
      onNavigate={onNavigate}
      onNavigateToItem={over.onNavigateToItem}
      tab="morning"
    />
  );
  render(
    <SyncContext.Provider value={SYNC}>
      {panel.wrap(
        withPanel ? (
          <ItemPanelProvider>
            {screenEl}
            <RequestProbe />
          </ItemPanelProvider>
        ) : (
          screenEl
        ),
      )}
    </SyncContext.Provider>,
  );
  return { onNavigate, panelBody: panel.panelBody };
}

describe("Pressing an item opens its editor in place (#2223)", () => {
  it("opens an event's editor on today, without leaving the paper", async () => {
    const onNavigateToItem = vi.fn();
    const { onNavigate } = renderScreen({ onNavigateToItem });
    fireEvent.click(await screen.findByRole("button", { name: "Dentist" }));
    await waitFor(() => expect(lastRequest).not.toBeNull());
    expect(lastRequest).toMatchObject({
      mode: "edit",
      target: { role: "event", id: "s-manual", date: TODAY },
    });
    expect(onNavigate).not.toHaveBeenCalled();
    expect(onNavigateToItem).not.toHaveBeenCalled();
  });

  it("opens a todo's editor from its title, and does not complete it", async () => {
    const { onNavigate } = renderScreen({ onNavigateToItem: vi.fn() });
    fireEvent.click(
      await screen.findByRole("button", { name: "Write report" }),
    );
    await waitFor(() => expect(lastRequest).not.toBeNull());
    expect(lastRequest).toMatchObject({
      mode: "edit",
      target: { role: "task", id: "t1" },
    });
    expect(onNavigate).not.toHaveBeenCalled();
    // The checkbox is still the one control that completes it.
    expect(
      screen
        .getByRole("checkbox", { name: /Write report/ })
        .getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("opens an all-day chip's editor the same way", async () => {
    renderScreen({ onNavigateToItem: vi.fn() });
    fireEvent.click(await screen.findByRole("button", { name: "Holiday" }));
    await waitFor(() =>
      expect(lastRequest).toMatchObject({
        mode: "edit",
        target: { role: "event", id: "s-allday", date: TODAY },
      }),
    );
  });

  it("offers「予定の画面で開く」, which goes to the item and its day", async () => {
    const onNavigateToItem = vi.fn();
    renderScreen({ onNavigateToItem });
    fireEvent.click(await screen.findByRole("button", { name: "Dentist" }));
    await waitFor(() => expect(lastRequest).not.toBeNull());
    const open = lastRequest!.options.onOpenInSchedule;
    // Given at all is what makes ItemPanelHost draw the button (#2218).
    expect(open).toBeTypeOf("function");
    open!({ id: "s-manual", role: "event", date: TODAY });
    expect(onNavigateToItem).toHaveBeenCalledExactlyOnceWith({
      id: "s-manual",
      role: "event",
      date: TODAY,
    });
    // A todo set for no day travels without one.
    open!({ id: "t1", role: "task", date: null });
    expect(onNavigateToItem).toHaveBeenLastCalledWith({
      id: "t1",
      role: "task",
    });
  });

  it("falls back to opening the item where it lives without the panel", async () => {
    const onNavigateToItem = vi.fn();
    renderScreen({ onNavigateToItem }, false);
    fireEvent.click(await screen.findByRole("button", { name: "Dentist" }));
    expect(onNavigateToItem).toHaveBeenCalledExactlyOnceWith({
      id: "s-manual",
      role: "event",
      date: TODAY,
    });
  });

  it("prints each row's tags, read beside the paper", async () => {
    renderScreen();
    await screen.findByText("Work");
    const eventCell = document.querySelector(
      '[data-briefing-event="s-manual"]',
    )!;
    expect(eventCell.textContent).toContain("Work");
    const todoCell = document.querySelector('[data-briefing-todo="t1"]')!;
    expect(todoCell.textContent).toContain("Home");
  });
});

describe("The carryover row's「編集」still opens the todo itself (#1824)", () => {
  it("opens the todo where it lives", async () => {
    const onNavigateToItem = vi.fn();
    const { panelBody } = renderScreen({ onNavigateToItem });
    await screen.findByText("Old todo");
    // In the detail panel since #2285, not on the paper.
    expect(panelBody.textContent).toContain("Old todo");
    fireEvent.click(
      screen.getByRole("button", { name: "Edit: Open in Todos" }),
    );
    expect(onNavigateToItem).toHaveBeenCalledExactlyOnceWith({
      id: "t-old",
      role: "task",
    });
    expect(lastRequest).toBeNull();
  });

  it("still lands on the section where the host wires no item intent", async () => {
    const onNavigate = vi.fn();
    renderScreen({ onNavigate });
    await screen.findByText("Old todo");
    fireEvent.click(
      screen.getByRole("button", { name: "Edit: Open in Todos" }),
    );
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith({ section: "schedule" });
  });
});
