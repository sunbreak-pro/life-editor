import {
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from "react";
import type { Editor } from "@tiptap/core";
import {
  BetweenHorizontalEnd,
  Tag as TagIcon,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Trash2,
  X,
} from "lucide-react";
import {
  cn,
  FOCUS_RING,
  isImeComposing,
  NOTE_STICKY_HEADER_HEIGHT_VAR,
} from "@life-editor/shared";
import { tableIdOf, tableNameOf } from "./tableNodes";

/*
 * The panel for a table in the note body (#1903, rebuilt by #2011).
 *
 * #1903 shipped five icon-only buttons, and the icons were a row glyph or a
 * column glyph with a tiny "+" or "×" in the corner: at 14px nobody could
 * tell "add a row" from "delete a column" without hovering for the tooltip,
 * and a phone has no hover. #2011 puts the words on the buttons. The panel
 * reads as two labelled groups, "Row" and "Column", each with add-before,
 * add-after and delete, then the whole-table delete, and above them a field
 * for the table's name.
 *
 * WHY A BAR AND NOT A FLOATING PANEL. The other floating thing in this editor
 * (suggestionPopup) positions itself against the caret rect, which jsdom
 * cannot produce — a coordinate path is a path with no test (CLAUDE.md §7.1,
 * rules/frontend.md). This sits in the editor's own box, above the document,
 * and appears only while the caret is inside a table. Column-width dragging,
 * merged cells and cell colour stay out of scope, so nothing here needs to
 * know where anything is on screen.
 *
 * Every button is 44px tall below the app's breakpoint (#1512). The groups
 * wrap onto their own lines there rather than squeezing.
 *
 * Copy is injected (§6.4). lumen-* only.
 */

export interface TableControlLabels {
  /** Accessible name for the bar itself. */
  label: string;
  /** Caption and group name of the row buttons. */
  rowGroup: string;
  /** Caption and group name of the column buttons. */
  columnGroup: string;
  /** Full names — each button's accessible name and tooltip. */
  addRowAbove: string;
  addRow: string;
  addColumnLeft: string;
  addColumn: string;
  deleteRow: string;
  deleteColumn: string;
  deleteTable: string;
  /** Short words drawn on the buttons, read under their group's caption. */
  addAbove: string;
  addBelow: string;
  addLeft: string;
  addRight: string;
  remove: string;
  /** The name field's accessible name and placeholder. */
  nameLabel: string;
  namePlaceholder: string;
}

/**
 * Tags on a table (#2094), wired by the Notes host only — a Daily or a todo
 * body has no note to be the table's parent (plan Q1), so its bar has no tag
 * row at all.
 *
 * A table without a `tableId` is not an item yet. Its row is a single button:
 * `makeItem` creates the item, and the bar writes the returned id into the
 * table node. From then on the row is `renderTags(tableId)`, the ordinary
 * tag picker for that item.
 */
export interface TableTagsWiring {
  /** Make the table an item under this note; its id, or null on failure. */
  makeItem: (name: string) => Promise<string | null>;
  renderTags: (tableId: string) => ReactNode;
  labels: {
    /** Caption and group name of the tag row. */
    group: string;
    /** The button on a table that is not an item yet. */
    addTags: string;
    /** The same button while the item is being made. */
    adding: string;
  };
}

interface TableControlsProps {
  editor: Editor | null;
  labels: TableControlLabels;
  /** Omitted → no tag row (#2094). */
  tags?: TableTagsWiring;
}

/**
 * Where the table holding the caret starts, or -1 outside every table.
 *
 * `useSyncExternalStore`, because that is what the editor is from React's side:
 * an outside thing that changes on its own and has to be subscribed to. Reading
 * the selection during render would answer with whatever was true when this
 * component last rendered for some other reason — `useEditor` does not re-render
 * its host on a plain selection move — and reading it into state from an effect
 * is the cascading render the lint rule is about.
 *
 * Two primitives (position, name) rather than one object, so each snapshot is
 * stable by value and cannot loop.
 */
function useEditorSnapshot<T extends string | number>(
  editor: Editor | null,
  read: (editor: Editor) => T,
  fallback: T,
): T {
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
  const snapshot = useCallback(
    () => (editor ? read(editor) : fallback),
    [editor, read, fallback],
  );
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** The start of the innermost table around the selection, or -1. */
function readTablePos(editor: Editor): number {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === "table") return $from.before(depth);
  }
  return -1;
}

function readTableName(editor: Editor): string {
  const pos = readTablePos(editor);
  if (pos < 0) return "";
  return tableNameOf(editor.state.doc.nodeAt(pos)) ?? "";
}

/** The table item id around the caret, or "" (#2094). */
function readTableId(editor: Editor): string {
  const pos = readTablePos(editor);
  if (pos < 0) return "";
  return tableIdOf(editor.state.doc.nodeAt(pos)) ?? "";
}

