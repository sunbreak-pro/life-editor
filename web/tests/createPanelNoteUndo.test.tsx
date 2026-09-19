import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  WikiTagsUnifiedProvider,
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
