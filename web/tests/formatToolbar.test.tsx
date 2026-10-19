import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  within,
  waitFor,
} from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { NOTE_STICKY_HEADER_HEIGHT_VAR } from "@life-editor/shared";
import StarterKit from "@tiptap/starter-kit";
import {
  FORMAT_BUBBLE_OPTIONS,
  FormatBubbleMenu,
  FormatToolbar,
} from "../src/notes/FormatToolbar";
import { RichTextEditor } from "../src/notes/RichTextEditor";

/*
 * #2060 — the note body's formatting buttons: H1, H2, bold, italic,
 * strikethrough, divider. Since #2227 they float over the selected text
 * (FormatBubbleMenu, at the end of this file) instead of sitting in the
 * note header.
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
  itemLink: "Link to an item",
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
  // Without the "[[" extension there is no picker, so no link button (#2288).
  it("offers exactly the six format buttons, toggles marked as such", () => {
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
    // #2288: a 24px box and a 14px icon on Desktop; below the breakpoint the
    // box keeps the 44px touch floor (#1512).
    for (const b of buttons) {
      expect(b.classList.contains("max-md:min-h-11")).toBe(true);
      expect(b.classList.contains("max-md:min-w-11")).toBe(true);
      expect(b.classList.contains("h-6")).toBe(true);
      expect(b.classList.contains("w-6")).toBe(true);
      expect(b.querySelector("svg")?.getAttribute("width")).toBe("14");
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

/*
 * #2227 — the same six buttons, floating over the selection instead of
 * sitting in the header. jsdom has no layout, so where the bar lands is not
 * pinned here; what is pinned is when it is in the document, that its
 * buttons format the selection, and the IME guard.
 */
