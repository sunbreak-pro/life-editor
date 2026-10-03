import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  within,
  waitFor,
} from "@testing-library/react";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { FormatToolbar } from "../src/notes/FormatToolbar";
import { RichTextEditor } from "../src/notes/RichTextEditor";

/*
 * #2060 — the formatting bar in the note header: H1, H2, bold, italic,
 * strikethrough, divider.
 *
 * A real headless Editor, like tableControls.test.tsx: what can go wrong is
 * what the commands do to the document and what the editor's selection says
 * is active, and a chain-recording stub would answer both by fiat.
 */

const LABELS = {
  label: "Formatting",
  heading1: "Heading 1",
  heading2: "Heading 2",
  bold: "Bold",
  italic: "Italic",
  strike: "Strikethrough",
  horizontalRule: "Insert divider",
};

const editors: Editor[] = [];

function makeEditor(editable = true): Editor {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    editable,
    extensions: [StarterKit],
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "hello world" }],
        },
        { type: "paragraph", content: [{ type: "text", text: "second" }] },
      ],
    },
  });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy();
});

/** The browser's own step before a click: focus the button, unless stopped. */
function press(button: HTMLElement) {
  const notPrevented = fireEvent.mouseDown(button);
  if (notPrevented) button.focus();
  // A pointer click follows its mousedown with detail 1.
  fireEvent.click(button, { detail: 1 });
  return notPrevented;
}

function button(name: string): HTMLElement {
  return screen.getByRole("button", { name });
}

/** Select the text range [from, to) of the document. */
function select(editor: Editor, from: number, to: number = from) {
  act(() => {
    editor.commands.setTextSelection({ from, to });
  });
}

function firstBlock(editor: Editor) {
  return editor.state.doc.firstChild!;
}

