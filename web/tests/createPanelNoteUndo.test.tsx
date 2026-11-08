import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  i18n,
  UndoRedoProvider,
  WikiTagsUnifiedProvider,
  useUndoRedoContext,
  type DataService,
  type NoteNode,
  type UndoCommand,
} from "@life-editor/shared";
import { createBumpableSync, stubDataService } from "./helpers";
import { useCreatePanelNotes } from "../src/schedule/useCreatePanelNotes";
import { useCreatePanelMemoNote } from "../src/schedule/useCreatePanelMemoNote";
import {
  formatInstantShortDate,
  useScheduleCopy,
} from "../src/schedule/scheduleCopy";

/*
 * #1638 (A-08 / B-04) — the note the creation panel attaches is on the history
 * now.
 *
 * Until this, creating an event with a new note and pressing Ctrl+Z removed the
 * event and left the note behind, linked to a row that no longer existed: the
 * user had no way to see what had happened, let alone undo it.
 *
 * `attachNote` records the note as its own command — the path the todo
 * writes still take. An event create folds it into its own command instead
 * (#1642 P6, N-08): the provider holds the create's entry until the note has
 * landed, so one Ctrl+Z takes both off. That half is pinned below
 * and in shared/tests/useScheduleItemsCRUD.test.tsx.
 */

const NOTE_ID_PREFIX = "note-";

function setup(notes: NoteNode[] = []) {
  const pushed: Array<{ domain: string; command: UndoCommand }> = [];
  const push = vi.fn((domain: string, command: UndoCommand) => {
    pushed.push({ domain, command });
  });
  const ds = stubDataService({
    listNotesUnified: vi.fn(async () => notes),
    createNoteUnified: vi.fn(async () => {}),
    softDeleteNoteUnified: vi.fn(async () => {}),
    restoreNoteUnified: vi.fn(async () => {}),
    createItemLink: vi.fn(async (linkId: string) => ({
      id: linkId,
      fromItemId: "s-1",
      toItemId: "note-1",
      origin: "manual" as const,
      createdAt: "2026-09-17T00:00:00.000Z",
    })),
    deleteItemLink: vi.fn(async () => {}),
    listAllTagAssignments: vi.fn(async () => []),
  }) as DataService;

  const { wrapper: SyncWrapper } = createBumpableSync();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SyncWrapper>
      <WikiTagsUnifiedProvider dataService={ds}>
        {children}
      </WikiTagsUnifiedProvider>
    </SyncWrapper>
  );
  const onAttachError = vi.fn();
  const hook = renderHook(
    () =>
      useCreatePanelNotes({
        dataService: ds,
        active: true,
        onAttachError,
        push,
      }),
    { wrapper },
  );
  return { hook, ds, push, pushed, onAttachError };
}

