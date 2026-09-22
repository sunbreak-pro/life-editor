import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { buildSlashItems, filterSlashItems } from "../src/notes/slashCommand";
import type { SlashMenuLabels } from "../src/notes/slashCommand";
import { createTableNodes } from "../src/notes/tableNodes";

/*
 * #1903 — the "/" menu's table item, and the row / column commands behind the
 * bar it comes with.
 *
 * A headless TipTap Editor rather than <RichTextEditor>: what is under test is
 * a document transform, there is no coordinate path in it, and the round trip
 * through the real editor's schema check is covered next door in
 * tableNodes.test.tsx. The node definitions here are the SAME createTableNodes
 * the app registers, so a change to them fails this too.
 */

const LABELS: SlashMenuLabels = {
  heading1: "H1",
  heading2: "H2",
  heading3: "H3",
  bulletList: "Bullets",
  orderedList: "Numbers",
  taskList: "Todos",
  table: "テーブル",
  image: "Image",
  file: "File",
  empty: "No match",
};

function makeEditor(): Editor {
  const element = document.createElement("div");
  document.body.appendChild(element);
  return new Editor({
    element,
    extensions: [StarterKit, ...createTableNodes()],
    content: { type: "doc", content: [{ type: "paragraph" }] },
  });
}

type JsonNode = { type?: string; content?: JsonNode[] };

function nodesOfType(root: JsonNode, type: string): JsonNode[] {
  const found: JsonNode[] = [];
  const walk = (node: JsonNode) => {
    if (node.type === type) found.push(node);
    for (const child of node.content ?? []) walk(child);
  };
  walk(root);
  return found;
}

/** Run the "/" table item the way the Suggestion pipeline would. */
function insertTableViaSlash(editor: Editor) {
  const item = buildSlashItems(LABELS).find((i) => i.id === "table");
  if (!item) throw new Error("the slash menu has no table item");
  const at = editor.state.selection.from;
  item.command({ editor, range: { from: at, to: at } });
}

describe("the slash menu's table item (#1903)", () => {
  it("is found by table, by テーブル and by 表", () => {
    const items = buildSlashItems(LABELS);
    for (const query of ["table", "TABLE", "テーブル", "表"]) {
      expect(filterSlashItems(items, query).map((i) => i.id)).toContain(
        "table",
      );
    }
    // The id and the title are still matched on their own account.
    expect(filterSlashItems(items, "heading").map((i) => i.id)).not.toContain(
      "table",
    );
  });

  it("is offered on a surface with no uploader", () => {
    // A table needs nothing from the host, unlike the two attach entries.
    expect(buildSlashItems(LABELS).map((i) => i.id)).toContain("table");
  });

  it("inserts a 3x3 with a header row and leaves the caret in it", () => {
    const editor = makeEditor();
    try {
      insertTableViaSlash(editor);

      const doc = editor.getJSON() as JsonNode;
      const tables = nodesOfType(doc, "table");
      expect(tables).toHaveLength(1);
      expect(nodesOfType(tables[0], "tableRow")).toHaveLength(3);
      // The first row is headers, the other two are plain cells — the same
      // shape mcp-server's tiptapJsonBuilder.table() writes.
      expect(nodesOfType(tables[0], "tableHeader")).toHaveLength(3);
      expect(nodesOfType(tables[0], "tableCell")).toHaveLength(6);

      // The caret is inside the first header cell: typing continues there
      // rather than somewhere the user has to go find.
      const { $from } = editor.state.selection;
      const ancestors = Array.from(
        { length: $from.depth + 1 },
        (_, d) => $from.node(d).type.name,
      );
      expect(ancestors).toContain("tableHeader");
    } finally {
      editor.destroy();
    }
  });
});

describe("the row and column commands the bar runs (#1903)", () => {
  function withTable(run: (editor: Editor) => void) {
    const editor = makeEditor();
    try {
      insertTableViaSlash(editor);
      run(editor);
    } finally {
      editor.destroy();
    }
  }

  const rows = (editor: Editor) =>
    nodesOfType(editor.getJSON() as JsonNode, "tableRow");
  const cellsInFirstRow = (editor: Editor) => {
    const first = rows(editor)[0];
    return (first.content ?? []).length;
  };

  it("adds a row below the caret", () => {
    withTable((editor) => {
      editor.chain().focus().addRowAfter().run();
      expect(rows(editor)).toHaveLength(4);
    });
  });

  it("adds a column to the right of the caret", () => {
    withTable((editor) => {
      editor.chain().focus().addColumnAfter().run();
      expect(cellsInFirstRow(editor)).toBe(4);
    });
  });

  it("deletes the row the caret is in", () => {
    withTable((editor) => {
      editor.chain().focus().addRowAfter().run();
      editor.chain().focus().deleteRow().run();
      expect(rows(editor)).toHaveLength(3);
    });
  });

  it("deletes the column the caret is in", () => {
    withTable((editor) => {
      editor.chain().focus().addColumnAfter().run();
      editor.chain().focus().deleteColumn().run();
      expect(cellsInFirstRow(editor)).toBe(3);
    });
  });

  it("deletes the whole table", () => {
    withTable((editor) => {
      editor.chain().focus().deleteTable().run();
      expect(nodesOfType(editor.getJSON() as JsonNode, "table")).toHaveLength(
        0,
      );
    });
  });
});