describe("FormatToolbar (#2060)", () => {
  it("offers exactly the six buttons, toggles marked as such", () => {
    const editor = makeEditor();
    render(<FormatToolbar editor={editor} labels={LABELS} />);

    const bar = screen.getByRole("toolbar", { name: "Formatting" });
    const buttons = within(bar).getAllByRole("button");
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Heading 1",
      "Heading 2",
      "Bold",
      "Italic",
      "Strikethrough",
      "Insert divider",
    ]);
    for (const b of buttons.slice(0, 5)) {
      expect(b.getAttribute("aria-pressed")).toBe("false");
    }
    // The divider inserts; it has no on / off state to report.
    expect(button("Insert divider").hasAttribute("aria-pressed")).toBe(false);
    // 44px touch floor below the breakpoint, Desktop keeps the 28px box.
    for (const b of buttons) {
      expect(b.classList.contains("max-md:min-h-11")).toBe(true);
      expect(b.classList.contains("max-md:min-w-11")).toBe(true);
      expect(b.classList.contains("h-7")).toBe(true);
    }
  });

  it("turns the caret's line into H1 and back into a paragraph", () => {
    const editor = makeEditor();
    render(<FormatToolbar editor={editor} labels={LABELS} />);
    select(editor, 3);

    press(button("Heading 1"));
    expect(firstBlock(editor).type.name).toBe("heading");
    expect(firstBlock(editor).attrs.level).toBe(1);
    expect(button("Heading 1").getAttribute("aria-pressed")).toBe("true");
    expect(button("Heading 2").getAttribute("aria-pressed")).toBe("false");

    // Pressing H1 on an H1 line toggles it off (decided for #2060).
    press(button("Heading 1"));
    expect(firstBlock(editor).type.name).toBe("paragraph");
    expect(button("Heading 1").getAttribute("aria-pressed")).toBe("false");
  });

  it("makes the line H2, and H1 replaces it rather than stacking", () => {
    const editor = makeEditor();
    render(<FormatToolbar editor={editor} labels={LABELS} />);
    select(editor, 3);

    press(button("Heading 2"));
    expect(firstBlock(editor).attrs.level).toBe(2);
    expect(button("Heading 2").getAttribute("aria-pressed")).toBe("true");

    press(button("Heading 1"));
    expect(firstBlock(editor).attrs.level).toBe(1);
    expect(button("Heading 2").getAttribute("aria-pressed")).toBe("false");
  });

  it.each([
    ["Bold", "bold"],
    ["Italic", "italic"],
    ["Strikethrough", "strike"],
  ])("puts %s on the selection and takes it off again", (name, mark) => {
    const editor = makeEditor();
    render(<FormatToolbar editor={editor} labels={LABELS} />);
    // "hello" — positions 1..6 in the first paragraph.
    select(editor, 1, 6);

    press(button(name));
    const hello = firstBlock(editor).firstChild!;
    expect(hello.text).toBe("hello");
    expect(hello.marks.map((m) => m.type.name)).toEqual([mark]);
    expect(button(name).getAttribute("aria-pressed")).toBe("true");
    // The selection survived the press.
    expect(editor.state.selection.from).toBe(1);
    expect(editor.state.selection.to).toBe(6);

    press(button(name));
    expect(firstBlock(editor).firstChild!.marks).toHaveLength(0);
    expect(button(name).getAttribute("aria-pressed")).toBe("false");
  });

  it("with no selection, applies the mark to what is typed next", () => {
    const editor = makeEditor();
    render(<FormatToolbar editor={editor} labels={LABELS} />);
    select(editor, 6);

    press(button("Bold"));
    expect(button("Bold").getAttribute("aria-pressed")).toBe("true");
    act(() => {
      editor.view.dispatch(editor.state.tr.insertText("X"));
    });
    let typed = null as null | { marks: string[] };
    editor.state.doc.descendants((node) => {
      if (node.isText && node.text === "X") {
        typed = { marks: node.marks.map((m) => m.type.name) };
      }
    });
    expect(typed).toEqual({ marks: ["bold"] });
  });

  it("inserts a divider at the caret", () => {
    const editor = makeEditor();
    render(<FormatToolbar editor={editor} labels={LABELS} />);
    select(editor, 12);

    press(button("Insert divider"));
    const names: string[] = [];
    editor.state.doc.forEach((node) => names.push(node.type.name));
    expect(names).toContain("horizontalRule");
  });

  it("follows the selection: pressed state moves with the caret", () => {
    const editor = makeEditor();
    editor.commands.setTextSelection(3);
    editor.commands.toggleHeading({ level: 1 });
    render(<FormatToolbar editor={editor} labels={LABELS} />);
    expect(button("Heading 1").getAttribute("aria-pressed")).toBe("true");

    // Into "second", the plain paragraph.
    select(editor, 16);
    expect(button("Heading 1").getAttribute("aria-pressed")).toBe("false");
  });

  it("keeps the focus in the document: the press is handled on mousedown", async () => {
    const editor = makeEditor();
    render(<FormatToolbar editor={editor} labels={LABELS} />);
    select(editor, 1, 6);
    // jsdom cannot focus ProseMirror's contenteditable, so the focus is read
    // from the call the command makes rather than from document.activeElement.
    const focus = vi.spyOn(editor.view, "focus");

    // The guard itself: an unprevented mousedown would move the focus onto
    // the button and take the selection with it.
    expect(fireEvent.mouseDown(button("Italic"))).toBe(false);
    expect(document.activeElement).not.toBe(button("Italic"));
    // TipTap hands the focus back on the next animation frame.
    await waitFor(() => expect(focus).toHaveBeenCalled());
    expect(editor.state.selection.from).toBe(1);
    expect(editor.state.selection.to).toBe(6);
    // The pointer click that follows does not run it a second time.
    fireEvent.click(button("Italic"), { detail: 1 });
    expect(
      firstBlock(editor).firstChild!.marks.map((m) => m.type.name),
    ).toEqual(["italic"]);
  });

  it("answers the keyboard too, once per press", () => {
    const editor = makeEditor();
    render(<FormatToolbar editor={editor} labels={LABELS} />);
    select(editor, 1, 6);

    // Enter / Space on a focused button: a click with detail 0, no mousedown.
    fireEvent.click(button("Bold"), { detail: 0 });
    expect(
      firstBlock(editor).firstChild!.marks.map((m) => m.type.name),
    ).toEqual(["bold"]);
  });

  it("is switched off for a locked body and for a read-only editor", () => {
    const editor = makeEditor();
    const { rerender } = render(
      <FormatToolbar editor={editor} disabled labels={LABELS} />,
    );
    select(editor, 1, 6);
    const before = editor.getJSON();
    for (const b of screen.getAllByRole("button")) {
      expect((b as HTMLButtonElement).disabled).toBe(true);
    }
    fireEvent.click(button("Bold"), { detail: 0 });
    expect(editor.getJSON()).toEqual(before);

    const readOnly = makeEditor(false);
    rerender(<FormatToolbar editor={readOnly} labels={LABELS} />);
    for (const b of screen.getAllByRole("button")) {
      expect((b as HTMLButtonElement).disabled).toBe(true);
    }

    // No editor at all (body not mounted yet).
    rerender(<FormatToolbar editor={null} labels={LABELS} />);
    for (const b of screen.getAllByRole("button")) {
      expect((b as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("does nothing while an IME conversion is open", () => {
    const editor = makeEditor();
    render(<FormatToolbar editor={editor} labels={LABELS} />);
    select(editor, 1, 6);
    const before = editor.getJSON();
    const composing = vi
      .spyOn(editor.view, "composing", "get")
      .mockReturnValue(true);

    expect(fireEvent.mouseDown(button("Bold"))).toBe(false);
    expect(editor.getJSON()).toEqual(before);
    composing.mockRestore();
  });
});

describe("RichTextEditor onEditorChange (#2060)", () => {
  it("hands the editor up once it exists and takes it back on unmount", () => {
    const onEditorChange = vi.fn();
    const { unmount } = render(
      <RichTextEditor
        noteId="note-1"
        onUpdate={() => {}}
        onEditorChange={onEditorChange}
      />,
    );
    expect(onEditorChange).toHaveBeenCalledTimes(1);
    expect(onEditorChange.mock.calls[0]![0]).toBeInstanceOf(Editor);

    unmount();
    expect(onEditorChange).toHaveBeenLastCalledWith(null);
  });
});