describe("the creation panel's note attach", () => {
  it("undoes into removing the link and trashing the note it created", async () => {
    const h = setup();

    await act(async () => {
      h.hook.result.current.attachNote("s-1", [{
        kind: "new",
        title: "Prep notes",
      }]);
    });
    await waitFor(() => expect(h.pushed).toHaveLength(1));
    expect(h.ds.createNoteUnified).toHaveBeenCalledTimes(1);

    await act(async () => {
      await h.pushed[0].command.undo();
    });
    expect(h.ds.deleteItemLink).toHaveBeenCalledTimes(1);
    const created = vi.mocked(h.ds.createNoteUnified).mock.calls[0][0];
    expect(created.id.startsWith(NOTE_ID_PREFIX)).toBe(true);
    expect(h.ds.softDeleteNoteUnified).toHaveBeenCalledWith(created.id);

    await act(async () => {
      await h.pushed[0].command.redo();
    });
    // The note is restored rather than created again — a second create would
    // leave a duplicate on the list.
    expect(h.ds.restoreNoteUnified).toHaveBeenCalledWith(created.id);
    expect(h.ds.createNoteUnified).toHaveBeenCalledTimes(1);
    expect(h.ds.createItemLink).toHaveBeenCalledTimes(2);
  });

  it("keeps a note the user picked from the list", async () => {
    const h = setup();

    await act(async () => {
      h.hook.result.current.attachNote("s-1", [{
        kind: "existing",
        id: "note-existing",
      }]);
    });
    await waitFor(() => expect(h.pushed).toHaveLength(1));

    await act(async () => {
      await h.pushed[0].command.undo();
    });
    expect(h.ds.deleteItemLink).toHaveBeenCalledTimes(1);
    // It existed before this panel opened, so undoing the attach must not
    // reach it.
    expect(h.ds.softDeleteNoteUnified).not.toHaveBeenCalled();
  });

  it("hands a failed undo back instead of reporting success (#1767)", async () => {
    // A closure that resolves tells the manager the reversal worked, and the
    // host then stacks "Undid: ..." on top of the error. The throw is the
    // whole report: the host turns it into one `undoFailed` toast.
    const h = setup();
    vi.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      h.hook.result.current.attachNote("s-1", [{
        kind: "existing",
        id: "note-existing",
      }]);
    });
    await waitFor(() => expect(h.pushed).toHaveLength(1));
    vi.mocked(h.ds.deleteItemLink).mockRejectedValueOnce(new Error("offline"));

    await act(async () => {
      await expect(h.pushed[0].command.undo()).rejects.toThrow("offline");
    });
    // #1642 P4 (N-06): the host's `undoFailed` is the one report.
    expect(h.onAttachError).not.toHaveBeenCalled();
  });

  it("hands a failed redo back the same way (#1767)", async () => {
    const h = setup();
    vi.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      h.hook.result.current.attachNote("s-1", [{
        kind: "existing",
        id: "note-existing",
      }]);
    });
    await waitFor(() => expect(h.pushed).toHaveLength(1));
    await act(async () => {
      await h.pushed[0].command.undo();
    });
    vi.mocked(h.ds.createItemLink).mockRejectedValueOnce(new Error("offline"));

    await act(async () => {
      await expect(h.pushed[0].command.redo()).rejects.toThrow("offline");
    });
    // #1642 P4 (N-06): the host's `undoFailed` is the one report.
    expect(h.onAttachError).not.toHaveBeenCalled();
  });

  it("records nothing when the attach failed", async () => {
    const h = setup();
    vi.mocked(h.ds.createItemLink).mockRejectedValueOnce(new Error("no"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      h.hook.result.current.attachNote("s-1", [{
        kind: "existing",
        id: "note-existing",
      }]);
    });

    await waitFor(() => expect(h.onAttachError).toHaveBeenCalled());
    expect(h.pushed).toHaveLength(0);
  });
});

/*
 * #1642 P6. The event create takes the note in as its companion (N-08): the
 * reversal comes back to it instead of going on the stack as a second
 * command. And a note this panel created that then could not be linked is
 * trashed again rather than left behind on its own (N-09).
 */
describe("the note as the event create's companion (#1642 P6)", () => {
  it("N-08: hands the reversal back instead of pushing it", async () => {
    const h = setup();
    let reversal: Awaited<
      ReturnType<typeof h.hook.result.current.attachNoteAlongside>
    > = null;
    await act(async () => {
      reversal = await h.hook.result.current.attachNoteAlongside("s-1", [{
        kind: "new",
        title: "Prep notes",
      }]);
    });
    expect(reversal).not.toBeNull();
    expect(h.pushed).toHaveLength(0);

    await act(async () => {
      await reversal!.undo();
    });
    expect(h.ds.deleteItemLink).toHaveBeenCalledTimes(1);
    expect(h.ds.softDeleteNoteUnified).toHaveBeenCalledTimes(1);
  });

  it("N-09: trashes a note it created when the link does not land", async () => {
    const h = setup();
    vi.mocked(h.ds.createItemLink).mockRejectedValueOnce(new Error("no"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      await h.hook.result.current.attachNoteAlongside("s-1", [{
        kind: "new",
        title: "Prep notes",
      }]);
    });

    const created = vi.mocked(h.ds.createNoteUnified).mock.calls[0][0];
    expect(h.ds.softDeleteNoteUnified).toHaveBeenCalledWith(created.id);
    expect(h.onAttachError).toHaveBeenCalledTimes(1);
    expect(h.pushed).toHaveLength(0);
  });

  it("leaves a note the user picked alone when the link does not land", async () => {
    const h = setup();
    vi.mocked(h.ds.createItemLink).mockRejectedValueOnce(new Error("no"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      await h.hook.result.current.attachNoteAlongside("s-1", [{
        kind: "existing",
        id: "note-existing",
      }]);
    });
    expect(h.ds.softDeleteNoteUnified).not.toHaveBeenCalled();
    expect(h.onAttachError).toHaveBeenCalledTimes(1);
  });
});

