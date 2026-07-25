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
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useTranslation } from "@life-editor/shared";
import { createSlashCommand } from "./slashCommand";
import { createItemLinkNode } from "./itemLinkNode";
import {
  createItemLinkSuggestion,
  type ItemLinkTarget,
} from "./itemLinkSuggestion";

/*
 * Lean web Notes rich-text editor (S3). A deliberately reduced
 * re-implementation of frontend/src/components/shared/RichTextEditor.tsx
 * — the marks/blocks Notes needs: headings (1-3), bullet/ordered/checkbox
 * (task) lists, blockquote, inline code + code block, bold / italic /
 * strike, links. A "/" slash-command menu inserts the block types
 * (slashCommand.ts); checkbox lists also accept the "[] " input shortcut
 * (TaskList's built-in rule). A "[[" suggestion inserts `itemLink` atoms —
 * Notion/Obsidian-style wiki links to other items (itemLinkNode.ts +
 * itemLinkSuggestion.ts, gated on the `linkTargets` prop; the node itself is
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
 * note/folder switch never loses the last keystrokes.
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

interface RichTextEditorProps {
  noteId: string;
  initialContent?: string;
  onUpdate: (content: string) => void;
  editable?: boolean;
  placeholder?: string;
  /** Container chrome override (the Daily card supplies its own fill/scroll). */
  className?: string;
  /** Enable the "/" slash-command block menu (default: true). */
  slashMenu?: boolean;
  /**
   * Candidate pool for the "[[" link autocomplete. Presence (even an empty
   * array) enables the suggestion + click navigation; `undefined` leaves both
   * off (the itemLink node is still registered so stored links round-trip).
   */
  linkTargets?: ItemLinkTarget[];
  /** Navigate to a resolved link's target (section switch + item select). */
  onNavigateToItem?: (target: { id: string; role: string }) => void;
  /** A resolved link was inserted — the host upserts the item_links edge. */
  onResolvedLinkInserted?: (targetId: string) => void;
  /** Create a note for `label` from the "[[" menu; returns its id or null. */
  onCreateNoteForLink?: (label: string) => Promise<{ id: string } | null>;
}

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
  editable = true,
  placeholder = "Write your note…",
  className = "rounded-md border border-lumen-border bg-lumen-bg p-3",
  slashMenu = true,
  linkTargets,
  onNavigateToItem,
  onResolvedLinkInserted,
  onCreateNoteForLink,
}: RichTextEditorProps) {
  const { t } = useTranslation();
  const debounceRef = useRef<number | null>(null);
  const onUpdateRef = useRef(onUpdate);
  const latestContentRef = useRef<string | null>(null);

  // The editor is rebuilt only on [noteId] (below), so link wiring is read
  // through refs kept fresh every render — capturing the values directly would
  // freeze the candidate pool + callbacks at mount (stale on every re-render).
  const linkTargetsRef = useRef<ItemLinkTarget[]>(linkTargets ?? []);
  const onResolvedInsertedRef = useRef(onResolvedLinkInserted);
  const onCreateNoteRef = useRef(onCreateNoteForLink);
  const linkEnabled = linkTargets !== undefined;

  useEffect(() => {
    onUpdateRef.current = onUpdate;
    linkTargetsRef.current = linkTargets ?? [];
    onResolvedInsertedRef.current = onResolvedLinkInserted;
    onCreateNoteRef.current = onCreateNoteForLink;
  });

  // Stable getters over the refs above. Wrapping them in useCallback (rather
  // than inlining `() => ref.current` in the extension list) keeps the ref read
  // out of the render path — the extensions, built once per [noteId], call
  // these later to reach the latest closures without the pool going stale.
  const getTargets = useCallback(() => linkTargetsRef.current, []);
  const getOnResolvedInserted = useCallback(
    () => onResolvedInsertedRef.current,
    [],
  );
  const getCreateNote = useCallback(() => onCreateNoteRef.current, []);

  const flushPending = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (latestContentRef.current !== null) {
      onUpdateRef.current(latestContentRef.current);
      latestContentRef.current = null;
    }
  };

  // Flush on unmount (note/folder switch).
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
        Placeholder.configure({ placeholder }),
        // Checkbox lists — the built-in input rule turns a leading "[] " (or
        // "[x] ") into a task item; nested items allow indented sub-tasks.
        TaskList,
        TaskItem.configure({ nested: true }),
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
        // suggestion is off). Click navigation reads the host callback via ref.
        createItemLinkNode({
          onNavigate: onNavigateToItem,
        }),
        // "[[" wiki-link autocomplete — gated on the linkTargets prop. Targets +
        // callbacks are read through refs so the pool never goes stale.
        ...(linkEnabled
          ? [
              createItemLinkSuggestion({
                getTargets,
                getOnResolvedInserted,
                getCreateNote,
                labels: {
                  empty: t("itemLink.empty"),
                  unresolved: (query) =>
                    t("itemLink.insertUnresolved", { query }),
                  create: (query) => t("itemLink.createNote", { query }),
                  roleNote: t("itemLink.roleNote"),
                  roleDaily: t("itemLink.roleDaily"),
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
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        const json = JSON.stringify(editor.getJSON());
        latestContentRef.current = json;
        debounceRef.current = window.setTimeout(() => {
          onUpdateRef.current(json);
          latestContentRef.current = null;
          debounceRef.current = null;
        }, 800);
      },
      editorProps: {
        attributes: { class: "note-editor-content outline-none" },
      },
    },
    [noteId],
  );

  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editor, editable]);

  return (
    <div className={`note-editor ${className}`}>
      <EditorContent editor={editor} />
    </div>
  );
}
