import type { Extensions } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  Table,
  TableRow,
  TableHeader,
  TableCell,
  TableView,
} from "@tiptap/extension-table";

/*
 * table / tableRow / tableHeader / tableCell — the four nodes the MCP server
 * writes for a `table` block (#1579).
 *
 * `generate_content` has always taken a `table` block (handlers/
 * contentHandlers.ts) and `tiptapJsonBuilder.table()` turns it into exactly
 * this shape: a `table` of `tableRow`s, the first row built from `tableHeader`
 * cells and the rest from `tableCell`s, each cell holding a paragraph. Four
 * more tool descriptions ("For toggle lists, tables, or complex layouts, use
 * generate_content instead") point writers at it. The web editor's schema knew
 * none of the four.
 *
 * That is not a table drawing badly. RichTextEditor sets
 * `enableContentCheck: true`, so ONE unknown node rejects the WHOLE document;
 * onContentError only console.warns, TipTap comes up empty, and the 800ms
 * autosave writes that empty document back over the real body. Opening the
 * note once was enough to lose all of it. This is the same failure #1521 hit
 * with `callout`, on the sibling node type that PR named on its way out.
 *
 * Registered UNCONDITIONALLY by RichTextEditor, like itemLink, attachment
 * (#1404) and callout (#1521): a note authored through one surface has to open
 * on every other one. Since #1903 this surface authors tables too — the "/"
 * menu's table item builds the same shape tiptapJsonBuilder does — so the
 * rule now cuts both ways rather than only inwards.
 *
 * WHY THE PACKAGE, NOT A HAND-WRITTEN NODE. callout got a hand-written
 * `Node.create` because it is a div with two attributes. A table is not: cells
 * carry colspan / rowspan / colwidth, and the editing behaviour that keeps a
 * table well-formed while it is typed in (cell selection, Tab between cells,
 * the repair pass) lives in prosemirror-tables' `tableEditing` plugin, which
 * needs a `tableRole` on each node spec — a field @tiptap/core only declares
 * for this package. Hand-rolling the schema without it would leave a document
 * that opens but degrades as soon as it is edited, which is the bug again with
 * more steps. The pre-Tauri app used these same packages (`frontend/
 * package.json` at git tag `pre-tauri-removal`), so notes it wrote parse as
 * the same nodes.
 *
 * The version is deliberately the one the editor already runs: this package
 * pins @tiptap/core and @tiptap/pm to an EXACT version in its peer deps, so
 * taking the newest would have dragged the whole editor stack from 3.23.4 to
 * 3.31.3 inside a bug fix. 3.23.4 matches what is installed, and the lockfile
 * gains one package.
 */

/**
 * A table's name (#2011), or null when it has none.
 *
 * Tables written before #2011, and every table the MCP builder writes, carry
 * no `name` at all; the attribute's default makes those null, and this reads
 * a blank string the same way so an emptied field does not leave "" behind.
 */
export function tableNameOf(
  node: ProseMirrorNode | null | undefined,
): string | null {
  const name: unknown = node?.attrs.name;
  return typeof name === "string" && name.trim() !== "" ? name : null;
}

/**
 * The table's node view: the package's own TableView, plus the name above
 * the grid (#2011).
 *
 * The name is drawn by the view rather than as document content because it
 * is an attribute, not text. That keeps the table's shape the one the MCP
 * builder writes (#1579): four node types and nothing else, so a named table
 * still opens on a surface that does not know about names, and an unnamed one
 * opens here unchanged. It is edited from TableControls.
 *
 * The caption sits inside `div.tableWrapper` but outside `contentDOM`, which
 * TableView.ignoreMutation already tells ProseMirror to leave alone, so
 * writing its text does not make the editor re-read the table.
 */
class NamedTableView extends TableView {
  caption: HTMLDivElement;

  constructor(node: ProseMirrorNode, cellMinWidth: number) {
    super(node, cellMinWidth);
    this.caption = document.createElement("div");
    this.caption.className = "note-table-name";
    this.caption.setAttribute("contenteditable", "false");
    this.dom.insertBefore(this.caption, this.table);
    this.drawName(node);
  }

  update(node: ProseMirrorNode): boolean {
    if (!super.update(node)) return false;
    this.drawName(node);
    return true;
  }

  private drawName(node: ProseMirrorNode): void {
    const name = tableNameOf(node);
    this.caption.textContent = name ?? "";
    this.caption.hidden = name === null;
  }
}

/**
 * The table node with its name (#2011). `data-name` is its HTML form, so a
 * copied table keeps its name when pasted into another note.
 */
const NamedTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      name: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-name") || null,
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes.name === "string" && attributes.name !== ""
            ? { "data-name": attributes.name }
            : {},
      },
    };
  },
});

/**
 * Build the table nodes for RichTextEditor's extension list.
 *
 * A function (rather than exporting the array straight) to match
 * createItemLinkNode / createAttachmentNode / createCalloutNode at the call
 * site, even though these nodes take no host wiring.
 *
 * `resizable` stays off. #1903 gave the editor a way to MAKE a table and a
 * small bar for its rows and columns, and left column-width dragging out of
 * scope on purpose. It is spelled out rather than left to the default because
 * it is a decision, and because it is what decides which node view runs: with
 * resizing off the extension falls back to its plain `TableView`, which still
 * wraps the table in `div.tableWrapper`. That wrapper is the scroll container
 * web/src/index.css hangs `overflow-x: auto` on, so an MCP table wider than
 * the note pane scrolls itself instead of stretching the pane.
 *
 * #2011 swaps that TableView for NamedTableView, which is the same view with
 * the name drawn above the grid; the wrapper and its scroll are unchanged.
 */
export function createTableNodes(): Extensions {
  return [
    NamedTable.configure({ resizable: false, View: NamedTableView }),
    TableRow,
    TableHeader,
    TableCell,
  ];
}
