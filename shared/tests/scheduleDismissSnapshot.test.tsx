import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useState } from "react";
import { useScheduleItemsCRUD } from "../src/hooks/useScheduleItemsCRUD";
import type { ScheduleItemsMirrorAccess } from "../src/hooks/useScheduleItemsViewMirror";
import type { ScheduleItem } from "../src/types/schedule";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * #1642 P8 (K-03 / C-03) — skipping a day, and bringing it back.
 *
 * Both writes need the row's snapshot for their undo: the host drops a skipped
 * row from its range store entirely, so the undo puts the snapshot back rather
 * than patching a field, and the snapshot is also what tells a repeat's
 * occurrence (ask first) from a one-off. They used to push a command without
 * one, so the undo could neither repaint the row nor ask. Now a row neither
 * store holds is still written, and simply not recorded.
 *
 * `undismiss` also resolves once its write has settled (C-03), so a caller can
 * re-read after it instead of racing it.
 */

const TODAY = "2026-09-28";

const item = (id: string, over: Partial<ScheduleItem> = {}): ScheduleItem => ({
  id,
  date: TODAY,
  title: id,
  startTime: "09:00",
  endTime: "10:00",
  completed: false,
  completedAt: null,
  routineId: null,
  templateId: null,
  memo: null,
  noteId: null,
  content: null,
  isDeleted: false,
  deletedAt: null,
  isDismissed: false,
  isAllDay: false,
  createdAt: TODAY,
  updatedAt: TODAY,
  ...over,
});

function setup(rows: ScheduleItem[]) {
  let settleUndismiss: () => void = () => {};
  const spies = {
    dismissScheduleItem: vi.fn(async () => {}),
    undismissScheduleItem: vi.fn(
      () =>
        new Promise<void>((resolve) => {
          settleUndismiss = resolve;
        }),
    ),
  };
  const ds = stubDataService(spies);
  const push = vi.fn();
  const mirror = {
    registerViewMirror: vi.fn(() => () => {}),
    findItem: (id: string) => rows.find((r) => r.id === id),
    upsert: vi.fn(),
    patch: vi.fn(),
    remove: vi.fn(),
    restore: vi.fn(),
  } satisfies ScheduleItemsMirrorAccess;
  const view = renderHook(() => {
    const [, setItems] = useState(rows);
    const [, setDeletedItems] = useState<ScheduleItem[]>([]);
    return useScheduleItemsCRUD({
      ds,
      push,
      date: TODAY,
      dateRef: { current: TODAY },
      setItems,
      setDeletedItems,
      mirror,
    });
  });
  return {
    ...spies,
    push,
    api: () => view.result.current,
    settleUndismiss: () => settleUndismiss(),
  };
}

describe("skipping a day without its snapshot (#1642 P8, K-03)", () => {
  it("still writes the skip, and records nothing", () => {
    const h = setup([]);
    act(() => h.api().dismiss("s-unknown"));
    expect(h.dismissScheduleItem).toHaveBeenCalledWith("s-unknown");
    expect(h.push).not.toHaveBeenCalled();
  });

  it("still writes the un-skip, and records nothing", () => {
    const h = setup([]);
    act(() => void h.api().undismiss("s-unknown"));
    expect(h.undismissScheduleItem).toHaveBeenCalledWith("s-unknown");
    expect(h.push).not.toHaveBeenCalled();
  });

  it("records a repeat's occurrence it can see, and asks before undoing it", () => {
    const h = setup([item("occ-1", { routineId: "routine-1" })]);
    act(() => h.api().dismiss("occ-1"));
    expect(h.push).toHaveBeenCalledTimes(1);
    expect(h.push.mock.calls[0][1]).toMatchObject({
      label: "dismissScheduleItem",
      confirm: { kind: "repeat", scope: "this" },
    });
  });
});

describe("un-skipping resolves once the write has settled (#1642 P8, C-03)", () => {
  it("waits for the write", async () => {
    const h = setup([item("s-1", { isDismissed: true })]);
    let settled = false;
    act(() => {
      void h
        .api()
        .undismiss("s-1")
        .then(() => {
          settled = true;
        });
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    await act(async () => h.settleUndismiss());
    expect(settled).toBe(true);
  });
});
