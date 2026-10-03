import { describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  act,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import type { Editor } from "@tiptap/react";
import type {
  NoteBodySaveResult,
  NoteBodySnapshot,
  NoteNode,
} from "@life-editor/shared";
import { NoteBodyEditor, type NoteBodySync } from "../src/notes/NoteBodyEditor";
import { RichTextEditor } from "../src/notes/RichTextEditor";
import type { NoteLinking } from "../src/notes/hooks/useNoteLinking";

/*
 * #2057 — a note open in the app, updated through MCP, is no longer erased by
 * the next autosave. Drives the real TipTap editor in jsdom.
 *
 * The incident (2026-10-01): MCP ticked four checklist items in an open note;
 * three minutes later a keystroke's autosave wrote the editor's old body back,
 * unticking all four. Two halves of the fix are pinned here:
 *  - nothing pending → the body on screen follows the server (NOTE-SYNC-1),
 *    without moving the caret or poisoning Undo, and our own save's echo is
 *    not mistaken for news (NOTE-SYNC-2);
 *  - something pending → the banner, the difference view and the three
 *    choices (NOTE-SYNC-3), and a refused save keeps the typing (NOTE-SYNC-4).
 */

const p = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});
const doc = (...lines: string[]) =>
  JSON.stringify({ type: "doc", content: lines.map(p) });

const V0 = "2026-10-01T09:00:00+00:00";
const V1 = "2026-10-01T09:09:00+00:00";
const V2 = "2026-10-01T09:12:00+00:00";

function note(content: string): NoteNode {
  return {
    id: "note-1",
    type: "note",
    title: "Issue報告",
    content,
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: V0,
  };
}

const linking = {
  resolveTitle: vi.fn(),
  loadLinkTargets: undefined,
  handleResolvedLinkInserted: vi.fn(),
  handleBodySaved: vi.fn(),
  handleCreateNoteForLink: vi.fn(),
} as unknown as NoteLinking;

interface Server {
  content: string;
  updatedAt: string;
}

/**
 * A notes hook stand-in with a real server row behind it. `announce` is what
 * a Realtime-triggered list reload does: tell the editor a version exists.
 */
function harness(initial: string) {
  const server: Server = { content: initial, updatedAt: V0 };
  const control: { announce: (v: string) => void } = { announce: () => {} };
  const saveNoteBody = vi.fn(
    async (
      _id: string,
      content: string,
      expected: string | null,
    ): Promise<NoteBodySaveResult> => {
      if (expected !== server.updatedAt) {
        return { status: "conflict", current: { ...server } };
      }
      server.content = content;
      server.updatedAt = V2;
      return { status: "saved", updatedAt: V2 };
    },
  );
  const fetchNoteBodySnapshot = vi.fn(
    async (): Promise<NoteBodySnapshot | null> => ({ ...server }),
  );
  const adoptNoteBody = vi.fn();

  function Host() {
    const [stamp, setStamp] = useState(V0);
    control.announce = setStamp;
    const bodySync: NoteBodySync = {
      saveNoteBody,
      fetchNoteBodySnapshot,
      adoptNoteBody,
      serverStampOf: () => stamp,
    };
    return (
      <NoteBodyEditor
        note={note(initial)}
        linking={linking}
        bodySync={bodySync}
      />
    );
  }

  const view = render(<Host />);
  const editor = () => {
    const dom = view.container.querySelector(".tiptap") as
      (HTMLElement & { editor?: Editor }) | null;
    if (!dom?.editor) throw new Error("editor did not mount");
    return dom.editor;
  };
  /** Something written elsewhere, then the reload that announces it. */
  const writeElsewhere = (content: string) => {
    server.content = content;
    server.updatedAt = V1;
    act(() => control.announce(V1));
  };
  return {
    server,
    view,
    editor,
    writeElsewhere,
    saveNoteBody,
    fetchNoteBodySnapshot,
    adoptNoteBody,
    control,
  };
}

const paragraphs = (editor: Editor) =>
  (editor.getJSON().content ?? []).map((b) =>
    (b.content ?? []).map((t) => t.text ?? "").join(""),
  );