describe("FormatBubbleMenu (#2227)", () => {
  // jsdom implements neither on Range; Floating UI measures the selection
  // through them. Zero rects are enough — positions are not under test.
  const zeroRect = () => new DOMRect(0, 0, 0, 0);
  const emptyRects = () => [] as unknown as DOMRectList;
  beforeAll(() => {
    Range.prototype.getBoundingClientRect ??= zeroRect;
    Range.prototype.getClientRects ??= emptyRects;
  });

  /** jsdom cannot focus ProseMirror's contenteditable (see above). */
  function focusBody(editor: Editor) {
    vi.spyOn(editor.view, "hasFocus").mockReturnValue(true);
  }

  function bubble(): HTMLElement | null {
    return document.querySelector<HTMLElement>("[data-format-bubble]");
  }

  /** The bar is in the document and the plugin has made it visible. */
  function shown(): boolean {
    const el = bubble();
    return el !== null && el.isConnected && el.style.visibility === "visible";
  }

  it("appears over a text selection and goes when it collapses", async () => {
    const editor = makeEditor();
    focusBody(editor);
    render(<FormatBubbleMenu editor={editor} labels={LABELS} />);
    expect(shown()).toBe(false);

    select(editor, 1, 6);
    await waitFor(() => expect(shown()).toBe(true));
    const bar = within(bubble()!).getByRole("toolbar", { name: "Formatting" });
    expect(
      within(bar)
        .getAllByRole("button")
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual([
      "Heading 1",
      "Heading 2",
      "Bold",
      "Italic",
      "Strikethrough",
      "Insert divider",
    ]);

    select(editor, 3);
    await waitFor(() => expect(shown()).toBe(false));
  });

  it.each([
    ["Bold", "bold"],
    ["Italic", "italic"],
    ["Strikethrough", "strike"],
  ])(
    "puts %s on the selected text from the floating bar",
    async (name, mark) => {
      const editor = makeEditor();
      focusBody(editor);
      render(<FormatBubbleMenu editor={editor} labels={LABELS} />);
      select(editor, 1, 6);
      await waitFor(() => expect(shown()).toBe(true));

      expect(press(button(name))).toBe(false);
      expect(
        firstBlock(editor).firstChild!.marks.map((m) => m.type.name),
      ).toEqual([mark]);
    },
  );

  it.each([
    ["Heading 1", 1],
    ["Heading 2", 2],
  ])("turns the selected line into %s", async (name, level) => {
    const editor = makeEditor();
    focusBody(editor);
    render(<FormatBubbleMenu editor={editor} labels={LABELS} />);
    select(editor, 1, 6);
    await waitFor(() => expect(shown()).toBe(true));

    press(button(name));
    expect(firstBlock(editor).type.name).toBe("heading");
    expect(firstBlock(editor).attrs.level).toBe(level);
  });

  it("inserts a divider from the floating bar", async () => {
    const editor = makeEditor();
    focusBody(editor);
    render(<FormatBubbleMenu editor={editor} labels={LABELS} />);
    select(editor, 1, 6);
    await waitFor(() => expect(shown()).toBe(true));

    press(button("Insert divider"));
    const names: string[] = [];
    editor.state.doc.forEach((node) => names.push(node.type.name));
    expect(names).toContain("horizontalRule");
  });

  it("does nothing while an IME conversion is open", async () => {
    const editor = makeEditor();
    focusBody(editor);
    render(<FormatBubbleMenu editor={editor} labels={LABELS} />);
    select(editor, 1, 6);
    await waitFor(() => expect(shown()).toBe(true));
    const before = editor.getJSON();
    const composing = vi
      .spyOn(editor.view, "composing", "get")
      .mockReturnValue(true);

    expect(fireEvent.mouseDown(button("Bold"))).toBe(false);
    fireEvent.click(button("Bold"), { detail: 0 });
    expect(editor.getJSON()).toEqual(before);
    composing.mockRestore();
  });

  it("stays away without the focus, over a locked body and on a read-only one", async () => {
    const unfocused = makeEditor();
    const { unmount } = render(
      <FormatBubbleMenu editor={unfocused} labels={LABELS} />,
    );
    select(unfocused, 1, 6);
    await new Promise((r) => setTimeout(r, 300));
    expect(shown()).toBe(false);
    unmount();

    const locked = makeEditor();
    focusBody(locked);
    const second = render(
      <FormatBubbleMenu editor={locked} disabled labels={LABELS} />,
    );
    select(locked, 1, 6);
    await new Promise((r) => setTimeout(r, 300));
    expect(shown()).toBe(false);
    second.unmount();

    const readOnly = makeEditor(false);
    focusBody(readOnly);
    render(<FormatBubbleMenu editor={readOnly} labels={LABELS} />);
    select(readOnly, 1, 6);
    await new Promise((r) => setTimeout(r, 300));
    expect(shown()).toBe(false);
  });

  it("renders nothing until there is an editor", () => {
    const { container } = render(
      <FormatBubbleMenu editor={null} labels={LABELS} />,
    );
    expect(container.innerHTML).toBe("");
    expect(bubble()).toBeNull();
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

/*
 * #2288 — the seventh button: link the selected text to an item. The picker
 * is the "[[" extension's (openItemLinkPicker), so the body is a real
 * RichTextEditor with a link pool — the only editor that registers it.
 */
describe("FormatToolbar — link the selection to an item (#2288)", () => {
  const zeroRect = () => new DOMRect(0, 0, 0, 0);
  const emptyRects = () => [] as unknown as DOMRectList;
  beforeAll(() => {
    Range.prototype.getBoundingClientRect ??= zeroRect;
    Range.prototype.getClientRects ??= emptyRects;
  });

  const TARGETS = [
    { id: "note-roof", label: "Roof repair", role: "note" },
    { id: "task-9", label: "Call the roofer", role: "task" },
    { id: "note-old", label: "Roof (old)", role: "note", isDeleted: true },
  ];
  const BODY = JSON.stringify({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "hello world" }] },
      { type: "paragraph", content: [{ type: "text", text: "second" }] },
    ],
  });

  function mountBody(onInserted = vi.fn()) {
    let editor: Editor | null = null;
    const load = vi.fn(() => Promise.resolve(TARGETS));
    render(
      <RichTextEditor
        noteId="note-1"
        initialContent={BODY}
        onUpdate={() => {}}
        loadLinkTargets={load}
        onResolvedLinkInserted={onInserted}
        onEditorChange={(e) => {
          editor = e;
        }}
      />,
    );
    if (editor === null) throw new Error("no editor");
    render(<FormatToolbar editor={editor} labels={LABELS} />);
    return { editor: editor as Editor, onInserted, load };
  }

  function picker(): HTMLElement | null {
    return document.querySelector<HTMLElement>("[data-suggestion-menu]");
  }

  it("is not drawn for a body without a link pool", () => {
    render(<FormatToolbar editor={makeEditor()} labels={LABELS} />);
    expect(screen.queryByRole("button", { name: LABELS.itemLink })).toBeNull();
  });

  it("swaps the selected text for a link labelled with it, and Undo brings the text back", async () => {
    const { editor, onInserted } = mountBody();
    select(editor, 1, 6); // "hello"

    press(button(LABELS.itemLink));
    const search = await within(
      await waitFor(() => {
        const el = picker();
        if (el === null) throw new Error("no picker yet");
        return el;
      }),
    ).findByRole("searchbox");
    // The trash stays out of the offer, as under "[[".
    expect(within(picker()!).queryByText("Roof (old)")).toBeNull();

    fireEvent.change(search, { target: { value: "roof rep" } });
    const options = within(picker()!).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining("Roof repair"),
    ]);
    fireEvent.mouseDown(options[0]!);

    const first = firstBlock(editor);
    expect(first.firstChild?.type.name).toBe("itemLink");
    expect(first.firstChild?.attrs).toMatchObject({
      targetId: "note-roof",
      label: "hello",
      role: "note",
    });
    expect(first.textContent).toBe(" world");
    expect(onInserted).toHaveBeenCalledExactlyOnceWith("note-roof");
    expect(picker()).toBeNull();

    act(() => {
      editor.commands.undo();
    });
    expect(firstBlock(editor).textContent).toBe("hello world");
    expect(firstBlock(editor).firstChild?.type.name).toBe("text");
  });

  it("picks the highlighted row with Enter and closes on Escape", async () => {
    const { editor, onInserted } = mountBody();

    select(editor, 1, 6);
    press(button(LABELS.itemLink));
    let search = await screen.findByRole("searchbox");
    fireEvent.keyDown(search, { key: "Escape" });
    expect(picker()).toBeNull();
    expect(firstBlock(editor).textContent).toBe("hello world");

    select(editor, 7, 12); // "world"
    press(button(LABELS.itemLink));
    search = await screen.findByRole("searchbox");
    fireEvent.change(search, { target: { value: "roofer" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(firstBlock(editor).lastChild?.attrs).toMatchObject({
      targetId: "task-9",
      label: "world",
    });
    expect(onInserted).toHaveBeenCalledExactlyOnceWith("task-9");
  });

  it("ignores an Enter that commits an IME conversion in the search field", async () => {
    const { editor, onInserted } = mountBody();
    select(editor, 1, 6);
    press(button(LABELS.itemLink));
    const search = await screen.findByRole("searchbox");

    fireEvent.keyDown(search, { key: "Enter", isComposing: true });
    fireEvent.keyDown(search, { key: "Enter", keyCode: 229 });
    expect(onInserted).not.toHaveBeenCalled();
    expect(picker()).not.toBeNull();
  });

  it("is off for a selection across two paragraphs", () => {
    const { editor } = mountBody();
    select(editor, 3, 16);
    expect(button(LABELS.itemLink).hasAttribute("disabled")).toBe(true);
    select(editor, 1, 6);
    expect(button(LABELS.itemLink).hasAttribute("disabled")).toBe(false);
  });

  it("does nothing while an IME conversion is open", async () => {
    const { editor, load } = mountBody();
    select(editor, 1, 6);
    const composing = vi
      .spyOn(editor.view, "composing", "get")
      .mockReturnValue(true);
    press(button(LABELS.itemLink));
    composing.mockRestore();
    // The picker opens only after its pool loads, so the load not starting
    // is what says the press was ignored.
    await act(async () => {
      await Promise.resolve();
    });
    expect(load).not.toHaveBeenCalled();
    expect(picker()).toBeNull();
  });
});

/*
 * #2288 — the bar floats above the selection at both widths (narrow used to
 * put it below). Where it lands cannot be measured in jsdom, so what is
 * pinned is what Floating UI is asked for: "top" first, and a flip below that
 * counts the note's sticky header as taken room.
 */
describe("FormatBubbleMenu placement (#2288)", () => {
  it("prefers the side above the selection and flips below without room", () => {
    expect(FORMAT_BUBBLE_OPTIONS.placement).toBe("top");
    const flip = FORMAT_BUBBLE_OPTIONS.flip;
    expect(typeof flip).toBe("function");
    const floating = document.createElement("div");
    floating.style.setProperty(NOTE_STICKY_HEADER_HEIGHT_VAR, "60px");
    document.body.appendChild(floating);
    const options = (flip as (state: unknown) => { padding: { top: number } })({
      elements: { floating },
    });
    floating.remove();
    expect(options.padding.top).toBe(68);
  });
});
