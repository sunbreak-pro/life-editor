import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  renderHook,
  waitFor,
} from "@testing-library/react";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Slice } from "@tiptap/pm/model";
import { RichTextEditor } from "../src/notes/RichTextEditor";
import {
  TableControls,
  type TableTagsWiring,
} from "../src/notes/TableControls";
import {
  createTableNodes,
  stripTableIds,
  tableIdOf,
} from "../src/notes/tableNodes";
import { useNoteTableItems } from "../src/notes/hooks/useNoteTableItems";
import { stubDataService } from "./helpers";

/*
 * #2094 (plan Step 4) — a note's table can become a tag-able item.
 *
 * What has to hold in the editor:
 *   - a table with no `tableId` (every table before #2094, and every table
 *     generate_content writes) still opens and saves without growing one;
 *   - a pasted or dropped table loses its `tableId`, so two tables never
 *     point at one item;
 *   - the bar's "add tags" makes the item and writes its id onto the table,
 *     outside the undo history, and from then on shows that item's tags;
 *   - after a save the host asks the service to bring the items in line with
 *     the body — including the save that removed a table, and the one that
 *     brought it back with Undo.
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

/** tiptapJsonBuilder.table()'s shape — no attrs at all — or with some. */
function docWithTable(attrs?: Record<string, unknown>) {
  const cell = (type: string, text: string) => ({
    type,
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
  return JSON.stringify({
    type: "doc",
    content: [
      {
        type: "table",
        ...(attrs === undefined ? {} : { attrs }),
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

function makeEditor(content: string): Editor {
  const element = document.createElement("div");
  document.body.appendChild(element);
  return new Editor({
    element,
    extensions: [StarterKit, ...createTableNodes()],
    content: JSON.parse(content),
  });
}

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
  let found = null as Parameters<typeof tableIdOf>[0];
  editor.state.doc.descendants((node) => {
    if (!found && node.type.name === "table") found = node;
  });
  return found;
}

function wiring(over: Partial<TableTagsWiring> = {}): TableTagsWiring {
  return {
    makeItem: vi.fn(async () => "table-new"),
    renderTags: (id) => <span data-testid="tag-row">tags of {id}</span>,
    labels: { group: "Tags", addTags: "Add tags", adding: "Adding…" },
    ...over,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("tableId attribute (#2094)", () => {
  it("opens a table without tableId and saves it without one", () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();
    const { container } = render(
      <RichTextEditor
        noteId="note-1"
        initialContent={docWithTable()}
        onUpdate={onUpdate}
      />,
    );
    // enableContentCheck would have emptied the body on an unknown attribute.
    expect(container.textContent).toContain("Rent");

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
    expect(table.attrs?.tableId ?? null).toBeNull();
  });

  it("keeps a stored tableId through open and read-back", () => {
    const editor = makeEditor(docWithTable({ tableId: "table-1", name: "B" }));
    try {
      expect(tableIdOf(firstTable(editor))).toBe("table-1");
      const json = editor.getJSON();
      expect(json.content?.[0].attrs?.tableId).toBe("table-1");
    } finally {
      editor.destroy();
    }
  });

  it("strips tableId from a pasted slice, nested or not", () => {
    const editor = makeEditor(docWithTable({ tableId: "table-1" }));
    try {
      const doc = editor.state.doc;
      const slice = new Slice(doc.content, 0, 0);
      const stripped = stripTableIds(slice);
      let ids = 0;
      stripped.content.descendants((node) => {
        if (node.type.name === "table" && tableIdOf(node) !== null) ids += 1;
      });
      expect(ids).toBe(0);
      // The cells come through untouched.
      expect(stripped.content.textBetween(0, stripped.content.size)).toContain(
        "Rent",
      );
      // A slice with nothing to strip is handed back as is.
      const plain = new Slice(
        makeEditor(docWithTable()).state.doc.content,
        0,
        0,
      );
      expect(stripTableIds(plain)).toBe(plain);
    } finally {
      editor.destroy();
    }
  });

  it("drops tableId when a table is pasted as HTML", () => {
    const editor = makeEditor(docWithTable({ tableId: "table-1" }));
    try {
      const html = editor.getHTML();
      expect(html).not.toContain("table-1");
    } finally {
      editor.destroy();
    }
  });
});

describe("TableControls tag row (#2094)", () => {
  it("has no tag row without the wiring (Daily / todo bodies)", () => {
    const editor = makeEditor(docWithTable());
    try {
      render(<TableControls editor={editor} labels={LABELS} />);
      caretInTable(editor);
      expect(screen.queryByRole("group", { name: "Tags" })).toBeNull();
    } finally {
      editor.destroy();
    }
  });

  it("makes the item and writes its id onto the table, outside the undo history", async () => {
    const editor = makeEditor(docWithTable({ name: "Budget" }));
    const tags = wiring();
    try {
      render(<TableControls editor={editor} labels={LABELS} tags={tags} />);
      caretInTable(editor);

      fireEvent.click(screen.getByRole("button", { name: "Add tags" }));
      await waitFor(() =>
        expect(tableIdOf(firstTable(editor))).toBe("table-new"),
      );
      expect(tags.makeItem).toHaveBeenCalledWith("Budget");
      // The row is now that item's tag picker.
      expect(screen.getByTestId("tag-row").textContent).toBe(
        "tags of table-new",
      );

      act(() => {
        editor.commands.undo();
      });
      expect(tableIdOf(firstTable(editor))).toBe("table-new");
    } finally {
      editor.destroy();
    }
  });

  it("leaves the table alone when the item could not be made", async () => {
    const editor = makeEditor(docWithTable());
    const tags = wiring({ makeItem: vi.fn(async () => null) });
    try {
      render(<TableControls editor={editor} labels={LABELS} tags={tags} />);
      caretInTable(editor);

      fireEvent.click(screen.getByRole("button", { name: "Add tags" }));
      await waitFor(() => expect(tags.makeItem).toHaveBeenCalled());
      expect(tableIdOf(firstTable(editor))).toBeNull();
      await waitFor(() =>
        expect(
          screen
            .getByRole("button", { name: "Add tags" })
            .hasAttribute("disabled"),
        ).toBe(false),
      );
    } finally {
      editor.destroy();
    }
  });

  it("shows the tags of a table that is already an item", () => {
    const editor = makeEditor(docWithTable({ tableId: "table-1" }));
    try {
      render(<TableControls editor={editor} labels={LABELS} tags={wiring()} />);
      caretInTable(editor);
      expect(screen.getByTestId("tag-row").textContent).toBe("tags of table-1");
      expect(screen.queryByRole("button", { name: "Add tags" })).toBeNull();
    } finally {
      editor.destroy();
    }
  });
});

describe("useNoteTableItems — post-save sync (#2094)", () => {
  const withTable = docWithTable({ tableId: "table-1" });
  const withoutTable = JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }],
  });

  function setup() {
    const syncNoteTables = vi.fn(async () => ({
      softDeleted: [],
      restored: [],
      renamed: [],
    }));
    const ds = stubDataService({ syncNoteTables });
    const { result } = renderHook(() => useNoteTableItems(ds));
    return { syncNoteTables, result };
  }

  it("syncs the save that removed a table and the Undo that brought it back", async () => {
    const { syncNoteTables, result } = setup();

    result.current.syncSavedBody("note-1", withTable);
    result.current.syncSavedBody("note-1", withoutTable); // table deleted
    result.current.syncSavedBody("note-1", withTable); // Undo

    await waitFor(() => expect(syncNoteTables).toHaveBeenCalledTimes(3));
    expect(syncNoteTables.mock.calls).toEqual([
      ["note-1", withTable],
      ["note-1", withoutTable],
      ["note-1", withTable],
    ]);
  });

  it("runs the first save of a note, then skips saves that never had a table", async () => {
    const { syncNoteTables, result } = setup();

    result.current.syncSavedBody("note-1", withoutTable);
    result.current.syncSavedBody("note-1", withoutTable);
    result.current.syncSavedBody("note-2", withoutTable);

    await waitFor(() => expect(syncNoteTables).toHaveBeenCalledTimes(2));
    expect(syncNoteTables.mock.calls).toEqual([
      ["note-1", withoutTable],
      ["note-2", withoutTable],
    ]);
  });

  it("runs one note's syncs one at a time, in save order", async () => {
    const started: string[] = [];
    let releaseFirst = () => {};
    const syncNoteTables = vi.fn((_id: string, content: string) => {
      started.push(content);
      return started.length === 1
        ? new Promise((resolve) => {
            releaseFirst = () =>
              resolve({ softDeleted: [], restored: [], renamed: [] });
          })
        : Promise.resolve({ softDeleted: [], restored: [], renamed: [] });
    });
    const ds = stubDataService({ syncNoteTables });
    const { result } = renderHook(() => useNoteTableItems(ds));

    result.current.syncSavedBody("note-1", withTable);
    result.current.syncSavedBody("note-1", withoutTable);
    await waitFor(() => expect(started).toEqual([withTable]));
    // The second waits for the first to land.
    await new Promise((r) => setTimeout(r, 0));
    expect(started).toEqual([withTable]);

    releaseFirst();
    await waitFor(() => expect(started).toEqual([withTable, withoutTable]));
  });

  it("makes the item under the note it is wired for", async () => {
    const createNoteTable = vi.fn(async () => ({ id: "table-9" }));
    const ds = stubDataService({ createNoteTable });
    const { result } = renderHook(() => useNoteTableItems(ds));

    const id = await result.current.wiringFor("note-1")?.makeItem("Budget");

    expect(id).toBe("table-9");
    expect(createNoteTable).toHaveBeenCalledWith({
      parentNoteId: "note-1",
      title: "Budget",
    });
  });

  it("offers no wiring without a DataService", () => {
    const { result } = renderHook(() => useNoteTableItems(undefined));
    expect(result.current.wiringFor("note-1")).toBeUndefined();
  });
});
