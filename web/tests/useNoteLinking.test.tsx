import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

/*
 * The pending-selection handoff (#475). A `[[link]]` click routes through
 * MainScreen and comes back as a note id to select, and since #876 selecting IS
 * the whole job: every surface reads `selectedNote`. It was not always so — the
 * mobile detail sheet kept a note id of its own and gated its body on
 * `selectedNote.id` matching it, so a handoff that only moved the selection
 * left the sheet showing the previous note's title over a skeleton that never
 * resolved. #876 retired the sheet, and with it the `onPendingSelected` seam
 * the host used to follow.
 *
 * Below that, the Notes end of the shared "[[" → item_links wiring (#776). The
 * guards themselves are pinned in useInlineItemLinks.test; what these check is
 * that the Notes surface still reaches them — the hole this whole refactor is
 * about is an editing surface quietly ending up wired to nothing.
 */

const setSelectedNoteId = vi.fn();
const createItemLink = vi.fn(() => Promise.resolve());
const syncInlineLinks = vi.fn(() => Promise.resolve());
let outgoing: { toItemId: string; isDeleted?: boolean }[] = [];

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNotesUnifiedContext: () => ({ notes: [], setSelectedNoteId }),
  useWikiTagsUnifiedContext: () => ({
    createItemLink,
    syncInlineLinks,
    getLinksForItem: () => ({ incoming: [], outgoing }),
  }),
  useSyncDomains: () => 0,
}));

const { useNoteLinking } = await import("../src/notes/hooks/useNoteLinking");

const BODY = '{"type":"doc","content":[]}';

beforeEach(() => {
  setSelectedNoteId.mockClear();
  createItemLink.mockClear();
  syncInlineLinks.mockClear();
  outgoing = [];
});

describe("useNoteLinking pending handoff", () => {
  it("selects the pending note and clears the flag", () => {
    const onConsumePendingSelect = vi.fn();

    renderHook(() =>
      useNoteLinking({
        pendingSelectNoteId: "note-2",
        onConsumePendingSelect,
      }),
    );

    expect(setSelectedNoteId).toHaveBeenCalledWith("note-2");
    expect(onConsumePendingSelect).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a pending id", () => {
    const onConsumePendingSelect = vi.fn();

    renderHook(() =>
      useNoteLinking({ pendingSelectNoteId: null, onConsumePendingSelect }),
    );

    expect(setSelectedNoteId).not.toHaveBeenCalled();
    expect(onConsumePendingSelect).not.toHaveBeenCalled();
  });
});

describe("useNoteLinking inline links", () => {
  function linking() {
    return renderHook(() => useNoteLinking({})).result;
  }

  it("mirrors a picked link as an inline edge out of the open note", () => {
    linking().current.handleResolvedLinkInserted("note-1", "task-9");
    expect(createItemLink).toHaveBeenCalledExactlyOnceWith(
      "note-1",
      "task-9",
      "inline",
    );
  });

  it("leaves an existing edge alone", () => {
    outgoing = [{ toItemId: "task-9" }];
    linking().current.handleResolvedLinkInserted("note-1", "task-9");
    expect(createItemLink).not.toHaveBeenCalled();
  });

  // #372 — the fold: the saved body is what decides which inline edges are
  // stale, so the host has to hand the SAVED text over, not the draft.
  it("hands a saved body to the delete-sync", () => {
    linking().current.handleBodySaved("note-1", BODY);
    expect(syncInlineLinks).toHaveBeenCalledExactlyOnceWith("note-1", BODY);
  });
});
