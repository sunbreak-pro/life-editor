import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TableControls } from "../src/notes/TableControls";
import { createTableNodes } from "../src/notes/tableNodes";

/*
 * #1903 — the bar that adds and removes rows and columns.
 *
 * A real headless Editor, not a chain-recording stub: the thing most likely to
 * go wrong here is WHEN the bar is drawn, which is a question about the
 * editor's selection, and a stub would answer it by fiat. The commands
 * themselves are pinned in tableCommands.test.ts.
 */

const LABELS = {
  label: "Table controls",
  addRow: "Add row below",
  addColumn: "Add column right",
  deleteRow: "Delete row",
  deleteColumn: "Delete column",
  deleteTable: "Delete table",
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

  it("offers all five actions, each a 44px target on narrow", () => {
    const editor = makeEditor(true);
    try {
      render(<TableControls editor={editor} labels={LABELS} />);
      const buttons = screen.getAllByRole("button");
      expect(buttons.map((b) => b.getAttribute("data-table-action"))).toEqual([
        "add-row",
        "add-column",
        "delete-row",
        "delete-column",
        "delete-table",
      ]);
      for (const button of buttons) {
        expect(button.classList.contains("max-md:min-h-11")).toBe(true);
        expect(button.classList.contains("max-md:min-w-11")).toBe(true);
        // Desktop keeps the drawn size it had.
        expect(button.classList.contains("h-7")).toBe(true);
        expect(button.classList.contains("min-h-11")).toBe(false);
      }
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
});
