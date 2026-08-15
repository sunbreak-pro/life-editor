import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { RichTextEditor } from "../src/notes/RichTextEditor";

/*
 * The editor's two persistence modes (#713).
 *
 * `onUpdate` is the original and the default everywhere: an 800ms debounce,
 * flushed on unmount and on tab close. `onDraftChange` is the opt-in the todo
 * body takes — report, never persist — because TodoDetailPanel commits from a
 * save button now. Notes and Daily are deliberately outside Epic #627, so the
 * point of this suite is as much what did NOT change as what did.
 *
 * The REAL editor is driven here (no stub): an Enter keydown runs ProseMirror's
 * own splitBlock through its keymap, which is plain JS on the event rather than
 * the coordinate pipeline jsdom cannot serve (#475) — so the document really
 * changes and the real onUpdate path really runs.
 */

const DOC = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
});

/** Type-ish: split the paragraph, which is a real document change. */
function edit(container: HTMLElement) {
  const dom = container.querySelector<HTMLElement>(".tiptap");
  if (!dom) throw new Error("editor did not mount");
  act(() => {
    dom.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}

describe("RichTextEditor — auto-save mode (Notes / Daily, unchanged)", () => {
  it("persists a change after the 800ms debounce", () => {
    vi.useFakeTimers();
    try {
      const onUpdate = vi.fn();
      const { container } = render(
        <RichTextEditor
          noteId="note-1"
          initialContent={DOC}
          onUpdate={onUpdate}
        />,
      );

      edit(container);
      // Nothing yet — the debounce is what keeps a keystroke off the wire.
      expect(onUpdate).not.toHaveBeenCalled();

      act(() => void vi.advanceTimersByTime(800));
      expect(onUpdate).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("writes nothing for merely opening a note", () => {
    vi.useFakeTimers();
    try {
      const onUpdate = vi.fn();
      render(
        <RichTextEditor
          noteId="note-1"
          initialContent={DOC}
          onUpdate={onUpdate}
        />,
      );

      act(() => void vi.advanceTimersByTime(2000));
      // setEditable used to emit an `update` on mount, so every open rewrote
      // the same content and bumped `updated_at` for the sync cursor.
      expect(onUpdate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("flushes the pending change on unmount (a note switch loses nothing)", () => {
    vi.useFakeTimers();
    try {
      const onUpdate = vi.fn();
      const { container, unmount } = render(
        <RichTextEditor
          noteId="note-1"
          initialContent={DOC}
          onUpdate={onUpdate}
        />,
      );

      edit(container);
      act(() => unmount());
      expect(onUpdate).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("RichTextEditor — draft mode (#713, the todo body)", () => {
  it("reports every change immediately instead of persisting it", () => {
    const onDraftChange = vi.fn();
    const { container } = render(
      <RichTextEditor
        noteId="task-a"
        initialContent={DOC}
        onDraftChange={onDraftChange}
      />,
    );

    // Mounting is not an edit — a panel merely opened has nothing pending.
    expect(onDraftChange).not.toHaveBeenCalled();

    edit(container);
    // No debounce to wait out: the host holds the draft, so it needs it now.
    expect(onDraftChange).toHaveBeenCalled();
    expect(onDraftChange.mock.lastCall?.[0]).toContain("paragraph");
  });

  it("writes nothing on unmount — closing without saving discards", () => {
    vi.useFakeTimers();
    try {
      const onDraftChange = vi.fn();
      const { container, unmount } = render(
        <RichTextEditor
          noteId="task-a"
          initialContent={DOC}
          onDraftChange={onDraftChange}
        />,
      );

      edit(container);
      const reported = onDraftChange.mock.calls.length;
      act(() => unmount());
      act(() => void vi.advanceTimersByTime(2000));
      // The unmount flush had nothing parked to flush, and no timer was armed.
      expect(onDraftChange).toHaveBeenCalledTimes(reported);
    } finally {
      vi.useRealTimers();
    }
  });

  it("writes nothing when the tab closes either", () => {
    const onDraftChange = vi.fn();
    const { container } = render(
      <RichTextEditor
        noteId="task-a"
        initialContent={DOC}
        onDraftChange={onDraftChange}
      />,
    );

    edit(container);
    const reported = onDraftChange.mock.calls.length;
    act(() => void window.dispatchEvent(new Event("beforeunload")));
    expect(onDraftChange).toHaveBeenCalledTimes(reported);
  });
});
