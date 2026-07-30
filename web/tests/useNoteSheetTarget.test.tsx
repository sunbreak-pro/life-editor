import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNoteSheetTarget } from "../src/notes/hooks/useNoteSheetTarget";

/*
 * #471 — the state machine behind the mobile note sheet: which note is open,
 * and how it stops being open. The sheet now EDITS the note (title / tags /
 * body), so the transitions carry more weight than they did for a read sheet:
 * deleting from inside it, a "[[" link tapped inside it, and a breakpoint
 * crossing all have to leave a consistent state.
 *
 * Same shape as useTaskDetailTarget's tests (#470) — the two sheets deliberately
 * behave alike.
 */

interface Note {
  id: string;
  title: string;
}

const NOTES: Note[] = [
  { id: "note-a", title: "A" },
  { id: "note-b", title: "B" },
];

interface Props {
  isWide: boolean;
  notes: readonly Note[];
  onSelect: (id: string) => void;
  isContentLoaded: (id: string) => boolean;
}

function setup(over: Partial<Props> = {}) {
  const onSelect = vi.fn();
  const initial: Props = {
    isWide: false,
    notes: NOTES,
    onSelect,
    isContentLoaded: () => true,
    ...over,
  };
  const view = renderHook((props: Props) => useNoteSheetTarget(props), {
    initialProps: initial,
  });
  return { ...view, initial, onSelect };
}

describe("useNoteSheetTarget — opening and closing", () => {
  it("opens on the tapped note and selects it, which hydrates the body", () => {
    const { result, onSelect } = setup();
    expect(result.current.sheetNote).toBeNull();

    act(() => result.current.openSheet("note-a"));
    expect(result.current.sheetNote?.id).toBe("note-a");
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("note-a");
  });

  it("closes on request", () => {
    const { result } = setup();
    act(() => result.current.openSheet("note-a"));
    act(() => result.current.closeSheet());
    expect(result.current.sheetNote).toBeNull();
  });

  it("hands back the live note object, not a copy taken at open time", () => {
    const { result, rerender, initial } = setup();
    act(() => result.current.openSheet("note-a"));

    rerender({
      ...initial,
      notes: [{ id: "note-a", title: "renamed" }, NOTES[1]],
    });
    expect(result.current.sheetNote?.title).toBe("renamed");
  });
});

describe("useNoteSheetTarget — a note that goes away", () => {
  it("closes the sheet when the open note is deleted from inside it", () => {
    const { result, rerender, initial } = setup();
    act(() => result.current.openSheet("note-a"));

    // softDeleteNote drops it from the active pool.
    rerender({ ...initial, notes: [NOTES[1]] });
    expect(result.current.sheetNote).toBeNull();
  });

  it("does NOT re-open when a deleted note is restored from Trash", () => {
    const { result, rerender, initial } = setup();
    act(() => result.current.openSheet("note-a"));
    rerender({ ...initial, notes: [NOTES[1]] });

    rerender({ ...initial, notes: NOTES });
    expect(result.current.sheetNote).toBeNull();
  });

  it("leaves a closed sheet closed while notes come and go", () => {
    const { result, rerender, initial } = setup();
    rerender({ ...initial, notes: [NOTES[1]] });
    rerender({ ...initial, notes: NOTES });
    expect(result.current.sheetNote).toBeNull();
  });
});

describe("useNoteSheetTarget — breakpoint crossing", () => {
  it("closes the sheet on the way to wide (the main editor takes over)", () => {
    const { result, rerender, initial } = setup();
    act(() => result.current.openSheet("note-a"));

    rerender({ ...initial, isWide: true });
    expect(result.current.sheetNote).toBeNull();
  });

  it("does not re-open the sheet on the way back to narrow", () => {
    const { result, rerender, initial } = setup();
    act(() => result.current.openSheet("note-a"));
    rerender({ ...initial, isWide: true });

    rerender({ ...initial, isWide: false });
    expect(result.current.sheetNote).toBeNull();
  });

  it("can open a sheet again after coming back to narrow", () => {
    const { result, rerender, initial } = setup();
    rerender({ ...initial, isWide: true });
    rerender({ ...initial, isWide: false });

    act(() => result.current.openSheet("note-b"));
    expect(result.current.sheetNote?.id).toBe("note-b");
  });
});

describe("useNoteSheetTarget — following a '[[' link tapped inside the sheet", () => {
  it("moves the open sheet to the link's target", () => {
    const { result } = setup();
    act(() => result.current.openSheet("note-a"));

    act(() => result.current.followPending("note-b"));
    expect(result.current.sheetNote?.id).toBe("note-b");
  });

  it("does not open a sheet when none was open (the Desktop case)", () => {
    const { result } = setup({ isWide: true });
    act(() => result.current.followPending("note-b"));
    expect(result.current.sheetNote).toBeNull();
  });

  it("stays put when the link points at a note that is gone", () => {
    // Links keep their targetId after the target is deleted. Following one
    // would resolve to nothing and close the sheet, which reads as "my tap
    // threw the note away".
    const { result } = setup();
    act(() => result.current.openSheet("note-a"));

    act(() => result.current.followPending("note-deleted"));
    expect(result.current.sheetNote?.id).toBe("note-a");
  });
});

describe("useNoteSheetTarget — the body has to be here before the editor is", () => {
  it("is not ready while the note's body is still being fetched", () => {
    const { result } = setup({ isContentLoaded: () => false });
    act(() => result.current.openSheet("note-a"));

    expect(result.current.sheetNote?.id).toBe("note-a");
    expect(result.current.sheetReady).toBe(false);
  });

  it("becomes ready once the body lands", () => {
    const loaded = new Set<string>();
    const { result, rerender, initial } = setup({
      isContentLoaded: (id) => loaded.has(id),
    });
    act(() => result.current.openSheet("note-a"));
    expect(result.current.sheetReady).toBe(false);

    loaded.add("note-a"); // hydrateContent resolved
    rerender({ ...initial, isContentLoaded: (id) => loaded.has(id) });
    expect(result.current.sheetReady).toBe(true);
  });

  it("asks about the OPEN note, not whichever note is selected app-wide", () => {
    // The selection outlives the sheet and a list reload; the body does not.
    // Gating on "the selection matches" let the editor mount over an emptied
    // body and save that emptiness on the first keystroke.
    const asked: string[] = [];
    const { result } = setup({
      isContentLoaded: (id) => {
        asked.push(id);
        return id === "note-b";
      },
    });
    act(() => result.current.openSheet("note-b"));

    expect(result.current.sheetReady).toBe(true);
    expect(asked).toContain("note-b");
  });

  it("is never ready with no sheet open", () => {
    const { result } = setup();
    expect(result.current.sheetReady).toBe(false);
  });
});