/*
 * #2396 — the panel stages several notes, and the write takes them all. One
 * command still: one Ctrl+Z takes back every note one press brought along.
 * A note that fails leaves the others linked, and the user hears about it
 * once.
 */
describe("several staged notes (#2396)", () => {
  const PICKED = { kind: "existing" as const, id: "note-a" };
  const ALSO_PICKED = { kind: "existing" as const, id: "note-b" };
  const NEW = { kind: "new" as const, title: "Minutes" };

  it("links every note and records them as one command", async () => {
    const h = setup();
    await act(async () => {
      h.hook.result.current.attachNote("s-1", [PICKED, NEW, ALSO_PICKED]);
    });
    await waitFor(() => expect(h.pushed).toHaveLength(1));
    // In the order the chips showed them.
    expect(
      vi.mocked(h.ds.createItemLink).mock.calls.map((c) => [c[1], c[2]]),
    ).toEqual([
      ["s-1", "note-a"],
      ["s-1", vi.mocked(h.ds.createNoteUnified).mock.calls[0][0].id],
      ["s-1", "note-b"],
    ]);

    await act(async () => {
      await h.pushed[0].command.undo();
    });
    expect(h.ds.deleteItemLink).toHaveBeenCalledTimes(3);
    // Only the note this panel made goes to the trash.
    expect(h.ds.softDeleteNoteUnified).toHaveBeenCalledTimes(1);

    await act(async () => {
      await h.pushed[0].command.redo();
    });
    expect(h.ds.createItemLink).toHaveBeenCalledTimes(6);
    expect(h.ds.restoreNoteUnified).toHaveBeenCalledTimes(1);
  });

  it("keeps the notes that landed and reports a failure once", async () => {
    const h = setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    // The second and third links fail; the first lands.
    const link = vi.mocked(h.ds.createItemLink);
    const real = link.getMockImplementation()!;
    let calls = 0;
    link.mockImplementation(async (...args) => {
      calls += 1;
      if (calls > 1) throw new Error("no");
      return real(...args);
    });

    await act(async () => {
      h.hook.result.current.attachNote("s-1", [PICKED, NEW, ALSO_PICKED]);
    });
    await waitFor(() => expect(h.pushed).toHaveLength(1));
    expect(h.onAttachError).toHaveBeenCalledTimes(1);
    // The new note that could not be linked is trashed again (N-09).
    const created = vi.mocked(h.ds.createNoteUnified).mock.calls[0][0];
    expect(h.ds.softDeleteNoteUnified).toHaveBeenCalledWith(created.id);

    // The one command reverses only what landed.
    vi.mocked(h.ds.softDeleteNoteUnified).mockClear();
    await act(async () => {
      await h.pushed[0].command.undo();
    });
    expect(h.ds.deleteItemLink).toHaveBeenCalledTimes(1);
    expect(h.ds.softDeleteNoteUnified).not.toHaveBeenCalled();
  });

  it("records nothing and reports once when every note failed", async () => {
    const h = setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(h.ds.createItemLink).mockRejectedValue(new Error("no"));

    await act(async () => {
      await h.hook.result.current.attachNoteAlongside("s-1", [
        PICKED,
        ALSO_PICKED,
      ]);
    });
    expect(h.onAttachError).toHaveBeenCalledTimes(1);
    expect(h.pushed).toHaveLength(0);
  });

  it("retries only the notes a half-failed undo left standing", async () => {
    const h = setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    let reversal: Awaited<
      ReturnType<typeof h.hook.result.current.attachNoteAlongside>
    > = null;
    await act(async () => {
      reversal = await h.hook.result.current.attachNoteAlongside("s-1", [
        PICKED,
        ALSO_PICKED,
      ]);
    });
    // Undo runs last-first: note-b's link goes, note-a's does not.
    vi.mocked(h.ds.deleteItemLink)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("offline"));
    await act(async () => {
      await expect(reversal!.undo()).rejects.toThrow("offline");
    });
    expect(h.ds.deleteItemLink).toHaveBeenCalledTimes(2);

    // The second press only touches the one left.
    await act(async () => {
      await reversal!.undo();
    });
    expect(h.ds.deleteItemLink).toHaveBeenCalledTimes(3);
    const [firstLinkId] = vi.mocked(h.ds.createItemLink).mock.calls[0];
    expect(vi.mocked(h.ds.deleteItemLink).mock.calls[2][0]).toBe(firstLinkId);

    // And the redo brings both back, once each.
    await act(async () => {
      await reversal!.redo();
    });
    expect(h.ds.createItemLink).toHaveBeenCalledTimes(4);
  });

  it("attaches nothing for an empty list", async () => {
    const h = setup();
    await act(async () => {
      h.hook.result.current.attachNote("s-1", []);
    });
    expect(h.ds.createItemLink).not.toHaveBeenCalled();
    expect(h.pushed).toHaveLength(0);
    expect(h.onAttachError).not.toHaveBeenCalled();
  });
});

