import {
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from "react";
import type { Editor } from "@tiptap/core";
import { BubbleMenu, type BubbleMenuProps } from "@tiptap/react/menus";
import { NodeSelection } from "@tiptap/pm/state";
import {
  Bold,
  Heading1,
  Heading2,
  Italic,
  Minus,
  Strikethrough,
} from "lucide-react";
import {
  cn,
  FOCUS_RING,
  NOTE_STICKY_HEADER_HEIGHT_VAR,
} from "@life-editor/shared";

/*
 * The note body's formatting buttons (#2060): H1, H2, bold, italic,
 * strikethrough and a divider — exactly those six (the "など" in the Issue was
 * settled as "these six first"; lists, quotes and tables stay with the "/"
 * menu).
 *
 * #2227: they no longer sit in the note header. `FormatBubbleMenu` below
 * floats them over the text the user has selected, and hides them again when
 * the selection collapses. The buttons stay their own component so the press
 * rules are pinned once. Both take the editor as a prop: it is built inside
 * RichTextEditor once per note and handed up through `onEditorChange`.
 *
 * Pressing a button must not take the focus or the selection away from the
 * body. Same guard as TableControls and the header Undo / Redo: the work runs
 * on mousedown with the default stopped, so the press never blurs the
 * document. A keyboard press (Enter / Space on a focused button) sends a click
 * with `detail` 0 and no mousedown, and runs from there; `focus()` puts the
 * caret back where the editor's state still has it.
 *
 * IME: a press while a conversion is open is ignored. Changing the document
 * under an uncommitted composition is what breaks Japanese input, and a press
 * that does nothing is recoverable where a mangled conversion is not.
 *
 * Toggles, not setters: H1 on an H1 line turns it back into a paragraph, bold
 * on bold text takes the bold off, and with no selection the mark is stored
 * for the next characters typed (TipTap's own toggle behaviour). Each toggle
 * reports `aria-pressed` from the editor's state; the divider is an insert,
 * so it carries no pressed state.
 *
 * Copy is injected (§6.4). lumen-* only.
 */

export interface FormatToolbarLabels {
  /** Accessible name for the bar itself. */
  label: string;
  heading1: string;
  heading2: string;
  bold: string;
  italic: string;
  strike: string;
  horizontalRule: string;
}

export interface FormatToolbarProps {
  /** The body's editor, or null while there is none (locked / loading). */
  editor: Editor | null;
  /**
   * Off for a body that cannot be edited right now — password-locked or
   * read-only. The editor's own editable flag is checked as well.
   */
  disabled?: boolean;
  labels: FormatToolbarLabels;
}

type Chain = ReturnType<Editor["chain"]>;

interface FormatAction {
  key: string;
  label: (labels: FormatToolbarLabels) => string;
  icon: ReactNode;
  apply: (chain: Chain) => Chain;
  /** Whether the format is on at the selection. Absent → not a toggle. */
  isActive?: (editor: Editor) => boolean;
}

const ACTIONS: readonly FormatAction[] = [
  {
    key: "heading1",
    label: (l) => l.heading1,
    icon: <Heading1 size={16} />,
    apply: (chain) => chain.toggleHeading({ level: 1 }),
    isActive: (editor) => editor.isActive("heading", { level: 1 }),
  },
  {
    key: "heading2",
    label: (l) => l.heading2,
    icon: <Heading2 size={16} />,
    apply: (chain) => chain.toggleHeading({ level: 2 }),
    isActive: (editor) => editor.isActive("heading", { level: 2 }),
  },
  {
    key: "bold",
    label: (l) => l.bold,
    icon: <Bold size={16} />,
    apply: (chain) => chain.toggleBold(),
    isActive: (editor) => editor.isActive("bold"),
  },
  {
    key: "italic",
    label: (l) => l.italic,
    icon: <Italic size={16} />,
    apply: (chain) => chain.toggleItalic(),
    isActive: (editor) => editor.isActive("italic"),
  },
  {
    key: "strike",
    label: (l) => l.strike,
    icon: <Strikethrough size={16} />,
    apply: (chain) => chain.toggleStrike(),
    isActive: (editor) => editor.isActive("strike"),
  },
  {
    key: "horizontalRule",
    label: (l) => l.horizontalRule,
    icon: <Minus size={16} />,
    apply: (chain) => chain.setHorizontalRule(),
  },
];

/**
 * The pressed state of every toggle, packed into one number (bit i = ACTIONS[i]
 * active), plus whether the editor is editable in the bit above them.
 *
 * `useSyncExternalStore` for the same reason TableControls uses it: `useEditor`
 * does not re-render anything on a plain selection move, so the state has to
 * be subscribed to. One primitive rather than an object so the snapshot is
 * stable by value and cannot loop.
 */
const EDITABLE_BIT = 1 << ACTIONS.length;

function readState(editor: Editor): number {
  let bits = editor.isEditable ? EDITABLE_BIT : 0;
  ACTIONS.forEach((action, i) => {
    if (action.isActive?.(editor)) bits |= 1 << i;
  });
  return bits;
}

function useFormatState(editor: Editor | null): number {
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
    () => (editor && !editor.isDestroyed ? readState(editor) : 0),
    [editor],
  );
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function FormatToolbar({
  editor,
  disabled = false,
  labels,
}: FormatToolbarProps): ReactElement {
  const state = useFormatState(editor);
  const off = disabled || !editor || (state & EDITABLE_BIT) === 0;

  const run = (action: FormatAction) => {
    if (off || !editor || editor.view.composing) return;
    // `scrollIntoView: false`: the press is made while looking at the
    // selection, and ProseMirror's scroll does not know about the sticky
    // header (#2058) — it could park the caret's line underneath it.
    action.apply(editor.chain().focus(null, { scrollIntoView: false })).run();
  };

  return (
    <div
      role="toolbar"
      aria-label={labels.label}
      data-format-toolbar=""
      className="flex items-center gap-1"
    >
      {ACTIONS.map((action, i) => {
        const name = action.label(labels);
        const pressed =
          action.isActive !== undefined ? (state & (1 << i)) !== 0 : undefined;
        return (
          <button
            key={action.key}
            type="button"
            data-format-action={action.key}
            aria-label={name}
            title={name}
            aria-pressed={pressed}
            disabled={off}
            onMouseDown={(event) => {
              // Keep the focus (and the selection with it) in the body.
              event.preventDefault();
              run(action);
            }}
            onClick={(event) => {
              // A keyboard press: no mousedown came first.
              if (event.detail === 0) run(action);
            }}
            className={cn(
              "inline-grid h-7 w-7 place-items-center rounded-lumen-sm transition-colors",
              // The 44px touch floor below the app's breakpoint (#1512).
              "max-md:min-h-11 max-md:min-w-11",
              pressed
                ? "bg-lumen-accent-subtle text-lumen-accent"
                : "text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
              "disabled:cursor-not-allowed disabled:opacity-40",
              FOCUS_RING,
            )}
          >
            <span aria-hidden className="inline-flex">
              {action.icon}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/*
 * #2227 — the six buttons floating over the selected text, in place of the
 * bar that used to sit in the note header.
 *
 * TipTap's BubbleMenu (Floating UI underneath) places it. It shows while the
 * selection holds characters, the body has the focus (or the bar does) and
 * the body can be edited, and it hides as soon as the selection collapses.
 * Not for a table's cell selection — the table has its own bar
 * (TableControls) — nor for a selected node such as an image or a divider:
 * neither has text to format.
 *
 * Placement: above the selection on Desktop, below it on narrow, because iOS
 * draws its own copy / paste menu above a selection and the two would
 * overlap. `flip` moves the bar to the other side when there is no room; the
 * room above counts the note's sticky header (#2058) as taken, read off
 * NOTE_STICKY_HEADER_HEIGHT_VAR, so a selection right under the header gets
 * the bar below it instead of behind the header. `shift` keeps the bar inside
 * the screen near its left and right edges. Both sides are measured with
 * getBoundingClientRect — the selection's range and the bar's offset parent —
 * so a pinch-zoomed page still puts the bar at the selection.
 *
 * The presses go through FormatToolbar, so the focus and IME rules above
 * hold here unchanged.
 */

export interface FormatBubbleMenuProps extends FormatToolbarProps {
  /** The side of the selection the bar prefers. */
  placement?: "top" | "bottom";
}

type ShouldShow = NonNullable<BubbleMenuProps["shouldShow"]>;
type MenuOptions = NonNullable<BubbleMenuProps["options"]>;

/** Space kept between the bar and the screen's (or the header's) edge. */
const EDGE_GAP = 8;

function stickyHeaderHeight(el: Element): number {
  const px = Number.parseFloat(
    getComputedStyle(el).getPropertyValue(NOTE_STICKY_HEADER_HEIGHT_VAR),
  );
  return Number.isFinite(px) ? px : 0;
}

export function FormatBubbleMenu({
  editor,
  disabled = false,
  labels,
  placement = "top",
}: FormatBubbleMenuProps): ReactElement | null {
  const shouldShow = useCallback<ShouldShow>(
    ({ editor: current, element, view, state, from, to }) => {
      if (disabled || !current.isEditable) return false;
      const { selection, doc } = state;
      if (selection.empty || selection instanceof NodeSelection) return false;
      // prosemirror-tables' CellSelection, without importing the extension.
      if ("$anchorCell" in selection) return false;
      if (doc.textBetween(from, to).length === 0) return false;
      return view.hasFocus() || element.contains(document.activeElement);
    },
    [disabled],
  );
  const options = useMemo<MenuOptions>(
    () => ({
      placement,
      offset: EDGE_GAP,
      flip: (state) => ({
        padding: {
          top: stickyHeaderHeight(state.elements.floating) + EDGE_GAP,
          bottom: EDGE_GAP,
          left: EDGE_GAP,
          right: EDGE_GAP,
        },
      }),
      shift: { padding: EDGE_GAP },
    }),
    [placement],
  );

  // BubbleMenu warns when it has no editor; there is nothing to float over.
  if (!editor) return null;
  return (
    <BubbleMenu
      editor={editor}
      shouldShow={shouldShow}
      options={options}
      data-format-bubble=""
      className="z-30 rounded-lumen-md border border-lumen-border bg-lumen-bg p-1 shadow-lumen-lg"
    >
      <FormatToolbar editor={editor} disabled={disabled} labels={labels} />
    </BubbleMenu>
  );
}
