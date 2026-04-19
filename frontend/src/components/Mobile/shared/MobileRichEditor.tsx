import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef } from "react";

interface MobileRichEditorProps {
  entityId: string;
  initialContent?: string;
  onChange: (content: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

function parseInitialContent(raw: string | undefined): unknown {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // fall through to plain text
    }
  }
  return raw;
}

export function MobileRichEditor({
  entityId,
  initialContent,
  onChange,
  placeholder,
  debounceMs = 400,
}: MobileRichEditorProps) {
  const onChangeRef = useRef(onChange);
  const debounceRef = useRef<number | null>(null);
  const pendingRef = useRef<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      if (pendingRef.current !== null) {
        onChangeRef.current(pendingRef.current);
        pendingRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      if (pendingRef.current !== null) {
        onChangeRef.current(pendingRef.current);
        pendingRef.current = null;
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        Placeholder.configure({
          placeholder: placeholder ?? "",
        }),
      ],
      content: parseInitialContent(initialContent),
      editorProps: {
        attributes: {
          class: "memo-editor outline-none",
        },
      },
      onUpdate: ({ editor }) => {
        const json = JSON.stringify(editor.getJSON());
        pendingRef.current = json;
        if (debounceRef.current) window.clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(() => {
          if (pendingRef.current !== null) {
            onChangeRef.current(pendingRef.current);
            pendingRef.current = null;
          }
        }, debounceMs);
      },
    },
    [entityId],
  );

  return (
    <div className="mobile-rich-editor-wrap min-h-0 flex-1">
      <EditorContent editor={editor} />
    </div>
  );
}
