import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { RichTextEditor } from "../src/notes/RichTextEditor";
import { TableControls } from "../src/notes/TableControls";
import { createTableNodes, tableNameOf } from "../src/notes/tableNodes";

/*
 * #2011 — a table carries a name.
 *
 * The name is an attribute on the `table` node, drawn above the grid by the
 * node view and edited from TableControls' field. What has to hold:
 *
 *   - a table with no name (every table before #2011, every MCP table) still
 *     opens, draws no caption, and saves without growing a name;
 *   - a name typed in the field lands on the node and survives a save;
 *   - the caption follows the attribute, including back to nothing.
 */

const LABELS = {
  label: "Table controls",
  rowGroup: "Row",
  columnGroup: "Column",
  addRowAbove: "Add row above",
  addRow: "Add row below",
  addColumnLeft: "Add column left",
  addColumn: "Add column right",
  deleteRow: "Delete row",
  deleteColumn: "Delete column",
  deleteTable: "Delete table",
  addAbove: "Above",
  addBelow: "Below",
  addLeft: "Left",
  addRight: "Right",
  remove: "Delete",
  nameLabel: "Table name",
  namePlaceholder: "Name this table",
};

/** The MCP builder's shape (tiptapJsonBuilder.table()), optionally named. */
function docWithTable(name?: string) {
  const cell = (type: string, text: string) => ({
    type,
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
  return JSON.stringify({
    type: "doc",
    content: [
      {
        type: "table",
        ...(name === undefined ? {} : { attrs: { name } }),
        content: [
          {
            type: "tableRow",
            content: [cell("tableHeader", "Day"), cell("tableHeader", "Focus")],
          },
          {
            type: "tableRow",
            content: [cell("tableCell", "Mon"), cell("tableCell", "Sync")],
          },
        ],
      },
      { type: "paragraph", content: [{ type: "text", text: "after" }] },
    ],
  });
}

function makeEditor(content: string): Editor {
  const element = document.createElement("div");
  document.body.appendChild(element);
  return new Editor({
    element,
    extensions: [StarterKit, ...createTableNodes()],
    content: JSON.parse(content),
  });
}

/** Put the caret in the first cell, the way a click there would. */
function caretInTable(editor: Editor) {
  let cellPos = -1;
  editor.state.doc.descendants((node, pos) => {
    if (cellPos < 0 && node.type.name === "tableHeader") cellPos = pos;
  });
  act(() => {
    editor.commands.setTextSelection(cellPos + 2);
  });
}

function firstTable(editor: Editor) {
  let found = null as Parameters<typeof tableNameOf>[0];
  editor.state.doc.descendants((node) => {
    if (!found && node.type.name === "table") found = node;
  });
  return found;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("table name (#2011)", () => {
  it("opens an unnamed table with no caption and saves it without a name", () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();
    const { container } = render(
      <RichTextEditor
        noteId="note-1"
        initialContent={docWithTable()}
        onUpdate={onUpdate}
      />,
    );

    expect(container.textContent).toContain("Sync");
    const caption = container.querySelector<HTMLElement>(".note-table-name");
    expect(caption?.hidden).toBe(true);

    // A real edit, then the 800ms autosave.
    const dom = container.querySelector<HTMLElement>(".tiptap");
    act(() => {
      dom?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    act(() => void vi.advanceTimersByTime(800));

    const saved = JSON.parse(onUpdate.mock.calls.at(-1)?.[0] as string);
    const table = saved.content.find(
      (n: { type: string }) => n.type === "table",
    );
    expect(table).toBeDefined();
    expect(table.attrs?.name ?? null).toBeNull();
  });

  it("draws a stored name above the grid", async () => {
    const { container } = render(
      <RichTextEditor
        noteId="note-1"
        initialContent={docWithTable("Weekly plan")}
        onUpdate={() => {}}
      />,
    );
    await waitFor(() => expect(container.querySelector("table")).toBeTruthy());

    const caption = container.querySelector<HTMLElement>(
      ".tableWrapper > .note-table-name",
    );
    expect(caption?.hidden).toBe(false);
    expect(caption?.textContent).toBe("Weekly plan");
    // The caption is not document text: the cells are still the only content.
    expect(caption?.getAttribute("contenteditable")).toBe("false");
  });

  it("writes the field's name onto the table on Enter", () => {
    const editor = makeEditor(docWithTable());
    try {
      render(<TableControls editor={editor} labels={LABELS} />);
      caretInTable(editor);

      const field = screen.getByRole("textbox", { name: "Table name" });
      fireEvent.change(field, { target: { value: "  Weekly plan " } });
      // Typing writes nothing yet — one name, one undo step.
      expect(tableNameOf(firstTable(editor))).toBeNull();

      fireEvent.keyDown(field, { key: "Enter" });
      expect(tableNameOf(firstTable(editor))).toBe("Weekly plan");
      expect(
        editor.view.dom.querySelector(".note-table-name")?.textContent,
      ).toBe("Weekly plan");
    } finally {
      editor.destroy();
    }
  });

  it("leaves an IME conversion's Enter to the conversion", () => {
    const editor = makeEditor(docWithTable());
    try {
      render(<TableControls editor={editor} labels={LABELS} />);
      caretInTable(editor);

      const field = screen.getByRole("textbox", { name: "Table name" });
      fireEvent.change(field, { target: { value: "週次" } });
      fireEvent.keyDown(field, { key: "Enter", isComposing: true });
      expect(tableNameOf(firstTable(editor))).toBeNull();
    } finally {
      editor.destroy();
    }
  });

  it("clears the name when the field is emptied, on leaving it", () => {
    const editor = makeEditor(docWithTable("Weekly plan"));
    try {
      render(<TableControls editor={editor} labels={LABELS} />);
      caretInTable(editor);

      const field = screen.getByRole("textbox", { name: "Table name" });
      expect((field as HTMLInputElement).value).toBe("Weekly plan");
      fireEvent.change(field, { target: { value: "   " } });
      fireEvent.blur(field);

      expect(tableNameOf(firstTable(editor))).toBeNull();
      expect(firstTable(editor)?.attrs.name).toBeNull();
      expect(
        editor.view.dom.querySelector<HTMLElement>(".note-table-name")?.hidden,
      ).toBe(true);
    } finally {
      editor.destroy();
    }
  });

  it("drops the draft on Escape, even through the blur that follows", () => {
    const editor = makeEditor(docWithTable());
    try {
      render(<TableControls editor={editor} labels={LABELS} />);
      caretInTable(editor);

      const field = screen.getByRole("textbox", { name: "Table name" });
      fireEvent.focus(field);
      fireEvent.change(field, { target: { value: "Abandoned" } });
      fireEvent.keyDown(field, { key: "Escape" });
      // Handing the focus back to the document blurs the field.
      fireEvent.blur(field);

      expect(tableNameOf(firstTable(editor))).toBeNull();
    } finally {
      editor.destroy();
    }
  });

  it("round-trips the name through HTML as data-name", () => {
    const editor = makeEditor(docWithTable("Weekly plan"));
    try {
      const html = editor.getHTML();
      expect(html).toContain('data-name="Weekly plan"');

      editor.commands.setContent(html);
      expect(tableNameOf(firstTable(editor))).toBe("Weekly plan");
    } finally {
      editor.destroy();
    }
  });
});