/** A real keystroke-shaped change at the end of the first paragraph. */
function typeInFirstLine(editor: Editor, text: string) {
  act(() => {
    editor.commands.insertContentAt(1 + paragraphs(editor)[0].length, text);
  });
}

describe("NOTE-SYNC-1 — nothing pending: the body follows the server", () => {
  it("shows the other device's body without a banner", async () => {
    const h = harness(doc("intro", "line"));
    h.writeElsewhere(doc("intro", "line ticked by MCP"));

    await waitFor(() =>
      expect(paragraphs(h.editor())).toEqual(["intro", "line ticked by MCP"]),
    );
    expect(screen.queryByTestId("note-conflict-banner")).toBeNull();
    expect(h.adoptNoteBody).toHaveBeenCalledWith(
      "note-1",
      doc("intro", "line ticked by MCP"),
    );
    // Showing the server's body is not an edit: nothing is saved back.
    expect(h.saveNoteBody).not.toHaveBeenCalled();
  });

  it("keeps the caret where it was and keeps Undo on the user's own typing", async () => {
    const h = harness(doc("intro", "line"));
    typeInFirstLine(h.editor(), "!");
    await waitFor(() => expect(h.saveNoteBody).toHaveBeenCalled(), {
      timeout: 3000,
    });
    await waitFor(() => expect(h.server.content).toBe(doc("intro!", "line")));
    act(() => {
      h.editor().commands.setTextSelection(3); // inside "intro!"
    });

    // Our save left the server at V2; somebody else writes on top of it.
    h.server.content = doc("intro!", "line from elsewhere");
    h.server.updatedAt = V1;
    act(() => h.control.announce(V1));
    await waitFor(() =>
      expect(paragraphs(h.editor())).toEqual(["intro!", "line from elsewhere"]),
    );

    expect(h.editor().state.selection.from).toBe(3);
    act(() => {
      h.editor().commands.undo();
    });
    // Undo takes back the "!" the user typed — not the other device's write.
    expect(paragraphs(h.editor())).toEqual(["intro", "line from elsewhere"]);
  });
});

describe("NOTE-SYNC-2 — our own save's echo", () => {
  it("does not re-read or replace anything", async () => {
    const h = harness(doc("intro", "line"));
    typeInFirstLine(h.editor(), "?");
    await waitFor(() => expect(h.saveNoteBody).toHaveBeenCalled(), {
      timeout: 3000,
    });
    await waitFor(() => expect(h.server.updatedAt).toBe(V2));
    // The one read is the check made when the note opened.
    const readsBefore = h.fetchNoteBodySnapshot.mock.calls.length;

    act(() => h.control.announce(V2));
    await act(async () => {});

    expect(h.fetchNoteBodySnapshot.mock.calls.length).toBe(readsBefore);
    expect(paragraphs(h.editor())).toEqual(["intro?", "line"]);
  });
});

describe("NOTE-SYNC-3 — something pending: banner, differences, three choices", () => {
  async function conflicted() {
    const h = harness(doc("intro", "line"));
    typeInFirstLine(h.editor(), " mine");
    // Inside the 800ms debounce: the typing is not saved yet.
    h.writeElsewhere(doc("intro", "line ticked by MCP"));
    await screen.findByTestId("note-conflict-banner");
    return h;
  }

  it("raises the banner instead of replacing, and holds the save", async () => {
    const h = await conflicted();
    expect(paragraphs(h.editor())).toEqual(["intro mine", "line"]);
    await new Promise((r) => setTimeout(r, 900)); // past the debounce
    expect(h.saveNoteBody).not.toHaveBeenCalled();
    expect(h.server.content).toBe(doc("intro", "line ticked by MCP"));
  });

  it("shows the block-level differences on request", async () => {
    await conflicted();
    fireEvent.click(screen.getByRole("button", { name: "Show differences" }));
    const banner = within(screen.getByTestId("note-conflict-banner"));
    expect(banner.getByText("intro mine")).toBeTruthy();
    expect(banner.getByText("line ticked by MCP")).toBeTruthy();
  });

  it("keep mine → my body is saved over the other version", async () => {
    const h = await conflicted();
    fireEvent.click(screen.getByRole("button", { name: "Keep my changes" }));
    await waitFor(() =>
      expect(h.server.content).toBe(doc("intro mine", "line")),
    );
    expect(screen.queryByTestId("note-conflict-banner")).toBeNull();
  });

  it("use the other version → the editor shows it and nothing is saved", async () => {
    const h = await conflicted();
    fireEvent.click(
      screen.getByRole("button", { name: "Use the other version" }),
    );
    await waitFor(() =>
      expect(paragraphs(h.editor())).toEqual(["intro", "line ticked by MCP"]),
    );
    await new Promise((r) => setTimeout(r, 900));
    expect(h.saveNoteBody).not.toHaveBeenCalled();
  });

  it("keep both → each side's change, merged block by block, is shown and saved", async () => {
    const h = await conflicted();
    fireEvent.click(screen.getByRole("button", { name: "Keep both" }));
    await waitFor(() =>
      expect(paragraphs(h.editor())).toEqual([
        "intro mine",
        "line ticked by MCP",
      ]),
    );
    await waitFor(() =>
      expect(h.server.content).toBe(doc("intro mine", "line ticked by MCP")),
    );
  });
});

