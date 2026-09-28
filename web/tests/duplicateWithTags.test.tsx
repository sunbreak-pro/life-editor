import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  ScheduleItemsProvider,
  UndoRedoProvider,
  WikiTagsUnifiedProvider,
  useScheduleItemsContext,
  useUndoRedoContext,
  useWikiTagsUnifiedContext,
  type DataService,
  type ScheduleItem,
  type WikiTagAssignmentUnified as WikiTagAssignment,
} from "@life-editor/shared";
import { createBumpableSync, stubDataService } from "./helpers";
import { useDuplicateTagCopy } from "../src/schedule/useDuplicateTagCopy";
import {
  useScheduleMutations,
  type UseScheduleMutationsArgs,
} from "../src/schedule/useScheduleMutations";

/*
 * #2005 (D-20260923-sched-4 = C) — duplicating an event carries its tags when
 * the user picks "with tags", and none when they pick "without".
 *
 * Driven through the real ScheduleItems / WikiTags / UndoRedo Providers over
 * a stubbed DataService, because the promise under test spans all three: the
 * copy is the ScheduleItems create, the tags are WikiTags writes, and "one
 * Ctrl+Z takes both off" is a statement about the history they share. The
 * host (CalendarTab) needs a real grid jsdom cannot give it, so the mutation
 * layer is mounted directly with the host's two real inputs — the provider's
 * `createScheduleItem` and useDuplicateTagCopy's companion — and nothing else
 * of consequence (D-20260812-refactor-2).
 */

const TODAY = "2026-09-28";
const SOURCE_ID = "s-1";

function scheduleRow(over: Partial<ScheduleItem>): ScheduleItem {
  return {
    id: SOURCE_ID,
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
    reminderEnabled: false,
    reminderOffset: null,
    createdAt: TODAY,
    updatedAt: TODAY,
    ...over,
  };
}

function assignment(id: string, itemId: string, tagId: string) {
  return {
    id,
    itemId,
    tagId,
    createdAt: TODAY,
    updatedAt: TODAY,
    isDisplayColor: false,
    isDeleted: false,
    deletedAt: null,
  } satisfies WikiTagAssignment;
}

function setup(over?: {
  source?: Partial<ScheduleItem>;
  extraAssignments?: WikiTagAssignment[];
}) {
  const source = scheduleRow(over?.source ?? {});
  const ds = stubDataService({
    // ScheduleItems
    fetchScheduleItemsByDateAll: vi.fn(async () => [source]),
    fetchDeletedScheduleItems: vi.fn(async () => []),
    fetchScheduleItemsByDateRange: vi.fn(async () => []),
    createScheduleItem: vi.fn(
      async (
        id: string,
        date: string,
        title: string,
        startTime: string,
        endTime: string,
      ) => scheduleRow({ id, date, title, startTime, endTime }),
    ),
    updateScheduleItem: vi.fn(async (id: string) => scheduleRow({ id })),
    softDeleteScheduleItem: vi.fn(async () => {}),
    restoreScheduleItem: vi.fn(async () => {}),
    // WikiTags — the source carries two tags.
    listAllWikiTagsUnified: vi.fn(async () => []),
    listAllTagAssignments: vi.fn(async () => [
      assignment("a-1", SOURCE_ID, "t-work"),
      assignment("a-2", SOURCE_ID, "t-health"),
      ...(over?.extraAssignments ?? []),
    ]),
    listAllTagConnections: vi.fn(async () => []),
    assignTagToItem: vi.fn(
      async (assignmentId: string, itemId: string, tagId: string) =>
        assignment(assignmentId, itemId, tagId),
    ),
    unassignTagFromItem: vi.fn(async () => {}),
  }) as DataService;

  const { wrapper: SyncWrapper } = createBumpableSync();
  const onCommandFailed = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SyncWrapper>
      <UndoRedoProvider onCommandFailed={onCommandFailed}>
        <WikiTagsUnifiedProvider dataService={ds}>
          <ScheduleItemsProvider dataService={ds} date={TODAY}>
            {children}
          </ScheduleItemsProvider>
        </WikiTagsUnifiedProvider>
      </UndoRedoProvider>
    </SyncWrapper>
  );

  const onTagsFailed = vi.fn();
  const onDuplicateFailed = vi.fn();
  const hook = renderHook(
    () => {
      const history = useUndoRedoContext();
      const items = useScheduleItemsContext();
      const tags = useWikiTagsUnifiedContext();
      const { copyTagsFrom } = useDuplicateTagCopy(onTagsFailed);
      const args: UseScheduleMutationsArgs = {
        rangeItems: [source],
        contextItems: items.items,
        setRangeItems: vi.fn(),
        patchRange: vi.fn(),
        reload: vi.fn(),
        rangeStart: TODAY,
        rangeEnd: TODAY,
        today: TODAY,
        selected: null,
        setSelectedId: vi.fn(),
        onSelectItem: vi.fn(),
        createScheduleItem: items.createScheduleItem,
        updateScheduleItem: vi.fn(),
        dismiss: vi.fn(),
        deleteScheduleItem: vi.fn(),
        routines: [],
        convertEventToRoutine: vi.fn(async () => "r-1"),
        updateRoutine: vi.fn(async () => true),
        deleteRoutine: vi.fn(async () => ({
          deletedScheduleItemIds: [] as string[],
          landed: true,
        })),
        detachRoutine: vi.fn(async () => ({
          deletedScheduleItemIds: [] as string[],
          reversal: null,
        })),
        updateFutureOccurrences: vi.fn(async () => 0),
        ensureRoutineItemsForDateRange: vi.fn(async () => true),
        reconcileRoutineScheduleItems: vi.fn(async () => true),
        onMoveTodoChip: vi.fn(),
        onResizeTodoChip: vi.fn(),
        onDropTodoChipAllDay: vi.fn(),
        onRepeatConvertFailed: vi.fn(),
        onDuplicateFailed,
        onCreateFailed: vi.fn(),
        copyTagsFrom,
        push: history.push,
        copySuffix: " (copy)",
      };
      const mutations = useScheduleMutations(args);
      return { history, tags, mutations };
    },
    { wrapper },
  );
  return { hook, ds, onTagsFailed, onDuplicateFailed, onCommandFailed };
}