/*
 * The stacks themselves, against the real manager rather than a `vi.fn()`
 * push. What the user actually loses when a failed undo is read as a success
 * is the SECOND press: the command moves to redo, and the only button that
 * would retry the reversal goes dark.
 */
describe("a failed note-attach undo and the real history (#1767)", () => {
  function setupLive() {
    const ds = stubDataService({
      listNotesUnified: vi.fn(async () => []),
      createNoteUnified: vi.fn(async () => {}),
      softDeleteNoteUnified: vi.fn(async () => {}),
      restoreNoteUnified: vi.fn(async () => {}),
      createItemLink: vi.fn(async (linkId: string) => ({
        id: linkId,
        fromItemId: "s-1",
        toItemId: "note-existing",
        origin: "manual" as const,
        createdAt: "2026-09-17T00:00:00.000Z",
      })),
      deleteItemLink: vi.fn(async () => {}),
      listAllTagAssignments: vi.fn(async () => []),
    }) as DataService;
    const { wrapper: SyncWrapper } = createBumpableSync();
    // The two callbacks UndoRedoHost hands the provider in the real app.
    const onCommandApplied = vi.fn();
    const onCommandFailed = vi.fn();
    const onAttachError = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SyncWrapper>
        <UndoRedoProvider
          onCommandApplied={onCommandApplied}
          onCommandFailed={onCommandFailed}
        >
          <WikiTagsUnifiedProvider dataService={ds}>
            {children}
          </WikiTagsUnifiedProvider>
        </UndoRedoProvider>
      </SyncWrapper>
    );
    const hook = renderHook(
      () => {
        const history = useUndoRedoContext();
        const notes = useCreatePanelNotes({
          dataService: ds,
          active: true,
          onAttachError,
          push: history.push,
        });
        return { ...notes, history };
      },
      { wrapper },
    );
    return { hook, ds, onAttachError, onCommandApplied, onCommandFailed };
  }

  it("leaves the command on the undo stack so a second press can retry", async () => {
    const h = setupLive();
    vi.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      h.hook.result.current.attachNote("s-1", [{
        kind: "existing",
        id: "note-existing",
      }]);
    });
    await waitFor(() =>
      expect(h.hook.result.current.history.canUndo("scheduleItem")).toBe(true),
    );

    vi.mocked(h.ds.deleteItemLink).mockRejectedValueOnce(new Error("offline"));
    await act(async () => {
      h.hook.result.current.history.undo("scheduleItem");
    });
    await waitFor(() => expect(h.onCommandFailed).toHaveBeenCalledTimes(1));

    expect(h.onCommandFailed.mock.calls[0][0]).toBe("undo");
    expect(h.onCommandApplied).not.toHaveBeenCalled();
    expect(h.hook.result.current.history.canRedo("scheduleItem")).toBe(false);
    expect(h.hook.result.current.history.canUndo("scheduleItem")).toBe(true);

    // The retry: the mock only rejected once, so this press is the one that
    // lands — the whole point of keeping the command reachable.
    await act(async () => {
      h.hook.result.current.history.undo("scheduleItem");
    });
    await waitFor(() => expect(h.onCommandApplied).toHaveBeenCalledTimes(1));
    expect(h.ds.deleteItemLink).toHaveBeenCalledTimes(2);
  });
});

/*
 * #2402 — the writes behind 新規作成, and the todo path's one undo entry. The
 * event path hands the same reversal to its create (the N-08 cases above).
 */
