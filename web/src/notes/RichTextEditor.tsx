import { useCallback, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Strike from "@tiptap/extension-strike";
import Code from "@tiptap/extension-code";
import Blockquote from "@tiptap/extension-blockquote";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TodoList from "@tiptap/extension-task-list";
import TodoItem from "@tiptap/extension-task-item";
import { useTranslation } from "@life-editor/shared";
import { createSlashCommand } from "./slashCommand";
import { createItemLinkNode } from "./itemLinkNode";
import { createItemLinkSuggestion } from "./itemLinkSuggestion";
import type { LoadItemLinkTargets } from "./useItemLinkTargets";

/*
 * Lean web Notes rich-text editor (S3). A deliberately reduced
 * re-implementation of frontend/src/components/shared/RichTextEditor.tsx
 * — the marks/blocks Notes needs: headings (1-3), bullet/ordered/checkbox
 * (todo) lists, blockquote, inline code + code block, bold / italic /
 * strike, links. A "/" slash-command menu inserts the block types
 * (slashCommand.ts); checkbox lists also accept the "[] " input shortcut
 * (TodoList's built-in rule). A "[[" suggestion inserts `itemLink` atoms —
 * Notion/Obsidian-style wiki links to other items (itemLinkNode.ts +
 * itemLinkSuggestion.ts, gated on the `loadLinkTargets` prop; the node itself is
 * ALWAYS registered so stored `[[…]]` JSON round-trips on every surface).
 * Heavier extensions (tables, color, highlight, images, bubble/context menus)
 * are still NOT ported — they land in a later S-step if needed (scope-creep
 * guard).
 *
 * Like the source, the StarterKit built-ins for the customised marks are
 * disabled and replaced by `*NoInputRules` variants so typing `**`, `*`,
 * `~~`, `` ` `` or `>` does NOT markdown-auto-convert (the Tauri app
 * relies on this; preserving it keeps note content byte-compatible).
 *
 * IME: TipTap/ProseMirror handles IME composition natively (no manual
 * keydown handlers here), so `isComposing` cannot be broken. Persistence
 * is debounced (800ms) and flushed on unmount / beforeunload so a
 * note switch never loses the last keystrokes.
 *
 * `onDraftChange` (#713) turns that persistence off for ONE caller — the todo
 * body, whose panel commits on a save button. Notes and Daily are outside Epic
 * #627 and keep auto-saving, so the switch is a prop rather than a change of
 * default.
 */

const BoldNoInputRules = Bold.extend({
  addInputRules() {
    return [];
  },
});
const ItalicNoInputRules = Italic.extend({
  addInputRules() {
    return [];
  },
});
const StrikeNoInputRules = Strike.extend({
  addInputRules() {
    return [];
  },
});
const CodeNoInputRules = Code.extend({
  addInputRules() {
    return [];
  },
});
const BlockquoteNoInputRules = Blockquote.extend({
  addInputRules() {
    return [];
  },
});

/**
 * How the editor's changes leave it — exactly one of the two (#713).
 *
 * `onUpdate` is the original and still the default everywhere: persist on an
 * 800ms debounce, flushed on unmount and on tab close.
 *
 * `onDraftChange` reports every change instead of persisting it. It switches
 * this editor to DRAFT mode — no debounce, no unmount / beforeunload flush,
 * `onUpdate` never called — for a host that commits from its own save button.
 * Opt-in per call rather than a change of default, because Notes and Daily are
 * deliberately outside Epic #627 and keep auto-saving. Nothing else about the
 * editor differs between the two modes.
 *
 * A union rather than two optionals: an editor wired to NEITHER would type its
 * user's work into a component that quietly throws it away, and that is a
 * mistake worth catching at build time instead of in the UI.
 */
type RichTextEditorPersistence =
  | { onUpdate: (content: string) => void; onDraftChange?: never }
  | { onUpdate?: never; onDraftChange: (content: string) => void };

interface RichTextEditorBaseProps {
  noteId: string;
  initialContent?: string;
  editable?: boolean;
  /** Empty-doc hint. Omitted → the translated note-body wording. */
  placeholder?: string;
  /** Container chrome override (the Daily card supplies its own fill/scroll). */
  className?: string;
  /** Enable the "/" slash-command block menu (default: true). */
  slashMenu?: boolean;
  /**
   * Put the caret at the END of the document on mount (default: false).
   *
   * For a host that mounts this editor IN RESPONSE to a gesture — Briefing's
   * evening reflection swaps a preview for the editor when the user presses it
   * (#1115) — an unfocused editor is indistinguishable from the preview it
   * replaced, so the press reads as dead and the next keystroke goes nowhere.
   * Off by default: Notes, Daily and the todo detail mount the editor as part
   * of opening a screen, where stealing focus would fight the user.
   *
   * The end of the document, not the pressed position: mapping a click
   * coordinate back to a document position needs `posAtCoords`, and jsdom has
   * no layout, so that path cannot be tested here at all (#475 is what happens
   * when it rots unnoticed).
   *
   * Applied once per Editor instance, from `onCreate` below — see it for why
   * not TipTap's own `autofocus` option.
   */
  autoFocus?: boolean;
  /**
   * Loader for the "[[" link autocomplete pool (`useItemLinkTargets`). Presence
   * enables the suggestion + click navigation; `undefined` leaves both off (the
   * itemLink node is still registered so stored links round-trip). It is a
   * loader rather than an array because the pool is fetched on the first "[["
   * instead of on every sync bump (#430).
   */
  loadLinkTargets?: LoadItemLinkTargets;
  /** Navigate to a resolved link's target (section switch + item select). */
  onNavigateToItem?: (target: { id: string; role: string }) => void;
  /** A resolved link was inserted — the host upserts the item_links edge. */
  onResolvedLinkInserted?: (targetId: string) => void;
  /** Create a note for `label` from the "[[" menu; returns its id or null. */
  onCreateNoteForLink?: (label: string) => Promise<{ id: string } | null>;
}

export type RichTextEditorProps = RichTextEditorBaseProps &
  RichTextEditorPersistence;

function tryParseJSON(str: string): Record<string, unknown> | string {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

export function RichTextEditor({
  noteId,
  initialContent,
  onUpdate,
  onDraftChange,
  editable = true,
  placeholder,
  className = "rounded-md border border-lumen-border bg-lumen-bg p-3",
  slashMenu = true,
  autoFocus = false,
  loadLinkTargets,
  onNavigateToItem,
  onResolvedLinkInserted,
  onCreateNoteForLink,
}: RichTextEditorProps) {
  const { t } = useTranslation();
  const debounceRef = useRef<number | null>(null);
  const onUpdateRef = useRef(onUpdate);
  const onDraftChangeRef = useRef(onDraftChange);
  const latestContentRef = useRef<string | null>(null);

  // The editor is rebuilt only on [noteId] (below), so link wiring is read
  // through refs kept fresh every render — capturing the values directly would
  // freeze the candidate pool + callbacks at mount (stale on every re-render).
  const loadLinkTargetsRef = useRef<LoadItemLinkTargets | undefined>(
    loadLinkTargets,
  );
  const onResolvedInsertedRef = useRef(onResolvedLinkInserted);
  const onCreateNoteRef = useRef(onCreateNoteForLink);
  const onNavigateRef = useRef(onNavigateToItem);
  const autoFocusRef = useRef(autoFocus);
  const linkEnabled = loadLinkTargets !== undefined;

  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onDraftChangeRef.current = onDraftChange;
    autoFocusRef.current = autoFocus;
    loadLinkTargetsRef.current = loadLinkTargets;
    onResolvedInsertedRef.current = onResolvedLinkInserted;
    onCreateNoteRef.current = onCreateNoteForLink;
    onNavigateRef.current = onNavigateToItem;
  });

  // Stable getters over the refs above. Wrapping them in useCallback (rather
  // than inlining `() => ref.current` in the extension list) keeps the ref read
  // out of the render path — the extensions, built once per [noteId], call
  // these later to reach the latest closures without the pool going stale.
  const loadTargets = useCallback<LoadItemLinkTargets>(
    (options) => loadLinkTargetsRef.current?.(options) ?? Promise.resolve([]),
    [],
  );
  const getOnResolvedInserted = useCallback(
    () => onResolvedInsertedRef.current,
    [],
  );
  const getCreateNote = useCallback(() => onCreateNoteRef.current, []);
  const getOnNavigate = useCallback(() => onNavigateRef.current, []);

  const flushPending = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (latestContentRef.current !== null) {
      onUpdateRef.current?.(latestContentRef.current);
      latestContentRef.current = null;
    }
  };
  // Draft mode never parks anything in latestContentRef, so both flushes above
  // are already no-ops there — the "do not write on unmount" half of #713 needs
  // no branch of its own.

  // Flush on unmount (note switch).
  useEffect(() => {
    // flushPending only touches refs (stable for the component lifetime),
    // so an empty dep array is correct here.
    return () => {
      flushPending();
    };
  }, []);

  // Flush on tab/window close.
  useEffect(() => {
    const handler = () => flushPending();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          bold: false,
          italic: false,
          strike: false,
          code: false,
          blockquote: false,
          link: false,
          dropcursor: { color: "var(--color-accent)", width: 2 },
        }),
        BoldNoInputRules,
        ItalicNoInputRules,
        StrikeNoInputRules,
        CodeNoInputRules,
        BlockquoteNoInputRules,
        Link.configure({
          openOnClick: false,
          protocols: ["http", "https", "mailto"],
          defaultProtocol: "https",
        }),
        // The fallback is translated, not a hardcoded English string: a call
        // site that passes nothing (the Kanban todo body) used to print
        // "Write your note…" on a Japanese screen (#680).
        Placeholder.configure({
          placeholder: placeholder ?? t("materials.notes.bodyPlaceholder"),
        }),
        // Checkbox lists — the built-in input rule turns a leading "[] " (or
        // "[x] ") into a todo item; nested items allow indented sub-todos.
        TodoList,
        TodoItem.configure({ nested: true }),
        // "/" slash-command block menu (headings + lists). Labels reuse the
        // turn-into catalog so the picker matches the rest of the app.
        ...(slashMenu
          ? [
              createSlashCommand({
                heading1: t("blockMenu.turnIntoItems.heading1"),
                heading2: t("blockMenu.turnIntoItems.heading2"),
                heading3: t("blockMenu.turnIntoItems.heading3"),
                bulletList: t("blockMenu.turnIntoItems.bulletList"),
                orderedList: t("blockMenu.turnIntoItems.orderedList"),
                taskList: t("blockMenu.turnIntoItems.taskList"),
                empty: t("blockMenu.noMatch"),
              }),
            ]
          : []),
        // itemLink atom — ALWAYS registered so stored `[[…]]` JSON round-trips
        // on every surface (schema must know the node even where the "[["
        // suggestion is off). Click navigation reads the host callback through
        // the ref getter, like the other link wiring below (#475 — a directly
        // captured prop froze at whatever the host passed on the mount render).
        // react-hooks/refs cannot see that TipTap only stores the getter and
        // calls it from a click handler; the identical getters below escape the
        // rule only because they sit behind a conditional spread.
        // eslint-disable-next-line react-hooks/refs
        createItemLinkNode({
          getOnNavigate,
        }),
        // "[[" wiki-link autocomplete — gated on the loadLinkTargets prop. The
        // loader + callbacks are read through refs so they never go stale.
        ...(linkEnabled
          ? [
              createItemLinkSuggestion({
                loadTargets,
                getOnResolvedInserted,
                getCreateNote,
                labels: {
                  empty: t("itemLink.empty"),
                  unresolved: (query) =>
                    t("itemLink.insertUnresolved", { query }),
                  create: (query) => t("itemLink.createNote", { query }),
                  roleNote: t("itemLink.roleNote"),
                  roleDaily: t("itemLink.roleDaily"),
                  roleTodo: t("itemLink.roleTodo"),
                },
              }),
            ]
          : []),
      ],
      editable,
      content: initialContent ? tryParseJSON(initialContent) : undefined,
      enableContentCheck: true,
      onContentError: ({ error }) => {
        console.warn(
          "[web RichTextEditor] TipTap content schema error",
          error,
          {
            noteId,
          },
        );
      },
      onUpdate: ({ editor }) => {
        const json = JSON.stringify(editor.getJSON());
        // #713: draft mode reports and stops. Read through the ref because the
        // editor is built once per [noteId] — a directly captured prop would
        // freeze at mount, which is the #475 shape.
        if (onDraftChangeRef.current) {
          onDraftChangeRef.current(json);
          return;
        }
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        latestContentRef.current = json;
        debounceRef.current = window.setTimeout(() => {
          onUpdateRef.current?.(json);
          latestContentRef.current = null;
          debounceRef.current = null;
        }, 800);
      },
      onCreate: ({ editor: created }) => {
        /*
         * #1115's focus, and NOT through TipTap's own `autofocus` option.
         *
         * `scrollIntoView: false`, because the only host that asks for focus
         * does so on a press of the very block being replaced — it is already
         * on screen, and a scroll can only move the page out from under the
         * user. It is also what makes this testable: the scroll runs
         * ProseMirror's `coordsAtPos` -> `getClientRects`, which jsdom does
         * not implement, and it throws from a setTimeout after the test has
         * already finished (rules/frontend.md §テスト環境の制約).
         *
         * `onCreate` rather than an effect, because `editor.commands` reads
         * through the ProseMirror view and the view does not exist yet at the
         * first effect that sees a non-null editor. Through the ref rather
         * than the prop, because this config is built once per [noteId].
         */
        if (autoFocusRef.current) {
          created.commands.focus("end", { scrollIntoView: false });
        }
      },
      editorProps: {
        attributes: { class: "note-editor-content outline-none" },
      },
    },
    [noteId],
  );

  useEffect(() => {
    // `emitUpdate: false`. TipTap's setEditable fires an `update` by default,
    // and this effect runs once on mount with the SAME value useEditor was
    // already built with — so every open reported a change nobody made. Under
    // auto-save that only cost a redundant write of identical content (and the
    // `updated_at` bump the sync cursor reads from it); under #713's draft mode
    // it would light the save button up before the user had typed anything.
    // Toggling editability is not a content change either way.
    if (editor) editor.setEditable(editable, false);
  }, [editor, editable]);

  return (
    <div className={`note-editor ${className}`}>
      <EditorContent editor={editor} />
    </div>
  );
}