/**
 * The tag row of the bar (#2094). Its own component so the "making the item"
 * state lives with the button and resets when the caret moves to another
 * table (the parent keys it on the table).
 */
function TableTagRow({
  editor,
  tablePos,
  tableId,
  tableName,
  tags,
}: {
  editor: Editor;
  tablePos: number;
  tableId: string;
  tableName: string;
  tags: TableTagsWiring;
}): ReactElement {
  const [busy, setBusy] = useState(false);

  const makeItem = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const id = await tags.makeItem(tableName);
      if (!id) return;
      // Anything may have moved while the item was being made: write only to
      // a table still standing where it was read, and still without an id.
      const node = editor.state.doc.nodeAt(tablePos);
      if (!node || node.type.name !== "table" || tableIdOf(node) !== null) {
        return;
      }
      // Not an edit to undo: Ctrl+Z right after tagging must not quietly
      // detach the table from the item its tags now live on.
      editor.view.dispatch(
        editor.state.tr
          .setNodeAttribute(tablePos, "tableId", id)
          .setMeta("addToHistory", false),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="group"
      aria-label={tags.labels.group}
      data-table-tags=""
      className="flex flex-wrap items-center gap-1"
    >
      <span
        aria-hidden
        className="text-xs font-semibold text-lumen-text-secondary"
      >
        {tags.labels.group}
      </span>
      {tableId ? (
        tags.renderTags(tableId)
      ) : (
        <button
          type="button"
          data-table-action="add-tags"
          disabled={busy}
          aria-label={busy ? tags.labels.adding : tags.labels.addTags}
          onClick={() => void makeItem()}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-lumen-sm border border-lumen-border bg-lumen-bg px-2 text-xs text-lumen-text hover:bg-lumen-hover",
            "disabled:cursor-wait disabled:text-lumen-text-tertiary",
            "max-md:min-h-11 max-md:min-w-11",
            FOCUS_RING,
          )}
        >
          <span aria-hidden className="inline-flex">
            <TagIcon size={14} />
          </span>
          <span aria-hidden>
            {busy ? tags.labels.adding : tags.labels.addTags}
          </span>
        </button>
      )}
    </div>
  );
}

/**
 * The name field. A draft of its own, committed on Enter or on leaving the
 * field, so a name is one undo step rather than one per letter. The parent
 * keys it on the table and its stored name, so moving to another table, or an
 * undo that changes the name under it, starts it over from the document.
 *
 * Escape hands the focus back to the document, and that focus move blurs the
 * field with the abandoned draft still in its closure. The flag makes that one
 * blur write nothing; it is cleared on the next focus so a later blur commits.
 */
function TableNameField({
  initial,
  label,
  placeholder,
  onCommit,
  onDone,
}: {
  initial: string;
  label: string;
  placeholder: string;
  onCommit: (name: string) => void;
  onDone: () => void;
}): ReactElement {
  const [draft, setDraft] = useState(initial);
  const cancelled = useRef(false);
  return (
    <input
      type="text"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={() => {
        cancelled.current = false;
      }}
      onBlur={() => {
        if (cancelled.current) return;
        onCommit(draft);
      }}
      onKeyDown={(event) => {
        // Enter that closes an IME conversion is the conversion's (#551).
        if (event.key === "Enter" && !isImeComposing(event)) {
          event.preventDefault();
          onCommit(draft);
          onDone();
        } else if (event.key === "Escape" && !isImeComposing(event)) {
          event.preventDefault();
          cancelled.current = true;
          setDraft(initial);
          onDone();
        }
      }}
      aria-label={label}
      placeholder={placeholder}
      data-table-name-field=""
      className={cn(
        "h-7 min-w-0 flex-1 basis-40 rounded-lumen-sm border border-lumen-border bg-lumen-bg px-2 text-sm text-lumen-text",
        "placeholder:text-lumen-text-tertiary max-md:min-h-11",
        FOCUS_RING,
      )}
    />
  );
}

