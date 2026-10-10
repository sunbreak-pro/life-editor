import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TableControls } from "../src/notes/TableControls";
import { createTableNodes } from "../src/notes/tableNodes";

/*
 * #1903 — the bar that adds and removes rows and columns. #2011 rebuilt it
 * with words on the buttons, before / after for both, and a name field (the
 * name itself is pinned in tableName.test.tsx).
 *
 * A real headless Editor, not a chain-recording stub: the thing most likely to
 * go wrong here is WHEN the bar is drawn, which is a question about the
 * editor's selection, and a stub would answer it by fiat. The commands
 * themselves are pinned in tableCommands.test.ts.
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

function makeEditor(withTable: boolean, editable = true): Editor {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    editable,
    extensions: [StarterKit, ...createTableNodes()],
    content: { type: "doc", content: [{ type: "paragraph" }] },
  });
  if (withTable) {
    editor.chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }
  return editor;
}

function rows(editor: Editor): number {
  let count = 0;
  editor.state.doc.descendants((node) => {
    if (node.type.name === "tableRow") count += 1;
  });
  return count;
}

/** Cells in the first row — the table's column count. */
function columns(editor: Editor): number {
  let count = -1;
  editor.state.doc.descendants((node) => {
    if (count < 0 && node.type.name === "tableRow") count = node.childCount;
  });
  return count;
}

/** The browser's own step before a click: focus the button, unless stopped. */
function press(button: HTMLElement) {
  const notPrevented = fireEvent.mouseDown(button);
  if (notPrevented) button.focus();
  return notPrevented;
}

describe("TableControls (#1903)", () => {
  it("draws nothing while the caret is outside a table", () => {
    const editor = makeEditor(false);
    try {
      render(<TableControls editor={editor} labels={LABELS} />);
      expect(screen.queryByRole("toolbar")).toBeNull();
    } finally {
      editor.destroy();
    }
  });

  it("draws nothing on a read-only surface", () => {
    // The briefing preview and a todo body in draft mode both mount this
    // editor; neither should grow editing controls.
    const editor = makeEditor(true, false);
    try {
      render(<TableControls editor={editor} labels={LABELS} />);
      expect(screen.queryByRole("toolbar")).toBeNull();
    } finally {
      editor.destroy();
    }
  });

  it("appears once the caret moves into a table", () => {
    const editor = makeEditor(false);
    try {
      render(<TableControls editor={editor} labels={LABELS} />);
      expect(screen.queryByRole("toolbar")).toBeNull();

      act(() => {
        editor
          .chain()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run();
      });

      screen.getByRole("toolbar", { name: "Table controls" });
    } finally {
      editor.destroy();
    }
  });

  it("adds a row without letting the press blur the document", () => {
    const editor = makeEditor(true);
    try {
      render(<TableControls editor={editor} labels={LABELS} />);
      const button = screen.getByRole("button", { name: "Add row below" });

      // The guard itself: a press that moved the focus would take the cell
      // selection with it, and addRowAfter would have nothing to work from.
      expect(press(button)).toBe(false);
      expect(rows(editor)).toBe(4);
    } finally {
      editor.destroy();
    }
  });

  it("groups the actions under Row and Column, each a 44px target on narrow", () => {
    const editor = makeEditor(true);
    try {
      render(<TableControls editor={editor} labels={LABELS} />);
      const buttons = screen.getAllByRole("button");
      expect(buttons.map((b) => b.getAttribute("data-table-action"))).toEqual([
        "add-row-before",
        "add-row",
        "delete-row",
        "add-column-before",
        "add-column",
        "delete-column",
        "delete-table",
      ]);
      // #2011: each button says what it does on its face, under its group's
      // caption — not a glyph that needs a hover to read.
      const row = screen.getByRole("group", { name: "Row" });
      expect(
        within(row)
          .getAllByRole("button")
          .map((b) => b.textContent),
      ).toEqual(["Above", "Below", "Delete"]);
      const column = screen.getByRole("group", { name: "Column" });
      expect(
        within(column)
          .getAllByRole("button")
          .map((b) => b.textContent),
      ).toEqual(["Left", "Right", "Delete"]);
      expect(
        screen
          .getByRole("textbox", { name: "Table name" })
          .classList.contains("max-md:min-h-11"),
      ).toBe(true);
      for (const button of buttons) {
        expect(button.classList.contains("max-md:min-h-11")).toBe(true);
        expect(button.classList.contains("max-md:min-w-11")).toBe(true);
        // Desktop keeps the drawn height it had.
        expect(button.classList.contains("h-7")).toBe(true);
        expect(button.classList.contains("min-h-11")).toBe(false);
      }
    } finally {
      editor.destroy();
    }
  });

  it("answers the keyboard too, once per press", () => {
    const editor = makeEditor(true);
    try {
      render(<TableControls editor={editor} labels={LABELS} />);
      const button = screen.getByRole("button", { name: "Add row below" });
      // Enter / Space: a click with detail 0 and no mousedown.
      fireEvent.click(button, { detail: 0 });
      expect(rows(editor)).toBe(4);
      // A pointer press: the mousedown runs it, the click that follows must
      // not run it a second time.
      press(button);
      fireEvent.click(button, { detail: 1 });
      expect(rows(editor)).toBe(5);
    } finally {
      editor.destroy();
    }
  });

  it("adds a row above and a column on either side", () => {
    const editor = makeEditor(true);
    try {
      render(<TableControls editor={editor} labels={LABELS} />);
      press(screen.getByRole("button", { name: "Add row above" }));
      expect(rows(editor)).toBe(4);
      press(screen.getByRole("button", { name: "Add column left" }));
      expect(columns(editor)).toBe(4);
      press(screen.getByRole("button", { name: "Add column right" }));
      expect(columns(editor)).toBe(5);
    } finally {
      editor.destroy();
    }
  });

  it("deletes the row and the column the caret is in", () => {
    const editor = makeEditor(true);
    try {
      render(<TableControls editor={editor} labels={LABELS} />);
      press(screen.getByRole("button", { name: "Delete row" }));
      expect(rows(editor)).toBe(2);
      press(screen.getByRole("button", { name: "Delete column" }));
      expect(columns(editor)).toBe(2);
    } finally {
      editor.destroy();
    }
  });

  it("takes the table out on the last button", () => {
    const editor = makeEditor(true);
    try {
      render(<TableControls editor={editor} labels={LABELS} />);
      press(screen.getByRole("button", { name: "Delete table" }));
      expect(rows(editor)).toBe(0);
    } finally {
      editor.destroy();
    }
  });

  // #2058: the note header above the body is sticky now, so a stuck table bar
  // has to stop under it rather than at the scroller's very top, where the
  // header would cover it. The header's height arrives as a CSS variable;
  // anywhere that does not set it, the bar keeps its old top of 0.
  it("sticks below the note's sticky header, falling back to the top", () => {
    const editor = makeEditor(true);
    try {
      render(<TableControls editor={editor} labels={LABELS} />);
      const bar = screen.getByRole("toolbar", { name: "Table controls" });
      expect(bar.className).toContain("sticky");
      expect(bar.className).not.toContain("top-0");
      expect(bar.style.top).toBe("var(--note-sticky-header-h, 0px)");
    } finally {
      editor.destroy();
    }
  });
});
