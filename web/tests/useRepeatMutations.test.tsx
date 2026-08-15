import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type {
  RepeatScope,
  RoutineNode,
  ScheduleItem,
} from "@life-editor/shared";
import { useRepeatMutations } from "../src/schedule/useRepeatMutations";

/*
 * Schedule's repeat / scope layer, pulled out of useScheduleMutations in the
 * #675 split — and until now untested, which is why it gets a suite here
 * rather than a note saying the move was verbatim.
 *
 * What it decides is not visible from any surface a test could otherwise
 * reach: the scope the user picks in the dialog chooses between writing ONE
 * row, rewriting a template plus its future rows, or detaching / deleting a
 * whole series. Pick the wrong branch and the screen still looks plausible —
 * the damage shows up days later as occurrences the user never touched
 * quietly reverting or vanishing.
 *
 * The pure pieces underneath (`runSeriesEdit`, `seedFrequencyPatch`,
 * `useInFlightGuard`) keep their own suites in shared/tests. This one covers
 * the wiring: which service call each scope makes, and which failure gets
 * which word.
 */

const TODAY = "2026-08-13";
const RANGE_START = "2026-08-10";
const RANGE_END = "2026-08-16";
const ROUTINE_ID = "routine-1";

function occurrence(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: "occ-1",
    date: TODAY,
    title: "Morning run",
    startTime: "07:00",
    endTime: "07:30",
    completed: false,
    completedAt: null,
    routineId: ROUTINE_ID,
    sourceDate: TODAY,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    isDeleted: false,
    deletedAt: null,
    isDismissed: false,
    isAllDay: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function routine(overrides: Partial<RoutineNode> = {}): RoutineNode {
  return {
    id: ROUTINE_ID,
    title: "Morning run",
    startTime: "07:00",
    endTime: "07:30",
    isArchived: false,
    isVisible: true,
    isDeleted: false,
    deletedAt: null,
    order: 0,
    frequencyType: "daily",
    frequencyDays: [],
    frequencyInterval: null,
    frequencyStartDate: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderRepeat(
  opts: {
    selected?: ScheduleItem | null;
    routines?: RoutineNode[];
    /** Whether the routine template write lands (#504). */
    templateLands?: boolean;
    /** Whether updateFutureOccurrences throws (#504 propagate-failed). */
    propagateThrows?: boolean;
    /** Whether the pre-anchor materialise pass lands (#296). */
    fillLands?: boolean;
  } = {},
) {
  const ds = {
    convertEventToRoutine: vi.fn(() => Promise.resolve("routine-new")),
    updateRoutine: vi.fn(() => Promise.resolve(opts.templateLands ?? true)),
    // Typed through the generic rather than named params: the body ignores
    // both, and #708's assertion needs `mock.calls[0][1]` to be the opts bag.
    deleteRoutine: vi.fn<
      (
        id: string,
        opts?: { onCascadeChanged?: () => void },
      ) => Promise<{ deletedScheduleItemIds: string[]; landed: boolean }>
    >(() =>
      Promise.resolve({ deletedScheduleItemIds: ["occ-1"], landed: true }),
    ),
    detachRoutine: vi.fn(() =>
      Promise.resolve({ deletedScheduleItemIds: ["occ-2"] }),
    ),
    updateFutureOccurrences: vi.fn(() =>
      opts.propagateThrows
        ? Promise.reject(new Error("propagate failed"))
        : Promise.resolve(3),
    ),
    ensureRoutineItemsForDateRange: vi.fn(() =>
      Promise.resolve(opts.fillLands ?? true),
    ),
    reconcileRoutineScheduleItems: vi.fn(() => Promise.resolve()),
  };
  const applyOccurrencePatch = vi.fn();
  const dismissOccurrence = vi.fn();
  const onRepeatConvertFailed = vi.fn();
  const reload = vi.fn();

  const hook = renderHook(() =>
    useRepeatMutations({
      setRangeItems: vi.fn(),
      patchRange: vi.fn(),
      reload,
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
      today: TODAY,
      selected: opts.selected ?? occurrence(),
      setSelectedId: vi.fn(),
      routines: opts.routines ?? [routine()],
      ...ds,
      onRepeatConvertFailed,
      applyOccurrencePatch,
      dismissOccurrence,
    }),
  );
  return {
    hook,
    ...ds,
    applyOccurrencePatch,
    dismissOccurrence,
    onRepeatConvertFailed,
    reload,
  };
}

/** Park a request the way the CRUD layer does, then answer it. */
function choose(
  h: ReturnType<typeof renderRepeat>,
  request: {
    mode: "edit" | "delete";
    item: ScheduleItem;
    patch?: Partial<ScheduleItem>;
  },
  scope: RepeatScope,
) {
  act(() => h.hook.result.current.requestScope(request));
  act(() => h.hook.result.current.handleScopeChoose(scope));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the parked scope request", () => {
  // The seam with the CRUD layer: it decides only THAT a row belongs to a
  // series and hands the question over.
  it("holds what the CRUD layer parked, and lets the dialog be dismissed", () => {
    const h = renderRepeat();
    const item = occurrence();
    act(() =>
      h.hook.result.current.requestScope({
        mode: "edit",
        item,
        patch: { title: "Evening run" },
      }),
    );
    expect(h.hook.result.current.scopeRequest).toEqual({
      mode: "edit",
      item,
      patch: { title: "Evening run" },
    });

    act(() => h.hook.result.current.closeScopeRequest());
    expect(h.hook.result.current.scopeRequest).toBeNull();
    // A dismissed dialog writes nothing at all — that is what cancel means.
    expect(h.applyOccurrencePatch).not.toHaveBeenCalled();
    expect(h.updateRoutine).not.toHaveBeenCalled();
  });

  it("writes nothing for a row that turned out to have no series", () => {
    const h = renderRepeat();
    choose(h, { mode: "delete", item: occurrence({ routineId: null }) }, "all");
    expect(h.deleteRoutine).not.toHaveBeenCalled();
    expect(h.dismissOccurrence).not.toHaveBeenCalled();
  });
});

describe("edit scopes", () => {
  // "this" is deliberately the SAME write the CRUD path would have made
  // unasked — the manual edit then wins over any later series propagation
  // (tier-1 §Schedule rule 2).
  it("touches one row and no template for 'this'", () => {
    const h = renderRepeat();
    const patch = { title: "Evening run", startTime: "18:00" };
    choose(h, { mode: "edit", item: occurrence(), patch }, "this");
    expect(h.applyOccurrencePatch).toHaveBeenCalledWith("occ-1", patch);
    expect(h.updateRoutine).not.toHaveBeenCalled();
    expect(h.updateFutureOccurrences).not.toHaveBeenCalled();
  });

  it("anchors 'future' on the occurrence's day and 'all' on the epoch", async () => {
    const h = renderRepeat();
    const anchor = "2026-08-15";
    choose(
      h,
      {
        mode: "edit",
        item: occurrence({ date: anchor }),
        patch: { title: "Evening run" },
      },
      "future",
    );
    await waitFor(() => expect(h.updateFutureOccurrences).toHaveBeenCalled());
    expect(h.updateFutureOccurrences).toHaveBeenCalledWith(
      ROUTINE_ID,
      { title: "Evening run" },
      anchor,
      // The PRE-edit template, so rows the user edited by hand keep their edit.
      { title: "Morning run", startTime: "07:00", endTime: "07:30" },
    );

    const all = renderRepeat();
    choose(
      all,
      { mode: "edit", item: occurrence(), patch: { title: "Evening run" } },
      "all",
    );
    await waitFor(() => expect(all.updateFutureOccurrences).toHaveBeenCalled());
    expect(all.updateFutureOccurrences).toHaveBeenCalledWith(
      ROUTINE_ID,
      { title: "Evening run" },
      // "all" reaches back past every materialised day.
      "0000-01-01",
      expect.anything(),
    );
  });

  // #504: template first, and a lost template write aborts. The reverse order
  // left every future row carrying the new values while the template kept the
  // old ones — a divergence no reload could reveal, because the rows really
  // were right.
  it("says the edit did not happen when the template write is lost", async () => {
    const h = renderRepeat({ templateLands: false });
    choose(
      h,
      { mode: "edit", item: occurrence(), patch: { title: "Evening run" } },
      "all",
    );
    await waitFor(() =>
      expect(h.onRepeatConvertFailed).toHaveBeenCalledWith("series"),
    );
    expect(h.updateFutureOccurrences).not.toHaveBeenCalled();
  });

  // Template in, occurrences out. This one CANNOT say "nothing changed": the
  // rhythm from here on is new while the days already on the calendar keep the
  // old values.
  it("uses different words when only the occurrences failed", async () => {
    const h = renderRepeat({ propagateThrows: true });
    choose(
      h,
      { mode: "edit", item: occurrence(), patch: { title: "Evening run" } },
      "all",
    );
    await waitFor(() =>
      expect(h.onRepeatConvertFailed).toHaveBeenCalledWith("series-partial"),
    );
  });

  // Without the pre-edit template there is no way to tell a hand-edited row
  // from a generated one, so propagating would silently overwrite the user's
  // own edits.
  it("degrades to a single-row edit when the routine is not loaded", () => {
    const h = renderRepeat({ routines: [] });
    const patch = { title: "Evening run" };
    choose(h, { mode: "edit", item: occurrence(), patch }, "all");
    expect(h.applyOccurrencePatch).toHaveBeenCalledWith("occ-1", patch);
    expect(h.updateRoutine).not.toHaveBeenCalled();
  });
});

describe("delete scopes", () => {
  // A plain delete would be revived by the generator on its next pass
  // (Issue 017), so "this" dismisses instead.
  it("dismisses for 'this' rather than deleting the row", () => {
    const h = renderRepeat();
    choose(h, { mode: "delete", item: occurrence() }, "this");
    expect(h.dismissOccurrence).toHaveBeenCalledWith("occ-1");
    expect(h.detachRoutine).not.toHaveBeenCalled();
    expect(h.deleteRoutine).not.toHaveBeenCalled();
  });

  it("detaches from the occurrence's day for 'future'", async () => {
    const h = renderRepeat();
    choose(
      h,
      { mode: "delete", item: occurrence({ date: "2026-08-15" }) },
      "future",
    );
    await waitFor(() => expect(h.detachRoutine).toHaveBeenCalled());
    expect(h.detachRoutine).toHaveBeenCalledWith(ROUTINE_ID, "2026-08-15");
    // Past / completed rows survive as detached records — nothing routine-wide.
    expect(h.deleteRoutine).not.toHaveBeenCalled();
  });

  it("soft-deletes the whole routine for 'all'", async () => {
    const h = renderRepeat();
    choose(h, { mode: "delete", item: occurrence() }, "all");
    await waitFor(() =>
      expect(h.deleteRoutine).toHaveBeenCalledWith(
        ROUTINE_ID,
        expect.anything(),
      ),
    );
    expect(h.detachRoutine).not.toHaveBeenCalled();
  });

  // #708: an undo restores the occurrences and the seed event through the
  // DataService, which this store never sees — so the delete has to hand the
  // range re-read down with it, or the routine comes back to the list with an
  // empty calendar under it.
  it("hands the range re-read to deleteRoutine for the undo path", async () => {
    const h = renderRepeat();
    choose(h, { mode: "delete", item: occurrence() }, "all");
    await waitFor(() => expect(h.deleteRoutine).toHaveBeenCalled());

    const opts = h.deleteRoutine.mock.calls[0][1];
    expect(h.reload).not.toHaveBeenCalled();
    // `opts?.` because the arg is optional in the signature: if it were ever
    // dropped the next assertion is what fails, and it says why.
    opts?.onCascadeChanged?.();
    expect(h.reload).toHaveBeenCalledTimes(1);
  });

  // #296: the days between today and a FUTURE anchor exist only on demand.
  // Detaching before they are materialised erases days the user did not
  // select, so a failed fill has to abort rather than press on.
  it("aborts a future delete when the pre-anchor fill did not land", async () => {
    const h = renderRepeat({ fillLands: false });
    choose(
      h,
      { mode: "delete", item: occurrence({ date: "2026-08-15" }) },
      "future",
    );
    await waitFor(() => expect(h.reload).toHaveBeenCalled());
    expect(h.detachRoutine).not.toHaveBeenCalled();
  });
});

describe("turning a repeat off", () => {
  // #296: the occurrence the user has OPEN is pinned as a survivor. Pre-fix
  // the detach deleted the very row being edited, so a repeat ON→OFF
  // round-trip erased everything.
  it("keeps the open occurrence when detaching the series", async () => {
    const h = renderRepeat();
    act(() => h.hook.result.current.handleDetachRepeat());
    await waitFor(() => expect(h.detachRoutine).toHaveBeenCalled());
    expect(h.detachRoutine).toHaveBeenCalledWith(ROUTINE_ID, undefined, {
      keepItemIds: ["occ-1"],
    });
  });

  it("does nothing for a manual event, which has no series to detach", () => {
    const h = renderRepeat({ selected: occurrence({ routineId: null }) });
    act(() => h.hook.result.current.handleDetachRepeat());
    expect(h.detachRoutine).not.toHaveBeenCalled();
  });
});

describe("turning a repeat on", () => {
  // #407: the manual branch decides on `selected.routineId == null`, and the
  // conversion's optimistic patch lands asynchronously — so a second click
  // inside that window used to mint a SECOND routine whose loser twin kept
  // generating occurrences forever.
  it("converts a manual event once, ignoring a second click while in flight", async () => {
    const h = renderRepeat({ selected: occurrence({ routineId: null }) });
    act(() =>
      h.hook.result.current.handleChangeRepeat({ frequencyType: "daily" }),
    );
    act(() =>
      h.hook.result.current.handleChangeRepeat({ frequencyType: "daily" }),
    );
    await waitFor(() => expect(h.reload).toHaveBeenCalled());
    expect(h.convertEventToRoutine).toHaveBeenCalledTimes(1);
    // The editor reads as busy rather than swallowing the click in silence.
    expect(h.convertEventToRoutine).toHaveBeenCalledWith(
      "occ-1",
      expect.objectContaining({ frequencyType: "daily", sourceDate: TODAY }),
    );
  });

  // #870: the editor sends the repeat BEFORE the field patch (its scope dialog
  // has to stay last), so a time changed in the same press has not reached
  // `selected` yet. Reading the template off `selected` alone put the new time
  // on the seed day and the old one on every generated day after it.
  it("templates the series on times changed by the same save press", async () => {
    const h = renderRepeat({
      selected: occurrence({
        routineId: null,
        startTime: "09:00",
        endTime: "09:30",
      }),
    });
    act(() =>
      h.hook.result.current.handleChangeRepeat(
        { frequencyType: "daily" },
        { title: "Evening run", startTime: "13:00", endTime: "13:30" },
      ),
    );
    await waitFor(() => expect(h.convertEventToRoutine).toHaveBeenCalled());
    expect(h.convertEventToRoutine).toHaveBeenCalledWith(
      "occ-1",
      expect.objectContaining({
        title: "Evening run",
        startTime: "13:00",
        endTime: "13:30",
      }),
    );
    // The same values have to reach the materialiser: it is what fills the rest
    // of the visible range, and the reported symptom was those days — not the
    // template — showing the pre-edit time.
    await waitFor(() =>
      expect(h.ensureRoutineItemsForDateRange).toHaveBeenCalled(),
    );
    expect(h.ensureRoutineItemsForDateRange).toHaveBeenCalledWith(
      // Never before today or before the seed day — a repeat starts at the
      // occurrence it was turned on from.
      TODAY,
      RANGE_END,
      [expect.objectContaining({ startTime: "13:00", endTime: "13:30" })],
    );
  });

  // The other half of the same fix: a press that moved only the frequency
  // sends an empty field patch, and an absent key must read as "leave it" —
  // spreading it whole would blank the title the seed already has.
  it("keeps the item's own values when the press changed no fields", async () => {
    const h = renderRepeat({ selected: occurrence({ routineId: null }) });
    act(() =>
      h.hook.result.current.handleChangeRepeat({ frequencyType: "daily" }, {}),
    );
    await waitFor(() => expect(h.convertEventToRoutine).toHaveBeenCalled());
    expect(h.convertEventToRoutine).toHaveBeenCalledWith(
      "occ-1",
      expect.objectContaining({
        title: "Morning run",
        startTime: "07:00",
        endTime: "07:30",
        sourceDate: TODAY,
      }),
    );
  });

  it("says so when the conversion did not land", async () => {
    const h = renderRepeat({ selected: occurrence({ routineId: null }) });
    h.convertEventToRoutine.mockRejectedValueOnce(new Error("refused"));
    act(() =>
      h.hook.result.current.handleChangeRepeat({ frequencyType: "daily" }),
    );
    await waitFor(() =>
      expect(h.onRepeatConvertFailed).toHaveBeenCalledWith("attach"),
    );
  });

  // An existing series takes the template path instead: patch the routine,
  // then re-shape the days already materialised.
  it("edits the template and reconciles for a row that already repeats", async () => {
    const h = renderRepeat();
    act(() =>
      h.hook.result.current.handleChangeRepeat({ frequencyType: "weekdays" }),
    );
    await waitFor(() =>
      expect(h.reconcileRoutineScheduleItems).toHaveBeenCalled(),
    );
    expect(h.updateRoutine).toHaveBeenCalledWith(
      ROUTINE_ID,
      expect.objectContaining({ frequencyType: "weekdays" }),
    );
    expect(h.convertEventToRoutine).not.toHaveBeenCalled();
    // Reshaping to a rhythm the template never took would leave the two
    // contradicting each other, so a lost template write skips reconcile.
    const lost = renderRepeat({ templateLands: false });
    act(() =>
      lost.hook.result.current.handleChangeRepeat({
        frequencyType: "weekdays",
      }),
    );
    await waitFor(() =>
      expect(lost.onRepeatConvertFailed).toHaveBeenCalledWith("update"),
    );
    expect(lost.reconcileRoutineScheduleItems).not.toHaveBeenCalled();
  });
});
