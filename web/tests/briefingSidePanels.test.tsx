import { afterEach, describe, it, expect, vi } from "vitest";
import { useEffect } from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
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
  type WebSyncContextValue,
} from "@life-editor/shared";
import { stubDataService } from "./helpers";
import { createDetailPanel } from "./helpers/detailPanel";
import { BriefingScreen } from "../src/briefing/BriefingScreen";

/*
 * 夕刊's「残りの Todo」and「今後の予定」in the detail panel (#2285) — the
 * host half. The view's own suite (shared/tests/briefingSidePanels) covers the
 * rows and their open / close; what only the host answers is where the panel
 * goes and what each action asks for: Schedule on the ROW's day, and the
 * in-place editor on that day for「編集」and「繰り返しを見る」alike.
 */

const TODAY = todayDateKey();
const TOMORROW = (() => {
  const d = new Date(`${TODAY}T12:00:00`);
  d.setDate(d.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();

function scheduleItem(over: Partial<ScheduleItem> & { id: string }) {
  return {
    date: TOMORROW,
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

const DENTIST = scheduleItem({ id: "s-dentist", title: "Dentist" });
const RUN = scheduleItem({
  id: "s-run",
  title: "Morning run",
  startTime: "07:00",
  endTime: "07:30",
  routineId: "r-run",
});

function makeDS(): DataService {
  return stubDataService({
    fetchScheduleItemsByDate: vi
      .fn()
      .mockImplementation((date: string) =>
        Promise.resolve(date === TOMORROW ? [DENTIST, RUN] : []),
      ),
    fetchTodoTree: vi.fn().mockResolvedValue([]),
    fetchTimerSessions: vi.fn().mockResolvedValue([]),
    getDailyByDateUnified: vi.fn().mockResolvedValue(null),
    listNotesUnified: vi.fn().mockResolvedValue([]),
    listAllTagConnections: vi.fn().mockResolvedValue([]),
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

let lastRequest: ItemPanelRequest | null = null;
function RequestProbe() {
  const { request } = useItemPanelContext();
  useEffect(() => {
    lastRequest = request;
  });
  return null;
}

let panel: ReturnType<typeof createDetailPanel> | null = null;
afterEach(() => {
  panel?.remove();
  panel = null;
});

function renderEvening(onNavigateToItem = vi.fn()) {
  lastRequest = null;
  panel = createDetailPanel();
  const view = render(
    <SyncContext.Provider value={SYNC}>
      {panel.wrap(
        <ItemPanelProvider>
          <BriefingScreen
            dataService={makeDS()}
            onNavigate={vi.fn()}
            onNavigateToItem={onNavigateToItem}
            tab="evening"
          />
          <RequestProbe />
        </ItemPanelProvider>,
      )}
    </SyncContext.Provider>,
  );
  return { view, panelBody: panel.panelBody, onNavigateToItem };
}

const upcoming = () =>
  within(screen.getByRole("region", { name: "COMING UP" }));

async function openRow(title: string) {
  const row = await waitFor(() =>
    upcoming().getByRole("button", { name: new RegExp(title) }),
  );
  fireEvent.click(row);
  return within(screen.getByRole("group", { name: title }));
}

describe("夕刊's panel blocks (#2285)", () => {
  it("puts both blocks in the panel and none of them on the paper", async () => {
    const { view, panelBody } = renderEvening();
    await waitFor(() => expect(panelBody.textContent).toContain("Dentist"));
    expect(panelBody.textContent).toContain("REMAINING TODOS");
    expect(panelBody.textContent).toContain("COMING UP");
    expect(view.container.textContent).not.toContain("REMAINING TODOS");
    expect(view.container.textContent).not.toContain("COMING UP");
  });

  it("goes to Schedule on the row's own day, with the row selected", async () => {
    const { onNavigateToItem } = renderEvening();
    const actions = await openRow("Dentist");
    fireEvent.click(
      actions.getByRole("button", { name: "Go to this day's schedule" }),
    );
    expect(onNavigateToItem).toHaveBeenCalledExactlyOnceWith({
      id: "s-dentist",
      role: "event",
      date: TOMORROW,
    });
  });

  it("opens an event's editor in place, on its day", async () => {
    const { onNavigateToItem } = renderEvening();
    const actions = await openRow("Dentist");
    fireEvent.click(actions.getByRole("button", { name: "Edit" }));
    await waitFor(() =>
      expect(lastRequest).toMatchObject({
        mode: "edit",
        target: { role: "event", id: "s-dentist", date: TOMORROW },
      }),
    );
    expect(onNavigateToItem).not.toHaveBeenCalled();
  });

  it("opens a routine occurrence's editor for its repeat", async () => {
    renderEvening();
    const actions = await openRow("Morning run");
    expect(actions.queryByRole("button", { name: "Edit" })).toBeNull();
    fireEvent.click(actions.getByRole("button", { name: "See the repeat" }));
    await waitFor(() =>
      expect(lastRequest).toMatchObject({
        mode: "edit",
        target: { role: "event", id: "s-run", date: TOMORROW },
      }),
    );
  });
});
