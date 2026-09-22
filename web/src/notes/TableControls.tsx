import { useCallback, useSyncExternalStore, type ReactElement } from "react";
import type { Editor } from "@tiptap/core";
import { Columns3, Plus, Rows3, Trash2, X } from "lucide-react";
import { cn, FOCUS_RING } from "@life-editor/shared";

/*
 * Row and column controls for a table in the note body (#1903).
 *
 * The "/" item inserts a 3x3 and nothing else could change its shape, so a
 * table was something you could make and then not edit. These five buttons are
 * the smallest set that makes one usable: add a row, add a column, delete the
 * row or column the caret is in, delete the table.
 *
 * WHY A BAR AND NOT A FLOATING PANEL. The other floating thing in this editor
 * (suggestionPopup) positions itself against the caret rect, which jsdom
 * cannot produce — a coordinate path is a path with no test (CLAUDE.md §7.1,
 * rules/frontend.md). This sits in the editor's own box, above the document,
 * and appears only while the caret is inside a table. Column-width dragging,
 * merged cells and cell colour stay out of scope, so nothing here needs to
 * know where anything is on screen.
 *
 * Copy is injected (§6.4). lumen-* only.
 */

export interface TableControlLabels {
  /** Accessible name for the bar itself. */
  label: string;
  addRow: string;
  addColumn: string;
  deleteRow: string;
  deleteColumn: string;
  deleteTable: string;
}

interface TableControlsProps {
  editor: Editor | null;
  labels: TableControlLabels;
}

/**
 * True while the caret is inside a table.
 *
 * `useSyncExternalStore`, because that is what the editor is from React's side:
 * an outside thing that changes on its own and has to be subscribed to. Reading
 * `editor.isActive` during render would answer with whatever was true when this
 * component last rendered for some other reason — `useEditor` does not re-render
 * its host on a plain selection move — and reading it into state from an effect
 * is the cascading render the lint rule is about.
 */
function useCaretInTable(editor: Editor | null): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!editor) return () => {};
      editor.on("transaction", onChange);
      return () => {
        editor.off("transaction", onChange);
      };
    },
    [editor],
  );
  // A boolean, so the snapshot is stable by value and cannot loop.
  const read = useCallback(() => editor?.isActive("table") ?? false, [editor]);
  return useSyncExternalStore(subscribe, read, read);
}

export function TableControls({
  editor,
  labels,
}: TableControlsProps): ReactElement | null {
  const inTable = useCaretInTable(editor);

  // A read-only surface (the briefing preview, a todo body in draft mode) has
  // no business drawing editing controls.
  if (!editor || !inTable || editor.options.editable === false) return null;

  const run = (apply: (chain: ReturnType<Editor["chain"]>) => void) => ({
    // mousedown, not click, and the default is stopped: pressing a button
    // blurs the document, and a blurred document has no cell selection for
    // addRowAfter to work from. Same guard SlashMenu's rows use.
    onMouseDown: (event: { preventDefault: () => void }) => {
      event.preventDefault();
      apply(editor.chain().focus());
    },
  });

  const button = (
    key: string,
    label: string,
    glyph: ReactElement,
    apply: (chain: ReturnType<Editor["chain"]>) => void,
    danger = false,
  ) => (
    <button
      key={key}
      type="button"
      aria-label={label}
      title={label}
      data-table-action={key}
      {...run(apply)}
      className={cn(
        "grid h-7 w-7 place-items-center rounded-lumen-sm",
        // The 44px touch floor below the app's breakpoint (#1512): the drawn
        // box stays a mouse target, the hit box grows.
        "max-md:min-h-11 max-md:min-w-11",
        danger
          ? "text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-danger"
          : "text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
        FOCUS_RING,
      )}
    >
      {glyph}
    </button>
  );

  return (
    <div
      role="toolbar"
      aria-label={labels.label}
      data-table-controls=""
      className="sticky top-0 z-10 flex items-center gap-0.5 self-start rounded-lumen-md border border-lumen-border bg-lumen-bg p-1 shadow-lumen-sm"
    >
      {button(
        "add-row",
        labels.addRow,
        <span className="relative grid place-items-center">
          <Rows3 size={14} aria-hidden />
          <Plus size={9} aria-hidden className="absolute -bottom-1 -right-1" />
        </span>,
        (chain) => chain.addRowAfter().run(),
      )}
      {button(
        "add-column",
        labels.addColumn,
        <span className="relative grid place-items-center">
          <Columns3 size={14} aria-hidden />
          <Plus size={9} aria-hidden className="absolute -bottom-1 -right-1" />
        </span>,
        (chain) => chain.addColumnAfter().run(),
      )}
      {button(
        "delete-row",
        labels.deleteRow,
        <span className="relative grid place-items-center">
          <Rows3 size={14} aria-hidden />
          <X size={9} aria-hidden className="absolute -bottom-1 -right-1" />
        </span>,
        (chain) => chain.deleteRow().run(),
        true,
      )}
      {button(
        "delete-column",
        labels.deleteColumn,
        <span className="relative grid place-items-center">
          <Columns3 size={14} aria-hidden />
          <X size={9} aria-hidden className="absolute -bottom-1 -right-1" />
        </span>,
        (chain) => chain.deleteColumn().run(),
        true,
      )}
      {button(
        "delete-table",
        labels.deleteTable,
        <Trash2 size={14} aria-hidden />,
        (chain) => chain.deleteTable().run(),
        true,
      )}
    </div>
  );
}