describe("NOTE-SYNC-4 — a save built on an old version", () => {
  it("is refused, keeps the typing on screen, and asks", async () => {
    const h = harness(doc("intro", "line"));
    // The other write lands with no announcement yet (the reload is late).
    h.server.content = doc("intro", "line ticked by MCP");
    h.server.updatedAt = V1;
    typeInFirstLine(h.editor(), " mine");

    await screen.findByTestId("note-conflict-banner", undefined, {
      timeout: 3000,
    });
    expect(h.server.content).toBe(doc("intro", "line ticked by MCP"));
    expect(paragraphs(h.editor())).toEqual(["intro mine", "line"]);
  });
});

describe("IME — a write from elsewhere arriving mid-composition", () => {
  it("does not overwrite what the composition committed, and asks instead", async () => {
    const h = harness(doc("intro", "line"));
    // Let the open-time check settle so the next read is the write's.
    await waitFor(() => expect(h.fetchNoteBodySnapshot).toHaveBeenCalled());
    const editor = h.editor();
    const input = (editor.view as unknown as { input: { composing: boolean } })
      .input;
    input.composing = true;

    // Nothing pending, so the session decides to replace — but the editor is
    // mid-composition and holds the replacement.
    h.writeElsewhere(doc("intro", "line ticked by MCP"));
    await act(async () => {});
    expect(paragraphs(editor)).toEqual(["intro", "line"]);

    // The composition commits text: a real document change.
    typeInFirstLine(editor, "こうだい");
    input.composing = false;
    act(() => {
      editor.view.dom.dispatchEvent(new CompositionEvent("compositionend"));
    });

    // The replacement does not go in over the committed text…
    await screen.findByTestId("note-conflict-banner", undefined, {
      timeout: 3000,
    });
    expect(paragraphs(editor)).toEqual(["introこうだい", "line"]);
    // …and the typing is not saved on top of the other side's write.
    await new Promise((r) => setTimeout(r, 900));
    expect(h.server.content).toBe(doc("intro", "line ticked by MCP"));
  });
});

describe("IME — a replacement waits for the composition to end", () => {
  it("does not touch the document mid-composition", async () => {
    function Host({ seq }: { seq: number }) {
      return (
        <RichTextEditor
          noteId="note-ime"
          initialContent={doc("候補")}
          onUpdate={() => {}}
          replaceContent={
            seq === 0 ? null : { content: doc("候補", "from elsewhere"), seq }
          }
        />
      );
    }
    const view = render(<Host seq={0} />);
    const dom = view.container.querySelector(".tiptap") as HTMLElement & {
      editor: Editor;
    };
    const editor = dom.editor;
    const input = (editor.view as unknown as { input: { composing: boolean } })
      .input;
    input.composing = true;

    view.rerender(<Host seq={1} />);
    expect(paragraphs(editor)).toEqual(["候補"]);

    input.composing = false;
    act(() => {
      dom.dispatchEvent(new CompositionEvent("compositionend"));
    });
    await waitFor(() =>
      expect(paragraphs(editor)).toEqual(["候補", "from elsewhere"]),
    );
  });
});
