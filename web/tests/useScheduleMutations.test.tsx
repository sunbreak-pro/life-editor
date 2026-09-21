import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { Dispatch, SetStateAction } from "react";
import { todoChipId } from "@life-editor/shared";
import type { ScheduleItem } from "@life-editor/shared";
import {
  useScheduleMutations,
  type UseScheduleMutationsArgs,
} from "../src/schedule/useScheduleMutations";

/*
 * W0 of the Schedule refactor (#1642): the nine handlers CalendarTab writes
 * through had no direct test at all, and every later work unit moves code that
 * runs underneath them. This file is the regression net the rest of the plan
 * leans on, so it pins BEHAVIOUR ONLY — nothing here asks for a change.
 *
 * Driven through renderHook rather than the screen, which is the documented
 * exception rather than the default (D-20260812-refactor-2): the only host is
 * CalendarTab, and it needs a Provider stack plus a real grid layout that
 * jsdom cannot give it. The same reasoning put itemConversion.test.tsx on the
 * hook next door.
 *
 * What each case pins is a decision, not a call:
 *
 *   - the #568 order invariant (provider write FIRST, local patch second) —
 *     the undo snapshot is taken by the provider, so a swapped pair makes
 *     Ctrl+Z re-apply the edit instead of reversing it;
 *   - WHO answers: a todo chip goes to the host's TodoNode write, a
 *     routine-derived row goes to the scope dialog, everything else is written
 *     here. Three answers to one gesture, decided by two `if`s that are easy
 *     to reorder;
 *   - WHICH gestures ask about the series and which do not (#279 / #469 /
 *     #628) — a cross-day drag and an all-day drop write without asking, and
 *     the plan's §1-E fixes that arrangement as the spec (D-20260916-sched-2);
 *   - the two-store lookup: `rangeItems` first, `contextItems` as the fallback,
 *     so a row that is only in today's provider list still resolves.
 *
 * The stores are plain closures instead of React state: the hook only reads
 * `rangeItems` / `contextItems` as props, and holding the written-through
 * values outside lets a case assert what the setter was handed (the updater
 * form included) without a rerender dance.
 */

const TODAY = "2026-09-16";
const NEW_ID = "s-new";
const COPY_SUFFIX = " のコピー";

function item(over?: Partial<ScheduleItem>): ScheduleItem {
  return {
    id: "s-1",
    date: TODAY,
    title: "Dentist",
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
  } as ScheduleItem;
}