export function TableControls({
  editor,
  labels,
  tags,
}: TableControlsProps): ReactElement | null {
  const tablePos = useEditorSnapshot(editor, readTablePos, -1);
  const tableName = useEditorSnapshot(editor, readTableName, "");
  const tableId = useEditorSnapshot(editor, readTableId, "");

  // A read-only surface (the briefing preview, a todo body in draft mode) has
  // no business drawing editing controls.
  if (!editor || tablePos < 0 || editor.options.editable === false) {
    return null;
  }

  const run = (apply: (chain: ReturnType<Editor["chain"]>) => void) => ({
    // mousedown, not click, and the default is stopped: pressing a button
    // blurs the document, and a blurred document has no cell selection for
    // addRowAfter to work from. Same guard SlashMenu's rows use.
    onMouseDown: (event: { preventDefault: () => void }) => {
      event.preventDefault();
      apply(editor.chain().focus());
    },
    // Enter / Space on a focused button sends a click and no mousedown (#2011:
    // the name field made the bar reachable by Tab). `detail` 0 is that
    // keyboard click; a pointer's click has already run above. The selection
    // is still in the editor's state, so focus() puts the caret back first.
    onClick: (event: { detail: number }) => {
      if (event.detail === 0) apply(editor.chain().focus());
    },
  });

  const commitName = (value: string) => {
    const next = value.trim() === "" ? null : value.trim();
    // The position was read at render. Anything may have moved since, so it
    // is only written to while it still holds a table.
    const node = editor.state.doc.nodeAt(tablePos);
    if (!node || node.type.name !== "table") return;
    if ((tableNameOf(node) ?? null) === next) return;
    editor.view.dispatch(
      editor.state.tr.setNodeAttribute(tablePos, "name", next),
    );
  };

  const button = (
    key: string,
    fullLabel: string,
    shortLabel: string,
    glyph: ReactNode,
    apply: (chain: ReturnType<Editor["chain"]>) => void,
    danger = false,
  ) => (
    <button
      key={key}
      type="button"
      aria-label={fullLabel}
      title={fullLabel}
      data-table-action={key}
      {...run(apply)}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-lumen-sm border border-lumen-border bg-lumen-bg px-2 text-xs",
        // The 44px touch floor below the app's breakpoint (#1512).
        "max-md:min-h-11 max-md:min-w-11",
        danger
          ? "text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-danger"
          : "text-lumen-text hover:bg-lumen-hover",
        FOCUS_RING,
      )}
    >
      <span aria-hidden className="inline-flex">
        {glyph}
      </span>
      <span aria-hidden>{shortLabel}</span>
    </button>
  );

  const group = (name: string, children: ReactNode) => (
    <div
      role="group"
      aria-label={name}
      className="flex flex-wrap items-center gap-1"
    >
      <span
        aria-hidden
        className="text-xs font-semibold text-lumen-text-secondary"
      >
        {name}
      </span>
      {children}
    </div>
  );

  return (
    <div
      role="toolbar"
      aria-label={labels.label}
      data-table-controls=""
      // #2058: stick BELOW the note detail's sticky header rather than under
      // it. The panel publishes its header height on its root; outside that
      // panel (or before the first measurement) the fallback is the old 0.
      style={{ top: `var(${NOTE_STICKY_HEADER_HEIGHT_VAR}, 0px)` }}
      className="sticky z-10 flex flex-wrap items-center gap-x-3 gap-y-1.5 self-start rounded-lumen-md border border-lumen-border-strong bg-lumen-bg p-1.5 shadow-lumen-sm"
    >
      <TableNameField
        key={`${tablePos}:${tableName}`}
        initial={tableName}
        label={labels.nameLabel}
        placeholder={labels.namePlaceholder}
        onCommit={commitName}
        onDone={() => editor.commands.focus()}
      />
      {tags && (
        <TableTagRow
          key={tablePos}
          editor={editor}
          tablePos={tablePos}
          tableId={tableId}
          tableName={tableName.trim()}
          tags={tags}
        />
      )}
      {group(labels.rowGroup, [
        button(
          "add-row-before",
          labels.addRowAbove,
          labels.addAbove,
          <BetweenHorizontalStart size={14} />,
          (chain) => chain.addRowBefore().run(),
        ),
        button(
          "add-row",
          labels.addRow,
          labels.addBelow,
          <BetweenHorizontalEnd size={14} />,
          (chain) => chain.addRowAfter().run(),
        ),
        button(
          "delete-row",
          labels.deleteRow,
          labels.remove,
          <X size={14} />,
          (chain) => chain.deleteRow().run(),
          true,
        ),
      ])}
      {group(labels.columnGroup, [
        button(
          "add-column-before",
          labels.addColumnLeft,
          labels.addLeft,
          <BetweenVerticalStart size={14} />,
          (chain) => chain.addColumnBefore().run(),
        ),
        button(
          "add-column",
          labels.addColumn,
          labels.addRight,
          <BetweenVerticalEnd size={14} />,
          (chain) => chain.addColumnAfter().run(),
        ),
        button(
          "delete-column",
          labels.deleteColumn,
          labels.remove,
          <X size={14} />,
          (chain) => chain.deleteColumn().run(),
          true,
        ),
      ])}
      {button(
        "delete-table",
        labels.deleteTable,
        labels.deleteTable,
        <Trash2 size={14} />,
        (chain) => chain.deleteTable().run(),
        true,
      )}
    </div>
  );
}
