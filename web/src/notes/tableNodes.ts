import type { Extensions } from "@tiptap/core";
import {
  Table,
  TableRow,
  TableHeader,
  TableCell,
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
 * on every other one, so the schema must know the node even where nothing in
 * the UI creates it.
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
 * Build the table nodes for RichTextEditor's extension list.
 *
 * A function (rather than exporting the array straight) to match
 * createItemLinkNode / createAttachmentNode / createCalloutNode at the call
 * site, even though these nodes take no host wiring.
 *
 * `resizable` stays off — column drag handles are an authoring affordance, and
 * this editor deliberately has none for tables (no slash-menu entry either,
 * same as callout). It is spelled out rather than left to the default because
 * it is a decision, and because it is what decides which node view runs: with
 * resizing off the extension falls back to its plain `TableView`, which still
 * wraps the table in `div.tableWrapper`. That wrapper is the scroll container
 * web/src/index.css hangs `overflow-x: auto` on, so an MCP table wider than
 * the note pane scrolls itself instead of stretching the pane.
 */
export function createTableNodes(): Extensions {
  return [
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
  ];
}