describe("the memo note (#2402)", () => {
  const INPUT = {
    title: "Dentist のメモ",
    notes: [],
    noteTagIds: [],
    itemTagIds: [],
  };

  it("makes the note, links item to note, and reports nothing itself", async () => {
    const h = setup();
    const attached = await act(() =>
      h.hook.result.current.attachMemoNote("s-1", INPUT),
    );
    const created = vi.mocked(h.ds.createNoteUnified).mock.calls[0][0];
    expect(created.title).toBe("Dentist のメモ");
    expect(attached.noteId).toBe(created.id);
    expect(attached.ok).toBe(true);
    expect(vi.mocked(h.ds.createItemLink).mock.calls[0].slice(1, 3)).toEqual([
      "s-1",
      created.id,
    ]);
    expect(h.pushed).toHaveLength(0);
    expect(h.onAttachError).not.toHaveBeenCalled();
  });

  it("links the staged chips after the memo, and reverses them as one", async () => {
    const h = setup();
    const attached = await act(() =>
      h.hook.result.current.attachMemoNote("s-1", {
        ...INPUT,
        notes: [{ kind: "existing", id: "note-a" }],
      }),
    );
    const created = vi.mocked(h.ds.createNoteUnified).mock.calls[0][0];
    expect(vi.mocked(h.ds.createItemLink).mock.calls.map((c) => c[2])).toEqual([
      created.id,
      "note-a",
    ]);

    await act(async () => {
      await attached.reversal?.undo();
    });
    expect(h.ds.deleteItemLink).toHaveBeenCalledTimes(2);
    // Only the note this press made goes to the trash.
    expect(h.ds.softDeleteNoteUnified).toHaveBeenCalledExactlyOnceWith(
      created.id,
    );
    await act(async () => {
      await attached.reversal?.redo();
    });
    expect(h.ds.restoreNoteUnified).toHaveBeenCalledExactlyOnceWith(created.id);
    expect(h.ds.createNoteUnified).toHaveBeenCalledTimes(1);
  });

  it("has no note to open when the link failed, and trashes the one it made", async () => {
    const h = setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(h.ds.createItemLink).mockRejectedValueOnce(new Error("no"));
    const attached = await act(() =>
      h.hook.result.current.attachMemoNote("s-1", INPUT),
    );
    expect(attached).toEqual({ noteId: null, ok: false, reversal: null });
    expect(h.ds.softDeleteNoteUnified).toHaveBeenCalledTimes(1);
    // The caller reports the whole press once; this must not add a second.
    expect(h.onAttachError).not.toHaveBeenCalled();
  });

  it("has no note when its creation failed", async () => {
    const h = setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(h.ds.createNoteUnified).mockRejectedValueOnce(new Error("no"));
    const attached = await act(() =>
      h.hook.result.current.attachMemoNote("s-1", INPUT),
    );
    expect(attached.noteId).toBeNull();
    expect(attached.ok).toBe(false);
    expect(h.ds.createItemLink).not.toHaveBeenCalled();
  });

  function setupMemoNote() {
    const h = setup();
    const calls: string[] = [];
    vi.mocked(h.ds.deleteItemLink).mockImplementation(async () => {
      calls.push("unlink");
    });
    vi.mocked(h.ds.createItemLink).mockImplementation(async (id: string) => {
      calls.push("link");
      return {
        id,
        fromItemId: "task-1",
        toItemId: "note-1",
        origin: "manual" as const,
        createdAt: "2026-09-17T00:00:00.000Z",
        updatedAt: "2026-09-17T00:00:00.000Z",
        isDeleted: false,
        deletedAt: null,
      };
    });
    h.ds.softDeleteTodo = vi.fn(async () => {
      calls.push("trash todo");
    });
    h.ds.restoreTodo = vi.fn(async () => {
      calls.push("restore todo");
    });
    const refetchTodos = vi.fn(async () => {});
    const onOpenNote = vi.fn();
    const showToast = vi.fn();
    const memo = renderHook(() =>
      useCreatePanelMemoNote({
        dataService: h.ds,
        attachMemoNote: h.hook.result.current.attachMemoNote,
        refetchTodos,
        push: h.push,
        onOpenNote,
        showToast,
      }),
    );
    return { ...h, memo, calls, refetchTodos, onOpenNote, showToast };
  }

  it("records a new todo, its note and the link as ONE by-id command", async () => {
    const h = setupMemoNote();
    const api = h.memo.result.current!;
    const attached = await act(() =>
      api.attach("task-1", "Write", {
        notes: [],
        noteTagIds: [],
        itemTagIds: [],
      }),
    );
    h.calls.length = 0;
    act(() => api.pushTodoUndo(attached, "task-1"));

    expect(h.pushed).toHaveLength(1);
    // It must survive the jump: only flagged commands die with the provider.
    expect(h.pushed[0].command.expiresWithProvider).toBeUndefined();

    await act(async () => {
      await h.pushed[0].command.undo();
    });
    // The link hangs off the todo's row, so it goes first.
    expect(h.calls).toEqual(["unlink", "trash todo"]);
    expect(h.ds.softDeleteNoteUnified).toHaveBeenCalledTimes(1);

    h.calls.length = 0;
    await act(async () => {
      await h.pushed[0].command.redo();
    });
    expect(h.calls).toEqual(["restore todo", "link"]);
    expect(h.ds.restoreNoteUnified).toHaveBeenCalledTimes(1);
    expect(h.refetchTodos).toHaveBeenCalledTimes(2);
  });

  it("leaves a picked todo out of the command", async () => {
    const h = setupMemoNote();
    const api = h.memo.result.current!;
    const attached = await act(() =>
      api.attach("task-old", "Old", {
        notes: [],
        noteTagIds: [],
        itemTagIds: [],
      }),
    );
    act(() => api.pushTodoUndo(attached, null));
    await act(async () => {
      await h.pushed[0].command.undo();
    });
    expect(h.ds.softDeleteTodo).not.toHaveBeenCalled();
    expect(h.ds.softDeleteNoteUnified).toHaveBeenCalledTimes(1);
  });

  it("keeps the todo undoable when only the note failed", () => {
    const h = setupMemoNote();
    act(() =>
      h.memo.result.current!.pushTodoUndo(
        { noteId: null, ok: false, reversal: null },
        "task-1",
      ),
    );
    expect(h.pushed).toHaveLength(1);
  });

  it("records nothing for a picked todo whose note failed", () => {
    const h = setupMemoNote();
    act(() =>
      h.memo.result.current!.pushTodoUndo(
        { noteId: null, ok: false, reversal: null },
        null,
      ),
    );
    expect(h.pushed).toHaveLength(0);
  });

  describe("landing", () => {
    const OK = { noteId: "note-memo", ok: true, reversal: null };

    it("goes to the note and says so, in the event's words", () => {
      const h = setupMemoNote();
      act(() => h.memo.result.current!.land("event", "歯医者", OK));
      expect(h.onOpenNote).toHaveBeenCalledExactlyOnceWith({
        id: "note-memo",
        role: "note",
      });
      expect(h.showToast).toHaveBeenCalledExactlyOnceWith(
        "success",
        i18n.t("scheduleScreen.memoNoteCreatedEvent", { title: "歯医者" }),
      );
    });

    it("says so in the todo's words", () => {
      const h = setupMemoNote();
      act(() => h.memo.result.current!.land("task", "資料", OK));
      expect(h.showToast).toHaveBeenCalledExactlyOnceWith(
        "success",
        i18n.t("scheduleScreen.memoNoteCreatedTodo", { title: "資料" }),
      );
    });

    it("stays and reports once when there is no note", () => {
      const h = setupMemoNote();
      act(() =>
        h.memo.result.current!.land("event", "歯医者", {
          noteId: null,
          ok: false,
          reversal: null,
        }),
      );
      expect(h.onOpenNote).not.toHaveBeenCalled();
      expect(h.showToast).toHaveBeenCalledExactlyOnceWith(
        "danger",
        i18n.t("scheduleScreen.memoNoteFailed"),
      );
    });

    it("still opens a note that landed without every tag, and reports once", () => {
      const h = setupMemoNote();
      act(() =>
        h.memo.result.current!.land("event", "歯医者", { ...OK, ok: false }),
      );
      expect(h.onOpenNote).toHaveBeenCalledTimes(1);
      expect(h.showToast).toHaveBeenCalledTimes(1);
      expect(h.showToast.mock.calls[0][0]).toBe("danger");
    });

    it("reports once, in place of the success, when the jump throws", () => {
      const h = setupMemoNote();
      vi.spyOn(console, "error").mockImplementation(() => {});
      h.onOpenNote.mockImplementation(() => {
        throw new Error("no");
      });
      act(() => h.memo.result.current!.land("event", "歯医者", OK));
      expect(h.showToast).toHaveBeenCalledExactlyOnceWith(
        "danger",
        i18n.t("scheduleScreen.memoNoteFailed"),
      );
    });
  });

  it("is null on a host with no jump to make", () => {
    const h = setup();
    const memo = renderHook(() =>
      useCreatePanelMemoNote({
        dataService: h.ds,
        attachMemoNote: h.hook.result.current.attachMemoNote,
        refetchTodos: async () => {},
        showToast: vi.fn(),
      }),
    );
    expect(memo.result.current).toBeNull();
  });

  it("words the names and the title in both languages", async () => {
    const h = setupMemoNote();
    const language = i18n.language;
    const api = () => h.memo.result.current!;
    await act(async () => {
      await i18n.changeLanguage("ja");
    });
    expect(api().untitled("event")).toBe("無題の予定");
    expect(api().untitled("task")).toBe("無題の Todo");
    expect(i18n.t("scheduleScreen.memoNoteTitle", { title: "歯医者" })).toBe(
      "歯医者のメモ",
    );
    expect(
      i18n.t("scheduleScreen.memoNoteCreatedEvent", { title: "歯医者" }),
    ).toBe("予定『歯医者』とリンクしたノートを作りました");
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    expect(api().untitled("event")).toBe("Untitled event");
    expect(api().untitled("task")).toBe("Untitled todo");
    await act(async () => {
      await i18n.changeLanguage(language);
    });
  });
});

