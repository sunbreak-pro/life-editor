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
 * The note write is a SECOND command rather than part of the item's own: the
 * two land at different times (the link may only be issued once the item row
 * exists — see the ORDERING note in useCreatePanelNotes), and merging them
 * would mean holding the create's command open across an await.
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
      h.hook.result.current.attachNote("s-1", {
        kind: "new",
        title: "Prep notes",
      });
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
      h.hook.result.current.attachNote("s-1", {
        kind: "existing",
        id: "note-existing",
      });
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
    // The catch exists to say "the note did not make it onto the item" —
    // `onAttachError` names a failure the generic copy cannot. It just must
    // not end there: a closure that resolves tells the manager the reversal
    // worked, and the host then stacks "Undid: ..." on top of the error.
    const h = setup();
    vi.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      h.hook.result.current.attachNote("s-1", {
        kind: "existing",
        id: "note-existing",
      });
    });
    await waitFor(() => expect(h.pushed).toHaveLength(1));
    vi.mocked(h.ds.deleteItemLink).mockRejectedValueOnce(new Error("offline"));

    await act(async () => {
      await expect(h.pushed[0].command.undo()).rejects.toThrow("offline");
    });
    expect(h.onAttachError).toHaveBeenCalledTimes(1);
  });

  it("hands a failed redo back the same way (#1767)", async () => {
    const h = setup();
    vi.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      h.hook.result.current.attachNote("s-1", {
        kind: "existing",
        id: "note-existing",
      });
    });
    await waitFor(() => expect(h.pushed).toHaveLength(1));
    await act(async () => {
      await h.pushed[0].command.undo();
    });
    vi.mocked(h.ds.createItemLink).mockRejectedValueOnce(new Error("offline"));

    await act(async () => {
      await expect(h.pushed[0].command.redo()).rejects.toThrow("offline");
    });
    expect(h.onAttachError).toHaveBeenCalledTimes(1);
  });

  it("records nothing when the attach failed", async () => {
    const h = setup();
    vi.mocked(h.ds.createItemLink).mockRejectedValueOnce(new Error("no"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      h.hook.result.current.attachNote("s-1", {
        kind: "existing",
        id: "note-existing",
      });
    });

    await waitFor(() => expect(h.onAttachError).toHaveBeenCalled());
    expect(h.pushed).toHaveLength(0);
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
      h.hook.result.current.attachNote("s-1", {
        kind: "existing",
        id: "note-existing",
      });
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