function setup(over?: {
  rangeItems?: ScheduleItem[];
  contextItems?: ScheduleItem[];
  selectedId?: string | null;
}) {
  // Every write appends here, so a case can assert the ORDER of a pair and not
  // just that both happened (#568).
  const order: string[] = [];
  let rows: ScheduleItem[] = over?.rangeItems ?? [];
  let selectedId: string | null = over?.selectedId ?? null;
  let lastCreateOpts:
    | {
        isAllDay?: boolean;
        content?: string;
        noteId?: string;
        memo?: string;
        reminderOffset?: number | null;
        onSaved?: (saved: ScheduleItem | null) => void;
      }
    | undefined;

  const createScheduleItem = vi.fn(
    (
      date: string,
      title: string,
      startTime: string,
      endTime: string,
      opts?: {
        isAllDay?: boolean;
        content?: string;
        noteId?: string;
        memo?: string;
        reminderOffset?: number | null;
        onSaved?: (saved: ScheduleItem | null) => void;
      },
    ): string => {
      order.push(`create:${date}/${title}/${startTime}-${endTime}`);
      // Held, not discarded (#1642 W16): the duplicate cases drive `onSaved`
      // to play back a refused INSERT, which is the only way to reach the
      // rollback from here.
      lastCreateOpts = opts;
      return NEW_ID;
    },
  );
  const updateScheduleItem = vi.fn(
    (id: string, updates: Partial<ScheduleItem>) => {
      order.push(`provider:${id}:${Object.keys(updates).sort().join("+")}`);
    },
  );
  const patchRange = vi.fn((id: string, patch: Partial<ScheduleItem>) => {
    order.push(`range:${id}:${Object.keys(patch).sort().join("+")}`);
  });
  const dismiss = vi.fn((id: string) => {
    order.push(`dismiss:${id}`);
  });
  const deleteScheduleItem = vi.fn((id: string) => {
    order.push(`delete:${id}`);
  });
  const onSelectItem = vi.fn((id: string) => {
    order.push(`select:${id}`);
  });
  const onMoveTodoChip = vi.fn(
    (chipId: string, dateISO: string, startISO: string, endISO: string) => {
      order.push(`chipMove:${chipId}/${dateISO}/${startISO}-${endISO}`);
    },
  );
  const onResizeTodoChip = vi.fn((chipId: string, endISO: string) => {
    order.push(`chipResize:${chipId}/${endISO}`);
  });
  const onDropTodoChipAllDay = vi.fn((chipId: string, dateISO: string) => {
    order.push(`chipAllDay:${chipId}/${dateISO}`);
  });
  const onDuplicateFailed = vi.fn(() => {
    order.push("duplicateFailed");
  });

  const setRangeItems: Dispatch<SetStateAction<ScheduleItem[]>> = vi.fn(
    (next: SetStateAction<ScheduleItem[]>) => {
      rows = typeof next === "function" ? next(rows) : next;
    },
  );
  const setSelectedId: Dispatch<SetStateAction<string | null>> = vi.fn(
    (next: SetStateAction<string | null>) => {
      selectedId = typeof next === "function" ? next(selectedId) : next;
    },
  );

  // The repeat layer's own injections. None of the nine handlers reaches them
  // (they end at `requestScope`), so they only have to exist and be typed.
  const args: UseScheduleMutationsArgs = {
    rangeItems: over?.rangeItems ?? [],
    contextItems: over?.contextItems ?? [],
    setRangeItems,
    patchRange,
    reload: vi.fn(),
    rangeStart: "2026-09-13",
    rangeEnd: "2026-09-19",
    today: TODAY,
    selected: null,
    setSelectedId,
    onSelectItem,
    createScheduleItem,
    updateScheduleItem,
    dismiss,
    deleteScheduleItem,
    routines: [],
    convertEventToRoutine: vi.fn(async () => "r-1"),
    updateRoutine: vi.fn(async () => true),
    deleteRoutine: vi.fn(async () => ({
      deletedScheduleItemIds: [] as string[],
      landed: true,
    })),
    detachRoutine: vi.fn(async () => ({
      deletedScheduleItemIds: [] as string[],
    })),
    updateFutureOccurrences: vi.fn(async () => 0),
    ensureRoutineItemsForDateRange: vi.fn(async () => true),
    reconcileRoutineScheduleItems: vi.fn(async () => {}),
    onMoveTodoChip,
    onResizeTodoChip,
    onDropTodoChipAllDay,
    onRepeatConvertFailed: vi.fn(),
    onDuplicateFailed,
    copySuffix: COPY_SUFFIX,
  };

  const view = renderHook(() => useScheduleMutations(args));
  return {
    view,
    order,
    rows: () => rows,
    selectedId: () => selectedId,
    createScheduleItem,
    updateScheduleItem,
    patchRange,
    dismiss,
    deleteScheduleItem,
    onSelectItem,
    onMoveTodoChip,
    onResizeTodoChip,
    onDropTodoChipAllDay,
    onDuplicateFailed,
    createOpts: () => lastCreateOpts,
  };
}

describe("handleCreate", () => {
  it("issues the provider create from the slot and mirrors an optimistic row", () => {
    const h = setup();
    const onSaved = vi.fn();
    let id = "";
    act(() => {
      id = h.view.result.current.handleCreate(
        { date: "2026-09-18", start: "11:00", end: "12:00", isAllDay: true },
        "Lunch",
        onSaved,
      );
    });
    // The returned id names the OPTIMISTIC row — the #376 note link writes an
    // FK to it, so it has to be the provider's answer and not a local guess.
    expect(id).toBe(NEW_ID);
    expect(h.createScheduleItem).toHaveBeenCalledWith(
      "2026-09-18",
      "Lunch",
      "11:00",
      "12:00",
      { isAllDay: true, onSaved },
    );
    // #940: the slot owns the day and the all-day switch, so both travel into
    // the mirrored row. `makeOptimisticScheduleItem` always says timed.
    expect(h.rows()).toHaveLength(1);
    expect(h.rows()[0]).toMatchObject({
      id: NEW_ID,
      date: "2026-09-18",
      title: "Lunch",
      startTime: "11:00",
      endTime: "12:00",
      isAllDay: true,
    });
  });
});

