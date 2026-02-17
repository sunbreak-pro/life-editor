import { useState, useRef, useCallback } from "react";
import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Code2,
  Quote,
  Minus,
  CheckSquare,
  ChevronRight,
  Table2,
  Lightbulb,
  ImageIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { useSlashCommand } from "../../../hooks/useSlashCommand";
import { isValidUrl } from "../../../utils/urlValidation";

interface CommandItem {
  title: string;
  icon: ComponentType<{ size?: number }>;
  command: (editor: Editor) => void;
}

const COMMANDS: CommandItem[] = [
  {
    title: "Heading 1",
    icon: Heading1,
    command: (editor) =>
      editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    title: "Heading 2",
    icon: Heading2,
    command: (editor) =>
      editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    title: "Heading 3",
    icon: Heading3,
    command: (editor) =>
      editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    title: "Bullet List",
    icon: List,
    command: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    title: "Ordered List",
    icon: ListOrdered,
    command: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    title: "Code Block",
    icon: Code2,
    command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    title: "Blockquote",
    icon: Quote,
    command: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    title: "Horizontal Rule",
    icon: Minus,
    command: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    title: "Paragraph",
    icon: Minus,
    command: (editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    title: "Task List",
    icon: CheckSquare,
    command: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    title: "Toggle List",
    icon: ChevronRight,
    command: (editor) => {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "toggleList",
          attrs: { open: true },
          content: [
            {
              type: "toggleSummary",
              content: [{ type: "text", text: "Toggle" }],
            },
            { type: "toggleContent", content: [{ type: "paragraph" }] },
          ],
        })
        .run();
    },
  },
  {
    title: "Table",
    icon: Table2,
    command: (editor) => {
      editor
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
  {
    title: "Callout",
    icon: Lightbulb,
    command: (editor) => {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "callout",
          attrs: { emoji: "\u{1F4A1}" },
          content: [{ type: "text", text: "Callout text..." }],
        })
        .run();
    },
  },
  {
    title: "Image",
    icon: ImageIcon,
    command: () => {
      // Handled via IMAGE_COMMAND_ID in component
    },
  },
];

const IMAGE_COMMAND_ID = "Image";

interface SlashCommandMenuProps {
  editor: Editor;
}

export function SlashCommandMenu({ editor }: SlashCommandMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [imageUrlInput, setImageUrlInput] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageUrlError, setImageUrlError] = useState("");
  const { isOpen, position, selectedIndex, filteredCommands, executeCommand } =
    useSlashCommand(editor, COMMANDS);

  const handleImageExecute = useCallback(
    (index: number) => {
      const cmd = filteredCommands[index];
      if (cmd?.title === IMAGE_COMMAND_ID) {
        setImageUrlInput(true);
        setImageUrl("");
        setImageUrlError("");
      } else {
        executeCommand(index);
      }
    },
    [filteredCommands, executeCommand],
  );

  const handleImageUrlApply = useCallback(() => {
    const validated = isValidUrl(imageUrl);
    if (validated) {
      editor.chain().focus().setImage({ src: validated }).run();
      setImageUrlInput(false);
      setImageUrl("");
      setImageUrlError("");
    } else {
      setImageUrlError("有効なURLを入力してください（http/https）");
    }
  }, [editor, imageUrl]);

  const handleImageUrlCancel = useCallback(() => {
    setImageUrlInput(false);
    setImageUrl("");
    setImageUrlError("");
  }, []);

  if (!isOpen && !imageUrlInput) return null;
  if (isOpen && !imageUrlInput && filteredCommands.length === 0) return null;

  if (imageUrlInput) {
    return (
      <div
        className="absolute z-50 bg-notion-bg border border-notion-border rounded-lg shadow-lg p-3 w-72"
        style={{ top: position.top, left: position.left }}
      >
        <div className="text-xs text-notion-text-secondary mb-2">画像URL</div>
        <input
          className={`w-full px-2 py-1 text-sm bg-notion-bg border rounded outline-none focus:border-blue-500 ${imageUrlError ? "border-red-500" : "border-notion-border"}`}
          type="url"
          placeholder="https://example.com/image.png"
          value={imageUrl}
          onChange={(e) => {
            setImageUrl(e.target.value);
            setImageUrlError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleImageUrlApply();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              handleImageUrlCancel();
            }
          }}
          autoFocus
        />
        {imageUrlError && (
          <div className="text-xs text-red-500 mt-1">{imageUrlError}</div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-notion-bg border border-notion-border rounded-lg shadow-lg p-2 w-fit h-50 overflow-auto"
      style={{ top: position.top, left: position.left }}
    >
      {filteredCommands.map((cmd, i) => {
        const Icon = (cmd as CommandItem).icon;
        return (
          <button
            key={cmd.title}
            onMouseDown={(e) => {
              e.preventDefault();
              handleImageExecute(i);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-notion-text hover:bg-notion-hover transition-colors ${
              i === selectedIndex ? "bg-notion-hover" : ""
            }`}
          >
            <Icon size={16} />
            <span>{cmd.title}</span>
          </button>
        );
      })}
    </div>
  );
}

export const SlashCommandExtension = Extension.create({
  name: "slashCommand",
});
