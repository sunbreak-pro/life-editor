import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { todoChipId } from "@life-editor/shared";
import type {
  FrequencyLabelCopy,
  RoutineNode,
  ScheduleItem,
  TodoCalendarChip,
} from "@life-editor/shared";
import { useScheduleTodayAgenda } from "../src/schedule/useScheduleTodayAgenda";
import type { UseScheduleTodayAgendaArgs } from "../src/schedule/useScheduleTodayAgenda";

/*
 * TODAY, as the Calendar's rightSidebar shows it (#889 / #1000, extracted from
 * CalendarTab).
 *
 * The thing worth holding still here is a PARTITION. `todayItems` and
 * `skippedToday` read the same list through two filters that differ by one
 * clause, and the pair only works because the clause makes them exclusive:
 *
 *     todayItems   = !isDeleted && !isDismissed
 *     skippedToday = !isDeleted &&  isDismissed
 *
 * Drop the `!isDismissed` from the first and nothing throws — every skipped row
 * simply appears TWICE on the same panel, once in today's flow and once in the
 * "restore these" list underneath it, with a restore button offering to bring
 * back a row already listed above. The counters go with it: a skipped item
 * starts counting toward "N of M done", so a day where everything was skipped
 * reads as a day with work still on it. That is #296's whole point undone, and
 * every existing test stays green through it, which is why the cases below
 * assert the two lists TOGETHER rather than one at a time.
 *
 * The rest is what the group carries besides the split: the merge the agenda is
 * built from (schedule items + todo chips, sorted), the restore's two writes in
 * the order #296 needs them, and the toggle that has to tell a chip from an
 * event before it writes (#761 — a chip id sent to the schedule_item path finds
 * nothing and silently writes nothing at all).
 *
 * Pure data in, pure data out: no i18n, no Provider, no DataService (the copy
 * arrives already resolved), so nothing here needs a render tree — which is the
 * whole reason the group could come out of a host jsdom cannot mount.
 */

const TODAY = "2026-08-16";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const FREQ_COPY: FrequencyLabelCopy = {
  daily: "毎日",
  weekdaysFallback: "曜日未設定",
  intervalEvery: "",
  intervalDays: "日ごと",
};

function item(id: string, over: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id,
    date: TODAY,
    title: id,
    startTime: "10:00",
    endTime: "11:00",
    completed: false,
    completedAt: null,
    routineId: null,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    createdAt: "2026-08-16T00:00:00.000Z",
    updatedAt: "2026-08-16T00:00:00.000Z",
    ...over,
  };
}

function chip(
  id: string,
  over: Partial<TodoCalendarChip> = {},
): TodoCalendarChip {
  return {
    id,
    date: TODAY,
    title: id,
    startTime: "08:00",
    endTime: "09:00",
    isAllDay: false,
    completed: false,
    ...over,
  };
}

function routine(id: string, over: Partial<RoutineNode> = {}): RoutineNode {
  return {
    id,
    title: id,
    startTime: "10:00",
    endTime: "11:00",
    isArchived: false,
    isVisible: true,
    isDeleted: false,
    deletedAt: null,
    order: 0,
    frequencyType: "weekdays",
    frequencyDays: [1, 3, 5],
    frequencyInterval: null,
    frequencyStartDate: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...over,
  };
}

function renderAgenda(over: Partial<UseScheduleTodayAgendaArgs> = {}) {
  /** Ordered log — #296's restore is two writes whose ORDER is the fast path. */
  const writes: string[] = [];
  const undismiss = vi.fn((id: string) => {
    void id;
    writes.push("undismiss");
  });
  const reload = vi.fn(() => {
    writes.push("reload");
  });
  const handleTodoToggleComplete = vi.fn();

  const args: UseScheduleTodayAgendaArgs = {
    contextItems: [],
    todayTodoChips: [],
    undismiss,
    reload,
    selected: null,
    routines: [],
    freqCopy: FREQ_COPY,
    weekdayLabels: WEEKDAYS,
    handleTodoToggleComplete,
    ...over,
  };

  const hook = renderHook(
    (props: UseScheduleTodayAgendaArgs) => useScheduleTodayAgenda(props),
    { initialProps: args },
  );

  return {
    ...hook,
    args,
    writes,
    undismiss,
    reload,
    handleTodoToggleComplete,
  };
}