/*
 * #2573 — the picker draws each note's updated date (「10/10 更新」), so the
 * options now carry `updatedAt`. Widening the option must leave the attach
 * as it was: a picked option is still linked by its id alone.
 */
function noteRow(over: Partial<NoteNode> & { id: string }): NoteNode {
  return {
    type: "note",
    title: over.id,
    content: "",
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...over,
  };
}

describe("the picker's options carry the updated date (#2573)", () => {
  it("hands each live note its updatedAt, newest first", async () => {
    const h = setup([
      noteRow({ id: "note-old", title: "Old", updatedAt: "2026-10-08T03:00:00.000Z" }),
      noteRow({
        id: "note-new",
        title: "New",
        updatedAt: "2026-10-10T03:00:00.000Z",
        hasPassword: true,
      }),
      noteRow({ id: "note-gone", isDeleted: true }),
    ]);
    await waitFor(() => expect(h.hook.result.current.notes).toHaveLength(2));
    expect(h.hook.result.current.notes).toEqual([
      {
        id: "note-new",
        title: "New",
        isLocked: true,
        updatedAt: "2026-10-10T03:00:00.000Z",
      },
      { id: "note-old", title: "Old", updatedAt: "2026-10-08T03:00:00.000Z" },
    ]);
  });

  it("still links a picked option by its id", async () => {
    const h = setup([
      noteRow({ id: "note-1", updatedAt: "2026-10-10T03:00:00.000Z" }),
    ]);
    await waitFor(() => expect(h.hook.result.current.notes).toHaveLength(1));
    const [picked] = h.hook.result.current.notes;
    await act(async () => {
      h.hook.result.current.attachNote("s-1", [
        { kind: "existing", id: picked.id },
      ]);
    });
    await waitFor(() => expect(h.pushed).toHaveLength(1));
    expect(h.ds.createItemLink).toHaveBeenCalledTimes(1);
    expect(vi.mocked(h.ds.createItemLink).mock.calls[0]).toContain("note-1");
    // An existing note is linked, never written.
    expect(h.ds.createNoteUnified).not.toHaveBeenCalled();
  });

  it("words the row's date, the empty foot and the question in both languages", async () => {
    const language = i18n.language;
    // Local noon, so the calendar day is the same in every time zone.
    const noon = new Date(2026, 9, 10, 12).toISOString();
    const copy = renderHook(() =>
      useScheduleCopy({ isWide: true, notesError: false, selectedTagCount: 0 }),
    );
    const labels = () => copy.result.current.createPanelLabels;
    await act(async () => {
      await i18n.changeLanguage("ja");
    });
    expect(labels().noteUpdated?.(noon)).toBe("10/10 更新");
    expect(labels().notePickerNone).toBe("選ぶと、この予定に添付されます");
    expect(labels().noteRowPrompt).toBe("ノートをどうしますか");
    expect(labels().notePickerCount(2)).toBe("2 件を選択中");
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    expect(labels().noteUpdated?.(noon)).toBe("Updated 10/10");
    // A value that does not parse draws no line rather than "Invalid Date".
    expect(labels().noteUpdated?.("not a date")).toBe("");
    expect(formatInstantShortDate("en", "not a date")).toBe("");
    await act(async () => {
      await i18n.changeLanguage(language);
    });
  });
});