/** The copy's id — the one row the create wrote. */
function copyId(ds: DataService): string {
  return vi.mocked(ds.createScheduleItem).mock.calls[0][0];
}

function tagIdsOn(h: ReturnType<typeof setup>, itemId: string): string[] {
  return h.hook.result.current.tags
    .getTagsForItem(itemId)
    .map((a) => a.tagId)
    .sort();
}

async function ready(h: ReturnType<typeof setup>) {
  await waitFor(() =>
    expect(tagIdsOn(h, SOURCE_ID)).toEqual(["t-health", "t-work"]),
  );
}

describe("duplicating an event with or without its tags (#2005)", () => {
  it("'with tags' puts every tag of the source on the copy", async () => {
    const h = setup();
    await ready(h);

    act(() =>
      h.hook.result.current.mutations.handleDuplicate(SOURCE_ID, {
        withTags: true,
      }),
    );
    await waitFor(() =>
      expect(h.hook.result.current.history.canUndo("scheduleItem")).toBe(true),
    );

    const id = copyId(h.ds);
    expect(tagIdsOn(h, id)).toEqual(["t-health", "t-work"]);
    expect(h.ds.assignTagToItem).toHaveBeenCalledTimes(2);
    // The source keeps its own.
    expect(tagIdsOn(h, SOURCE_ID)).toEqual(["t-health", "t-work"]);
    expect(h.onTagsFailed).not.toHaveBeenCalled();
  });

  it("'without tags' puts none on the copy", async () => {
    const h = setup();
    await ready(h);

    act(() =>
      h.hook.result.current.mutations.handleDuplicate(SOURCE_ID, {
        withTags: false,
      }),
    );
    await waitFor(() =>
      expect(h.hook.result.current.history.canUndo("scheduleItem")).toBe(true),
    );

    expect(tagIdsOn(h, copyId(h.ds))).toEqual([]);
    expect(h.ds.assignTagToItem).not.toHaveBeenCalled();
  });

  it("one Ctrl+Z after 'with tags' takes the copy and its tags off together", async () => {
    const h = setup();
    await ready(h);

    act(() =>
      h.hook.result.current.mutations.handleDuplicate(SOURCE_ID, {
        withTags: true,
      }),
    );
    await waitFor(() =>
      expect(h.hook.result.current.history.canUndo("scheduleItem")).toBe(true),
    );
    const id = copyId(h.ds);
    await waitFor(() => expect(tagIdsOn(h, id)).toHaveLength(2));

    await act(async () => {
      h.hook.result.current.history.undo("scheduleItem");
    });

    await waitFor(() =>
      expect(h.ds.softDeleteScheduleItem).toHaveBeenCalledWith(id),
    );
    expect(h.ds.unassignTagFromItem).toHaveBeenCalledTimes(2);
    expect(tagIdsOn(h, id)).toEqual([]);
    // One press was enough: nothing of the duplicate is left to undo.
    // (The history is one stack across domains, so this also says no tag
    // write pushed an entry of its own.)
    expect(h.hook.result.current.history.canUndo("scheduleItem")).toBe(false);
    expect(h.onCommandFailed).not.toHaveBeenCalled();

    // And Redo brings both back.
    await act(async () => {
      h.hook.result.current.history.redo("scheduleItem");
    });
    await waitFor(() => expect(tagIdsOn(h, id)).toHaveLength(2));
    expect(h.ds.restoreScheduleItem).toHaveBeenCalledWith(id);
  });

  /*
   * A repeat's tags live on the series (#1632), and the grid paints an
   * occurrence with them (#1663). The copy has no series behind it, so what
   * the user saw on the source — its own tags and the series' — lands on the
   * copy itself.
   */
  it("carries a repeat occurrence's series tags too", async () => {
    const h = setup({
      source: { routineId: "r-1" },
      extraAssignments: [
        assignment("a-3", "r-1", "t-series"),
        // Already on the occurrence itself: carried once, not twice.
        assignment("a-4", "r-1", "t-work"),
      ],
    });
    await ready(h);

    act(() =>
      h.hook.result.current.mutations.handleDuplicate(SOURCE_ID, {
        withTags: true,
      }),
    );
    await waitFor(() =>
      expect(h.hook.result.current.history.canUndo("scheduleItem")).toBe(true),
    );
    expect(tagIdsOn(h, copyId(h.ds))).toEqual([
      "t-health",
      "t-series",
      "t-work",
    ]);
    expect(h.ds.assignTagToItem).toHaveBeenCalledTimes(3);
  });

  it("says so when a tag could not be put on the copy", async () => {
    const h = setup();
    await ready(h);
    vi.mocked(h.ds.assignTagToItem).mockRejectedValueOnce(new Error("no"));

    act(() =>
      h.hook.result.current.mutations.handleDuplicate(SOURCE_ID, {
        withTags: true,
      }),
    );
    await waitFor(() => expect(h.onTagsFailed).toHaveBeenCalledTimes(1));
    // The copy itself landed — this is not the duplicate failing.
    expect(h.onDuplicateFailed).not.toHaveBeenCalled();
    expect(tagIdsOn(h, copyId(h.ds))).toHaveLength(1);
  });
});