const ids = (arr: { id: string }[]) => arr.map((i) => i.id);

describe("useScheduleTodayAgenda — the two lists are one partition (#296)", () => {
  /*
   * Four rows covering both flags in both positions. The two deleted ones are
   * here because `isDeleted` is the clause the pair SHARES: a row in the trash
   * belongs to neither list, and a filter that kept it would put a deleted item
   * back on today's panel with a restore button that un-skips it instead of
   * undeleting it.
   */
  const ROWS = [
    item("event-live"),
    item("event-skipped", { isDismissed: true }),
    item("event-trashed", { isDeleted: true }),
    item("event-trashed-and-skipped", { isDeleted: true, isDismissed: true }),
  ];

  it("puts every row that still exists in exactly one of them", () => {
    const { result } = renderAgenda({ contextItems: ROWS });

    expect(ids(result.current.todayItems)).toEqual(["event-live"]);
    expect(ids(result.current.skippedToday)).toEqual(["event-skipped"]);

    // Stated as the invariant rather than as two lists that happen to differ:
    // this is the assertion a dropped `!isDismissed` fails, and the one that
    // keeps failing however the two filters are later rewritten.
    const both = ids(result.current.todayItems).filter((id) =>
      ids(result.current.skippedToday).includes(id),
    );
    expect(both).toEqual([]);
    expect(
      [...ids(result.current.todayItems), ...ids(result.current.skippedToday)]
        .slice()
        .sort(),
    ).toEqual(["event-live", "event-skipped"]);
  });

  /*
   * #1440: no counter reads `todayItems` any more. `completed` on an event is
   * a column the UI cannot set (#1373), so a "{done}/{total}" built from it
   * could only say zero — and the hook must not hand one out for a host to
   * print by accident.
   */
  it("hands out no completion counter for events", () => {
    const { result } = renderAgenda({
      contextItems: [item("done", { completed: true }), item("open")],
    });

    expect("todayDone" in result.current).toBe(false);
    expect("todayTotal" in result.current).toBe(false);
  });

  /*
   * The split's visible half. `todayAgenda` is built from `todayItems`, not
   * from `contextItems`, so a skipped row must not reach the flow tab at all —
   * and the merge it goes through is where the todo chips join, all-day first
   * and then by start time (sortDayItems).
   */
  it("merges today's rows with the todo chips, and leaves the skipped out", () => {
    const { result } = renderAgenda({
      contextItems: [
        item("event-live", { startTime: "10:00" }),
        item("event-skipped", { startTime: "09:00", isDismissed: true }),
      ],
      todayTodoChips: [
        chip("task-timed", { startTime: "08:00" }),
        chip("task-allday", { isAllDay: true, startTime: "00:00" }),
      ],
    });

    expect(ids(result.current.todayAgenda)).toEqual([
      // A chip's agenda id is the PREFIXED synthetic one — that prefix is what
      // the toggle below reads to pick a write path.
      todoChipId("task-allday"),
      todoChipId("task-timed"),
      "event-live",
    ]);
  });

  /*
   * `toAgenda` is handed back so the narrow day list can run the same merge on
   * the ANCHOR day's rows. Same function, another list — which is the reason it
   * takes its arguments rather than closing over today's.
   */
  it("hands the merge itself out for the anchor day to reuse", () => {
    const { result } = renderAgenda();
    const merged = result.current.toAgenda(
      [item("event-elsewhere", { date: "2026-09-01" })],
      [chip("task-elsewhere", { date: "2026-09-01" })],
    );
    expect(ids(merged)).toEqual([
      todoChipId("task-elsewhere"),
      "event-elsewhere",
    ]);
  });
});

