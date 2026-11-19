import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { RichTextEditor } from "../src/notes/RichTextEditor";
import { TableControls } from "../src/notes/TableControls";
import { createTableNodes } from "../src/notes/tableNodes";

/*
 * #2761 removed tagging a table in a note (#2094). Bodies saved while it
 * existed can still carry a `tableId` attribute on a table node, and the
 * editor no longer declares it. RichTextEditor sets `enableContentCheck`, so
 * an attribute the schema rejected would empty the whole body on open and the
 * autosave would write that empty body back. These pin that the stale
 * attribute is dropped quietly instead, and that the bar has no tag row.
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

/** tiptapJsonBuilder.table()'s shape, with the attributes given. */
function docWithTable(attrs: Record<string, unknown>) {
  const cell = (type: string, text: string) => ({
    type,
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
  return JSON.stringify({
    type: "doc",
    content: [
      {
        type: "table",
        attrs,
        content: [
          {
            type: "tableRow",
            content: [cell("tableHeader", "Item"), cell("tableHeader", "Cost")],
          },
          {
            type: "tableRow",
            content: [cell("tableCell", "Rent"), cell("tableCell", "900")],
          },
        ],
      },
      { type: "paragraph", content: [{ type: "text", text: "after" }] },
    ],
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("a body saved with a table's old tableId (#2761)", () => {
  it("opens with its cells and name, and saves without the attribute", () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();
    const { container } = render(
      <RichTextEditor
        noteId="note-1"
        initialContent={docWithTable({ tableId: "table-1", name: "Budget" })}
        onUpdate={onUpdate}
      />,
    );
    expect(container.textContent).toContain("Rent");
    expect(container.textContent).toContain("after");
    expect(
      container.querySelector<HTMLElement>(".note-table-name")?.textContent,
    ).toBe("Budget");

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
    expect(table.attrs).not.toHaveProperty("tableId");
    expect(table.attrs?.name).toBe("Budget");
    expect(JSON.stringify(table)).toContain("Rent");
  });

  it("shows the bar without a tag row", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    const editor = new Editor({
      element,
      extensions: [StarterKit, ...createTableNodes()],
      content: JSON.parse(docWithTable({ tableId: "table-1" })),
    });
    try {
      render(<TableControls editor={editor} labels={LABELS} />);
      let cellPos = -1;
      editor.state.doc.descendants((node, pos) => {
        if (cellPos < 0 && node.type.name === "tableHeader") cellPos = pos;
      });
      act(() => {
        editor.commands.setTextSelection(cellPos + 2);
      });
      expect(
        screen.getByRole("toolbar", { name: "Table controls" }),
      ).toBeTruthy();
      expect(screen.queryByRole("group", { name: "Tags" })).toBeNull();
      expect(
        document.querySelector('[data-table-action="add-tags"]'),
      ).toBeNull();
    } finally {
      editor.destroy();
    }
  });
});
