import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import {
  SyncContext,
  SYNC_DOMAINS,
  ToastContext,
  type DataService,
  type ScheduleItem,
  type SyncDomain,
  type WebSyncContextValue,
} from "@life-editor/shared";
import { stubDataService } from "./helpers";
import { ScheduleReminderBridge } from "../src/ScheduleReminderBridge";
import { __resetReminderLedger } from "../src/schedule/reminderLedger";

/*
 * ScheduleReminderBridge (#1374) — the app-wide sweep.
 *
 * The pure decision (which reminders are due, and the dedupe key) is pinned in
 * shared/tests/reminderSchedule.test.ts. What is only observable HERE is the
 * wiring, and every case below is a DoD clause that fails silently:
 *
 *   - one toast per reminder, and none on the next tick;
 *   - none when a Realtime bump refetches the SAME rows (the ledger has to
 *     outlive the refetch, not the render);
 *   - the OS notification when the desktop bridge is there, the toast alone
 *     when it is absent (Web / Capacitor) or rejects (permission denied);
 *   - nothing at all when the master switch is off.
 *
 * jsdom's missing layout is irrelevant: no coordinate is read.
 */

const TODAY = "2026-08-12";
/** 09:50 local — the due instant for a 10:00 event with a 10-minute lead. */
const DUE_AT = new Date(2026, 7, 12, 9, 50, 0, 0);

function event(over: Partial<ScheduleItem> & { id: string }): ScheduleItem {
  return {
    date: TODAY,
    title: over.id,
    startTime: "10:00",
    endTime: "11:00",
    completed: false,
    completedAt: null,
    routineId: null,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    reminderOffset: 10,
    ...over,
  };
}

function zeroVersions(): Record<SyncDomain, number> {
  return Object.fromEntries(SYNC_DOMAINS.map((d) => [d, 0])) as Record<
    SyncDomain,
    number
  >;
}

function setup(rows: ScheduleItem[], over: Partial<DataService> = {}) {
  const showToast = vi.fn();
  const ds = stubDataService({
    fetchScheduleItemsByDateRange: vi.fn().mockResolvedValue(rows),
    ...over,
  });
  const versions = zeroVersions();
  const sync: WebSyncContextValue = {
    syncVersion: 0,
    domainVersions: versions,
    triggerSync: async () => undefined,
  };
  const tree = (v: Record<SyncDomain, number>) => (
    <SyncContext.Provider value={{ ...sync, domainVersions: v }}>
      <ToastContext.Provider value={{ showToast }}>
        <ScheduleReminderBridge dataService={ds} />
      </ToastContext.Provider>
    </SyncContext.Provider>
  );
  const view = render(tree(versions));
  /** Bump the schedule domain the way SyncProvider does. */
  const bumpSchedule = () => {
    versions.schedule += 1;
    view.rerender(tree({ ...versions }));
  };
  return { showToast, ds, bumpSchedule };
}

/** The desktop shell's bridge, as `window.desktop`. */
function installDesktop(notify: (args: unknown) => Promise<boolean>) {
  (window as unknown as { desktop?: unknown }).desktop = { notify };
}

beforeEach(() => {
  __resetReminderLedger();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(DUE_AT);
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  delete (window as unknown as { desktop?: unknown }).desktop;
});

describe("ScheduleReminderBridge", () => {
  it("raises exactly one toast for a due event", async () => {
    const { showToast } = setup([event({ id: "e-1", title: "Standup" })]);
    await waitFor(() => expect(showToast).toHaveBeenCalledTimes(1));
    expect(showToast.mock.calls[0][0]).toBe("info");
    expect(String(showToast.mock.calls[0][1])).toContain("Standup");
  });

  it("says nothing again when the sync bump refetches the same rows", async () => {
    const { showToast, bumpSchedule } = setup([event({ id: "e-1" })]);
    await waitFor(() => expect(showToast).toHaveBeenCalledTimes(1));

    // The ledger is keyed on the row and its due INSTANT, so a re-fetch of
    // the identical row is a no-op however many times it arrives.
    act(() => bumpSchedule());
    await waitFor(() => expect(showToast).toHaveBeenCalledTimes(1));
  });

  it("raises nothing for an event whose reminder is not due yet", async () => {
    vi.setSystemTime(new Date(2026, 7, 12, 9, 40, 0, 0));
    const { showToast, ds } = setup([event({ id: "e-1" })]);
    await waitFor(() =>
      expect(ds.fetchScheduleItemsByDateRange).toHaveBeenCalled(),
    );
    expect(showToast).not.toHaveBeenCalled();
  });

  it("also raises the OS notification when the desktop bridge is there", async () => {
    const notify = vi.fn().mockResolvedValue(true);
    installDesktop(notify);
    const { showToast } = setup([event({ id: "e-1", title: "Standup" })]);
    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    expect(notify.mock.calls[0][0]).toMatchObject({ title: "Standup" });
    expect(showToast).toHaveBeenCalledTimes(1);
  });

  it("degrades to the toast alone off Electron (Web / Capacitor)", async () => {
    // No window.desktop at all — the Mobile / Web clause. Nothing throws,
    // and no permission is ever asked for because the renderer never touches
    // window.Notification.
    const { showToast } = setup([event({ id: "e-1" })]);
    await waitFor(() => expect(showToast).toHaveBeenCalledTimes(1));
  });

  it("degrades to the toast alone when the OS refuses", async () => {
    const notify = vi.fn().mockRejectedValue(new Error("denied"));
    installDesktop(notify);
    const { showToast } = setup([event({ id: "e-1" })]);
    await waitFor(() => expect(showToast).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
  });

  it("stays silent while the master switch is off", async () => {
    localStorage.setItem("life-editor-reminders-enabled", "false");
    const { showToast, ds } = setup([event({ id: "e-1" })]);
    await waitFor(() =>
      expect(ds.fetchScheduleItemsByDateRange).toHaveBeenCalled(),
    );
    expect(showToast).not.toHaveBeenCalled();
  });

  it("survives a failed refetch without throwing", async () => {
    const { showToast } = setup([], {
      fetchScheduleItemsByDateRange: vi.fn().mockRejectedValue(new Error("x")),
    });
    await Promise.resolve();
    expect(showToast).not.toHaveBeenCalled();
  });
});