describe("handleUpdate", () => {
  it("writes provider first and patches the range second (#568)", () => {
    const h = setup({ rangeItems: [item()] });
    act(() => h.view.result.current.handleUpdate("s-1", { title: "Cleaning" }));
    expect(h.order).toEqual(["provider:s-1:title", "range:s-1:title"]);
    expect(h.view.result.current.scopeRequest).toBeNull();
  });

  it("parks a routine occurrence's series-touching edit in the scope dialog", () => {
    const h = setup({ rangeItems: [item({ routineId: "r-1" })] });
    act(() =>
      h.view.result.current.handleUpdate("s-1", {
        title: "Cleaning",
        date: "2026-09-20",
      }),
    );
    // Nothing is written until the user answers (#279), and the parked item
    // carries the PATCHED day — "this and later" anchors on the day the row is
    // moving TO (#628).
    expect(h.order).toEqual([]);
    expect(h.view.result.current.scopeRequest).toMatchObject({
      mode: "edit",
      item: { id: "s-1", date: "2026-09-20" },
      patch: { title: "Cleaning", date: "2026-09-20" },
    });
  });

  it("writes a routine occurrence straight through when the patch holds nothing the template does", () => {
    const h = setup({ rangeItems: [item({ routineId: "r-1" })] });
    act(() =>
      h.view.result.current.handleUpdate("s-1", { date: "2026-09-20" }),
    );
    // The day has nowhere to propagate to, so the question is not asked
    // (§1-E E-02, fixed as the spec by D-20260916-sched-2).
    expect(h.order).toEqual(["provider:s-1:date", "range:s-1:date"]);
    expect(h.view.result.current.scopeRequest).toBeNull();
  });

  it("falls back to the provider's own list when the row is not in the visible range", () => {
    const h = setup({
      rangeItems: [],
      contextItems: [item({ id: "s-9", routineId: "r-1" })],
    });
    act(() => h.view.result.current.handleUpdate("s-9", { title: "Later" }));
    expect(h.view.result.current.scopeRequest).toMatchObject({
      mode: "edit",
      item: { id: "s-9" },
    });
  });
});

describe("handleMoveItem", () => {
  it("routes a todo chip to the host's TodoNode write and touches no schedule row", () => {
    const h = setup();
    const chip = todoChipId("task-1");
    act(() =>
      h.view.result.current.handleMoveItem(
        chip,
        "2026-09-18",
        "13:00",
        "14:00",
      ),
    );
    expect(h.onMoveTodoChip).toHaveBeenCalledWith(
      chip,
      "2026-09-18",
      "13:00",
      "14:00",
    );
    expect(h.updateScheduleItem).not.toHaveBeenCalled();
    expect(h.patchRange).not.toHaveBeenCalled();
  });

  it("asks about the series for a same-day drag and sends only the times", () => {
    const h = setup({ rangeItems: [item({ routineId: "r-1" })] });
    act(() =>
      h.view.result.current.handleMoveItem("s-1", TODAY, "11:00", "12:00"),
    );
    expect(h.view.result.current.scopeRequest).toMatchObject({
      mode: "edit",
      patch: { startTime: "11:00", endTime: "12:00" },
    });
    expect(h.order).toEqual([]);
  });

  it("writes a cross-day drag of the same occurrence without asking", () => {
    const h = setup({ rangeItems: [item({ routineId: "r-1" })] });
    act(() =>
      h.view.result.current.handleMoveItem(
        "s-1",
        "2026-09-18",
        "11:00",
        "12:00",
      ),
    );
    // The template has no concrete date to propagate a day move to (§1-E E-05).
    expect(h.view.result.current.scopeRequest).toBeNull();
    expect(h.order).toEqual([
      "provider:s-1:date+endTime+startTime",
      "range:s-1:date+endTime+startTime",
    ]);
  });
});

describe("handleResizeItem", () => {
  it("routes a todo chip to the host", () => {
    const h = setup();
    const chip = todoChipId("task-1");
    act(() => h.view.result.current.handleResizeItem(chip, "15:30"));
    expect(h.onResizeTodoChip).toHaveBeenCalledWith(chip, "15:30");
    expect(h.updateScheduleItem).not.toHaveBeenCalled();
  });

  it("asks about the series for a routine occurrence and writes a plain one", () => {
    const routine = setup({ rangeItems: [item({ routineId: "r-1" })] });
    act(() => routine.view.result.current.handleResizeItem("s-1", "11:30"));
    expect(routine.view.result.current.scopeRequest).toMatchObject({
      mode: "edit",
      patch: { endTime: "11:30" },
    });
    expect(routine.order).toEqual([]);

    const plain = setup({ rangeItems: [item()] });
    act(() => plain.view.result.current.handleResizeItem("s-1", "11:30"));
    expect(plain.order).toEqual(["provider:s-1:endTime", "range:s-1:endTime"]);
  });
});