describe("useScheduleTodayAgenda — restoring a skipped row (#296)", () => {
  it("un-skips it and refetches, in that order", () => {
    const { result, undismiss, reload, writes } = renderAgenda({
      contextItems: [item("event-skipped", { isDismissed: true })],
    });

    act(() => result.current.handleRestoreSkipped("event-skipped"));

    expect(undismiss).toHaveBeenCalledWith("event-skipped");
    expect(reload).toHaveBeenCalledTimes(1);
    // The refetch is the FAST PATH — it goes out on the same tick as the write
    // rather than waiting for it, and the syncVersion refetch reconciles if it
    // races ahead. Reversed, the row comes back only on the next sync tick.
    expect(writes).toEqual(["undismiss", "reload"]);
  });
});

describe("useScheduleTodayAgenda — one agenda, two write paths (#761)", () => {
  /*
   * The id is all the row hands back, and a chip's id carries a prefix. #1373
   * left only one write behind this — an event has no completion any more — so
   * the guard's job is now the reverse of what it was: unwrap a chip id, and
   * write nothing for anything else.
   */
  it("sends a chip to the TodoTree status write, unwrapped", () => {
    const { result, handleTodoToggleComplete } = renderAgenda();

    act(() => result.current.handleAgendaToggle(todoChipId("task-1")));

    expect(handleTodoToggleComplete).toHaveBeenCalledWith("task-1");
  });

  it("writes nothing for an event id (#1373)", () => {
    const { result, handleTodoToggleComplete } = renderAgenda();

    act(() => result.current.handleAgendaToggle("event-1"));

    expect(handleTodoToggleComplete).not.toHaveBeenCalled();
  });
});

describe("useScheduleTodayAgenda — the editor's 'generated from' caption", () => {
  it("names the series' rhythm for a routine occurrence", () => {
    const { result } = renderAgenda({
      selected: item("event-1", { routineId: "routine-1" }),
      routines: [routine("routine-1", { frequencyDays: [1, 3, 5] })],
    });
    expect(result.current.originDetail).toBe("月・水・金");
  });

  const SILENT: [name: string, over: Partial<UseScheduleTodayAgendaArgs>][] = [
    ["nothing is selected", { selected: null }],
    ["the selection is a manual item", { selected: item("event-1") }],
    /*
     * The ledger is a live list, so the series can be gone while an occurrence
     * of it is still on screen. `undefined` folds the caption away; a label
     * assembled from a missing routine would be the crash.
     */
    [
      "the series has left the ledger",
      {
        selected: item("event-1", { routineId: "routine-gone" }),
        routines: [],
      },
    ],
  ];

  it.each(SILENT)("stays silent when %s", (_name, over) => {
    const { result } = renderAgenda(over);
    expect(result.current.originDetail).toBeUndefined();
  });
});

describe("useScheduleTodayAgenda — the memo boundaries are load-bearing", () => {
  /*
   * Every one of these lists feeds a surface reachable from a keystroke
   * somewhere else in the host, so a dropped `useMemo` (or a dependency list
   * widened to `contextItems`) re-derives the whole sidebar on every character
   * typed into the memo field. Identity is the only way to see that from here.
   */
  it("re-derives nothing while its inputs are the same objects", () => {
    const rows = [item("event-live")];
    const chips = [chip("task-1")];
    const { result, rerender, args } = renderAgenda({
      contextItems: rows,
      todayTodoChips: chips,
    });

    const before = {
      todayItems: result.current.todayItems,
      skippedToday: result.current.skippedToday,
      todayAgenda: result.current.todayAgenda,
    };

    rerender(args);

    expect(result.current.todayItems).toBe(before.todayItems);
    expect(result.current.skippedToday).toBe(before.skippedToday);
    expect(result.current.todayAgenda).toBe(before.todayAgenda);
  });
});
