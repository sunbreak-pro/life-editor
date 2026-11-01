import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  UndoRedoProvider,
  WikiTagsUnifiedProvider,
  useUndoRedoContext,
  type DataService,
  type UndoCommand,
} from "@life-editor/shared";
import { createBumpableSync, stubDataService } from "./helpers";
import { useCreatePanelNotes } from "../src/schedule/useCreatePanelNotes";

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

function setup() {
  const pushed: Array<{ domain: string; command: UndoCommand }> = [];
  const push = vi.fn((domain: string, command: UndoCommand) => {
    pushed.push({ domain, command });
  });
  const ds = stubDataService({
    listNotesUnified: vi.fn(async () => []),
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