describe("handleDropAllDay", () => {
  it("routes a todo chip to the host's all-day rewrite", () => {
    const h = setup();
    const chip = todoChipId("task-1");
    act(() => h.view.result.current.handleDropAllDay(chip, "2026-09-18"));
    expect(h.onDropTodoChipAllDay).toHaveBeenCalledWith(chip, "2026-09-18");
    expect(h.updateScheduleItem).not.toHaveBeenCalled();
  });

  it("flips a routine occurrence to all-day without asking, keeping its times", () => {
    const h = setup({ rangeItems: [item({ routineId: "r-1" })] });
    act(() => h.view.result.current.handleDropAllDay("s-1", "2026-09-18"));
    // #469: the template has no isAllDay to propagate to, so no dialog even
    // here. The times are left alone so an all-day OFF flip restores them.
    expect(h.view.result.current.scopeRequest).toBeNull();
    // The third argument is the #1638 `skipUndo` bag, undefined here: this is
    // a single-row write that owns its own history entry.
    expect(h.updateScheduleItem).toHaveBeenCalledWith(
      "s-1",
      {
        date: "2026-09-18",
        isAllDay: true,
      },
      undefined,
    );
    expect(h.order).toEqual([
      "provider:s-1:date+isAllDay",
      "range:s-1:date+isAllDay",
    ]);
  });
});

describe("handleDismiss", () => {
  it("dismisses, drops the row from the visible range and clears the selection", () => {
    const h = setup({
      rangeItems: [item(), item({ id: "s-2" })],
      selectedId: "s-1",
    });
    act(() => h.view.result.current.handleDismiss("s-1"));
    expect(h.dismiss).toHaveBeenCalledWith("s-1");
    expect(h.rows().map((i) => i.id)).toEqual(["s-2"]);
    expect(h.selectedId()).toBeNull();
  });

  it("leaves a selection that is on another row", () => {
    const h = setup({
      rangeItems: [item(), item({ id: "s-2" })],
      selectedId: "s-2",
    });
    act(() => h.view.result.current.handleDismiss("s-1"));
    expect(h.selectedId()).toBe("s-2");
  });
});

describe("handleDelete", () => {
  it("opens the scope dialog for a routine occurrence instead of deleting it", () => {
    const h = setup({ rangeItems: [item({ routineId: "r-1" })] });
    act(() => h.view.result.current.handleDelete("s-1"));
    // A plain delete would be revived by the generator (Issue 017), so every
    // entry point goes through the dialog.
    expect(h.view.result.current.scopeRequest).toMatchObject({
      mode: "delete",
      item: { id: "s-1" },
    });
    expect(h.deleteScheduleItem).not.toHaveBeenCalled();
    expect(h.rows()).toHaveLength(1);
  });

  it("soft-deletes a manual row, drops it and clears the selection", () => {
    const h = setup({ rangeItems: [item()], selectedId: "s-1" });
    act(() => h.view.result.current.handleDelete("s-1"));
    expect(h.deleteScheduleItem).toHaveBeenCalledWith("s-1");
    expect(h.rows()).toEqual([]);
    expect(h.selectedId()).toBeNull();
  });
});

describe("handleRename", () => {
  it("goes through the same gate as an edit", () => {
    const plain = setup({ rangeItems: [item()] });
    act(() => plain.view.result.current.handleRename("s-1", "Cleaning"));
    expect(plain.order).toEqual(["provider:s-1:title", "range:s-1:title"]);

    const routine = setup({ rangeItems: [item({ routineId: "r-1" })] });
    act(() => routine.view.result.current.handleRename("s-1", "Cleaning"));
    expect(routine.view.result.current.scopeRequest).toMatchObject({
      mode: "edit",
      patch: { title: "Cleaning" },
    });
    expect(routine.order).toEqual([]);
  });
});

