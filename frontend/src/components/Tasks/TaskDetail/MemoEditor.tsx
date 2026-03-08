import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Strike from "@tiptap/extension-strike";
import Code from "@tiptap/extension-code";
import Blockquote from "@tiptap/extension-blockquote";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Image } from "@tiptap/extension-image";
import {
  ToggleList,
  ToggleSummary,
  ToggleContent,
} from "../../../extensions/ToggleList";
import { Callout } from "../../../extensions/Callout";
import { CustomHeading } from "../../../extensions/CustomHeading";
import { CustomInputRules } from "../../../extensions/InputRules";
import { SlashCommandMenu } from "./SlashCommandMenu";
import { BubbleToolbar } from "./BubbleToolbar";

// Disable markdown input rules so ** / * / ~~ / ` don't auto-convert
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
// Disable blockquote's > input rule (replaced by CustomInputRules → ToggleList)
const BlockquoteNoInputRules = Blockquote.extend({
  addInputRules() {
    return [];
  },
});

interface MemoEditorProps {
  taskId: string;
  initialContent?: string;
  onUpdate: (content: string) => void;
}

export function MemoEditor({
  taskId,
  initialContent,
  onUpdate,
}: MemoEditorProps) {
  const debounceRef = useRef<number | null>(null);
  const onUpdateRef = useRef(onUpdate);
  const latestContentRef = useRef<string | null>(null);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  });

  // Flush pending debounce on unmount (note/task switch)
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (latestContentRef.current !== null) {
        onUpdateRef.current(latestContentRef.current);
        latestContentRef.current = null;
      }
    };
  }, []);

  // Flush pending debounce on window close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (latestContentRef.current !== null) {
        onUpdateRef.current(latestContentRef.current);
        latestContentRef.current = null;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: false,
          bold: false,
          italic: false,
          strike: false,
          code: false,
          blockquote: false,
        }),
        CustomHeading.configure({ levels: [1, 2, 3] }),
        BoldNoInputRules,
        ItalicNoInputRules,
        StrikeNoInputRules,
        CodeNoInputRules,
        BlockquoteNoInputRules,
        Link.configure({ openOnClick: false }),
        TextStyle,
        Color,
        Placeholder.configure({
          placeholder: "Type '/' for commands...",
        }),
        Table.configure({ resizable: true }),
        TableRow,
        TableCell,
        TableHeader,
        Image,
        ToggleList,
        ToggleSummary,
        ToggleContent,
        Callout,
        CustomInputRules,
      ],
      content: initialContent ? tryParseJSON(initialContent) : undefined,
      onUpdate: ({ editor }) => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        const json = JSON.stringify(editor.getJSON());
        latestContentRef.current = json;
        debounceRef.current = window.setTimeout(() => {
          onUpdateRef.current(json);
          latestContentRef.current = null;
        }, 800);
      },
      editorProps: {
        attributes: {
          class: "memo-editor outline-none min-h-[200px]",
        },
      },
    },
    [taskId],
  );

  return (
    <div className="relative">
      <EditorContent editor={editor} />
      {editor && <BubbleToolbar editor={editor} />}
      {editor && <SlashCommandMenu editor={editor} />}
    </div>
  );
}

function tryParseJSON(str: string): Record<string, unknown> | string {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
