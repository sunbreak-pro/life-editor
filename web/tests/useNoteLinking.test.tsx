import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

/*
 * The pending-selection handoff (#475). A `[[link]]` click routes through
 * MainScreen and comes back as a note id to select — but SELECTING is not the
 * whole job: the mobile sheet keys on its own note id (useNoteSheetTarget) and
 * gates the body on `selectedNote.id` matching it, so a handoff that only moved
 * the selection left the sheet showing the previous note's title over a skeleton
 * that never resolved. `onPendingSelected` is the seam the host follows.
 */

const setSelectedNoteId = vi.fn();

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNotesUnifiedContext: () => ({ notes: [], setSelectedNoteId }),
  useWikiTagsUnifiedContext: () => ({
    createItemLink: vi.fn(),
    getLinksForItem: () => ({ incoming: [], outgoing: [] }),
  }),
  useSyncContext: () => ({ syncVersion: 0 }),
}));

const { useNoteLinking } = await import("../src/notes/hooks/useNoteLinking");

beforeEach(() => {
  setSelectedNoteId.mockClear();
});

describe("useNoteLinking pending handoff", () => {
  it("selects the pending note and reports it to the host", () => {
    const onPendingSelected = vi.fn();
    const onConsumePendingSelect = vi.fn();

    renderHook(() =>
      useNoteLinking({
        pendingSelectNoteId: "note-2",
        onPendingSelected,
        onConsumePendingSelect,
      }),
    );

    expect(setSelectedNoteId).toHaveBeenCalledWith("note-2");
    expect(onPendingSelected).toHaveBeenCalledWith("note-2");
    expect(onConsumePendingSelect).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a pending id", () => {
    const onPendingSelected = vi.fn();

    renderHook(() =>
      useNoteLinking({ pendingSelectNoteId: null, onPendingSelected }),
    );

    expect(setSelectedNoteId).not.toHaveBeenCalled();
    expect(onPendingSelected).not.toHaveBeenCalled();
  });
});