describe("handleDuplicate", () => {
  it("copies the row's payload into ONE create and selects the copy", () => {
    const h = setup({
      rangeItems: [
        item({
          isAllDay: true,
          content: "body",
          noteId: "note-1",
          memo: "memo",
        }),
      ],
    });
    act(() => h.view.result.current.handleDuplicate("s-1"));
    // #223: memo rides IN the create rather than in a follow-up update — the
    // UPDATE could race ahead of the INSERT, and the single call is also what
    // keeps Ctrl+Z removing the copy in one press.
    expect(h.createScheduleItem).toHaveBeenCalledWith(
      TODAY,
      `Dentist${COPY_SUFFIX}`,
      "09:00",
      "10:00",
      {
        isAllDay: true,
        content: "body",
        noteId: "note-1",
        memo: "memo",
        // #1642 W16: the reminder travels (K-07) and the copy reports a
        // refused INSERT (K-10) — the two cases below are about those.
        reminderOffset: undefined,
        onSaved: expect.any(Function),
      },
    );
    expect(h.rows()).toHaveLength(2);
    expect(h.rows()[1]).toMatchObject({
      id: NEW_ID,
      title: `Dentist${COPY_SUFFIX}`,
      isAllDay: true,
      content: "body",
      noteId: "note-1",
      memo: "memo",
    });
    expect(h.onSelectItem).toHaveBeenCalledWith(NEW_ID);
  });

  it("reads the source from the provider list when the range has no such row", () => {
    const h = setup({
      rangeItems: [],
      contextItems: [item({ id: "s-9", title: "Standup" })],
    });
    act(() => h.view.result.current.handleDuplicate("s-9"));
    expect(h.createScheduleItem).toHaveBeenCalledWith(
      TODAY,
      `Standup${COPY_SUFFIX}`,
      "09:00",
      "10:00",
      expect.anything(),
    );
  });

  /*
   * #1642 W16 (K-07). A reminder has no face on the grid, so a copy that
   * quietly carries the Settings default instead of the source's own value is
   * invisible until the wrong notification arrives — or none does.
   */
  it("carries the source's reminder instead of re-resolving the default", () => {
    const h = setup({ rangeItems: [item({ reminderOffset: 30 })] });
    act(() => h.view.result.current.handleDuplicate("s-1"));
    expect(h.createOpts()?.reminderOffset).toBe(30);
    expect(h.rows()[1]).toMatchObject({ reminderOffset: 30 });
  });

  it("carries an explicit 'no reminder' too", () => {
    // null is a choice the user made; only `undefined` means "no opinion", and
    // the provider fills that one in from Settings.
    const h = setup({ rangeItems: [item({ reminderOffset: null })] });
    act(() => h.view.result.current.handleDuplicate("s-1"));
    expect(h.createOpts()?.reminderOffset).toBeNull();
  });

  it("leaves a source with no reminder of its own to the Settings default", () => {
    const h = setup({ rangeItems: [item()] });
    act(() => h.view.result.current.handleDuplicate("s-1"));
    expect(h.createOpts()?.reminderOffset).toBeUndefined();
    expect("reminderOffset" in (h.createOpts() ?? {})).toBe(true);
  });

  /*
   * #1642 W16 (K-10). Every other write on this hook either reports its
   * failure or is a patch the reload snaps back. Duplicate did neither: the
   * optimistic copy stayed on the grid, selected, writing to an id the server
   * never saw.
   */
  it("takes the copy back off the grid when the write is refused", () => {
    const h = setup({ rangeItems: [item()] });
    act(() => h.view.result.current.handleDuplicate("s-1"));
    expect(h.rows()).toHaveLength(2);
    expect(h.selectedId()).toBe(null);

    act(() => h.createOpts()?.onSaved?.(null));

    expect(h.rows()).toHaveLength(1);
    expect(h.rows()[0].id).toBe("s-1");
    expect(h.onDuplicateFailed).toHaveBeenCalledTimes(1);
  });

  it("drops the selection with it, but only when it still names the copy", () => {
    const h = setup({ rangeItems: [item()], selectedId: NEW_ID });
    act(() => h.view.result.current.handleDuplicate("s-1"));
    act(() => h.createOpts()?.onSaved?.(null));
    // The editor and the bubble both read the selection; pointing them at a
    // row that is gone is the second half of the same bug.
    expect(h.selectedId()).toBe(null);

    // A selection the user has since moved elsewhere is left alone.
    const other = setup({ rangeItems: [item()], selectedId: "s-1" });
    act(() => other.view.result.current.handleDuplicate("s-1"));
    act(() => other.createOpts()?.onSaved?.(null));
    expect(other.selectedId()).toBe("s-1");
  });

  it("keeps the copy when the write lands", () => {
    const h = setup({ rangeItems: [item()] });
    act(() => h.view.result.current.handleDuplicate("s-1"));
    act(() => h.createOpts()?.onSaved?.(item({ id: NEW_ID })));
    expect(h.rows()).toHaveLength(2);
    expect(h.onDuplicateFailed).not.toHaveBeenCalled();
  });

  it("does nothing for an id neither store knows", () => {
    const h = setup({ rangeItems: [item()] });
    act(() => h.view.result.current.handleDuplicate("missing"));
    expect(h.createScheduleItem).not.toHaveBeenCalled();
    expect(h.onSelectItem).not.toHaveBeenCalled();
    expect(h.rows()).toHaveLength(1);
  });
});
