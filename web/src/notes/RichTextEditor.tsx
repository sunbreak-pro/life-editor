import { useEffect, useRef } from "react";
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

/*
 * Lean web Notes rich-text editor (S3). A deliberately reduced
 * re-implementation of frontend/src/components/shared/RichTextEditor.tsx
 * — the marks/blocks Notes needs: headings (1-3), bullet/ordered/checkbox
 * (task) lists, blockquote, inline code + code block, bold / italic /
 * strike, links. A "/" slash-command menu inserts the block types
 * (slashCommand.ts); checkbox lists also accept the "[] " input shortcut
 * (TaskList's built-in rule). Heavier extensions (tables, color, highlight,
 * images, wiki/note-link suggestion, bubble/context menus) are still NOT
 * ported — they land in a later S-step if needed (scope-creep guard).
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
}: RichTextEditorProps) {
  const { t } = useTranslation();
  const debounceRef = useRef<number | null>(null);
  const onUpdateRef = useRef(onUpdate);
  const latestContentRef = useRef<string | null>(null);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  });

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
