import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link as LinkIcon,
  Palette,
  X,
  Check,
  ChevronDown,
} from "lucide-react";
import { isMac } from "../../../utils/platform";
import { isValidUrl } from "../../../utils/urlValidation";
import { useSlashCommand } from "../../../hooks/useSlashCommand";
import { PANEL_COMMANDS, getCurrentBlockLabel } from "./editorCommands";
import { CommandPanel } from "./CommandPanel";
import { UnifiedColorPicker } from "../../shared/UnifiedColorPicker";

interface BubbleToolbarProps {
  editor: Editor;
}

export function BubbleToolbar({ editor }: BubbleToolbarProps) {
  const [linkMode, setLinkMode] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTurnInto, setShowTurnInto] = useState(false);

  const slash = useSlashCommand(editor, PANEL_COMMANDS);

  const shouldShow = useCallback(
    ({
      editor: ed,
      from,
      to,
    }: {
      editor: Editor;
      from: number;
      to: number;
    }) => {
      if (slash.isOpen) return false;
      if (from === to) return false;
      if (ed.isActive("codeBlock")) return false;
      const sel = ed.state.selection;
      if (
        "node" in sel &&
        sel.node &&
        typeof sel.node === "object" &&
        "type" in sel.node
      ) {
        const nodeType = (sel.node as { type: { name: string } }).type;
        if (nodeType.name === "image" || nodeType.name === "wikiTag")
          return false;
      }
      return true;
    },
    [slash.isOpen],
  );

  const handleLinkOpen = () => {
    const existing = editor.getAttributes("link").href ?? "";
    setLinkUrl(existing);
    setLinkMode(true);
  };

  const handleLinkApply = () => {
    const validated = isValidUrl(linkUrl);
    if (validated) {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: validated })
        .run();
      setLinkMode(false);
      setLinkUrl("");
      setLinkError("");
    } else if (linkUrl.trim()) {
      setLinkError("有効なURLを入力してください（http/https）");
    } else {
      setLinkMode(false);
      setLinkUrl("");
      setLinkError("");
    }
  };

  const handleLinkRemove = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkMode(false);
    setLinkUrl("");
  };

  const handleLinkCancel = () => {
    setLinkMode(false);
    setLinkUrl("");
    setLinkError("");
  };

  const handleLinkKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleLinkApply();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      handleLinkCancel();
    }
  };

  const handleColorSelect = (color: string) => {
    if (color) {
      editor.chain().focus().setColor(color).run();
    } else {
      editor.chain().focus().unsetColor().run();
    }
    setShowColorPicker(false);
  };

  const handleHide = () => {
    setLinkMode(false);
    setLinkUrl("");
    setLinkError("");
    setShowColorPicker(false);
    setShowTurnInto(false);
  };

  const handleTurnIntoExecute = useCallback(
    (index: number) => {
      PANEL_COMMANDS[index]?.action(editor);
      setShowTurnInto(false);
    },
    [editor],
  );

  // --- Slash mode: portal-based CommandPanel ---
  if (slash.isOpen) {
    const portalTarget = editor.view.dom.parentElement;
    if (!portalTarget) return null;

    return createPortal(
      <div
        className="bubble-toolbar-slash-wrapper"
        style={{ top: slash.position.top, left: slash.position.left }}
      >
        <CommandPanel
          editor={editor}
          commands={slash.filteredCommands}
          mode="slash"
          selectedIndex={slash.selectedIndex}
          filterQuery={slash.query}
          onExecute={slash.executeCommand}
          onClose={slash.close}
          deleteSlashText={slash.deleteSlashText}
        />
      </div>,
      portalTarget,
    );
  }

  // --- Selection mode: BubbleMenu with unified UI ---
  if (linkMode) {
    return (
      <BubbleMenu editor={editor} shouldShow={shouldShow} updateDelay={100}>
        <div className="bubble-toolbar-unified">
          <div className="bubble-toolbar" onMouseLeave={handleHide}>
            <input
              className={`bubble-toolbar-link-input${linkError ? " border-red-500" : ""}`}
              type="url"
              placeholder="Paste URL..."
              value={linkUrl}
              onChange={(e) => {
                setLinkUrl(e.target.value);
                setLinkError("");
              }}
              onKeyDown={handleLinkKeyDown}
              title={linkError || undefined}
              autoFocus
            />
            <button
              className="bubble-toolbar-btn"
              onMouseDown={(e) => {
                e.preventDefault();
                handleLinkApply();
              }}
              title="Apply"
            >
              <Check size={14} />
            </button>
            {editor.isActive("link") && (
              <button
                className="bubble-toolbar-btn"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleLinkRemove();
                }}
                title="Remove link"
              >
                <X size={14} />
              </button>
            )}
            <button
              className="bubble-toolbar-btn"
              onMouseDown={(e) => {
                e.preventDefault();
                handleLinkCancel();
              }}
              title="Cancel (Esc)"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </BubbleMenu>
    );
  }

  return (
    <BubbleMenu editor={editor} shouldShow={shouldShow} updateDelay={100}>
      <div className="bubble-toolbar-unified">
        <div
          className="bubble-toolbar"
          onMouseLeave={() => setShowColorPicker(false)}
        >
          {/* Turn Into dropdown */}
          <div className="bubble-toolbar-turninto-wrapper">
            <button
              className="bubble-toolbar-turninto-btn"
              onMouseDown={(e) => {
                e.preventDefault();
                setShowTurnInto(!showTurnInto);
              }}
              title="Turn into..."
            >
              <span>{getCurrentBlockLabel(editor)}</span>
              <ChevronDown size={12} />
            </button>
          </div>

          <div className="bubble-toolbar-divider" />

          <button
            className={`bubble-toolbar-btn ${editor.isActive("bold") ? "is-active" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleBold().run();
            }}
            title={isMac ? "Bold (⌘B)" : "Bold (Ctrl+B)"}
          >
            <Bold size={14} />
          </button>
          <button
            className={`bubble-toolbar-btn ${editor.isActive("italic") ? "is-active" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleItalic().run();
            }}
            title={isMac ? "Italic (⌘I)" : "Italic (Ctrl+I)"}
          >
            <Italic size={14} />
          </button>
          <button
            className={`bubble-toolbar-btn ${editor.isActive("strike") ? "is-active" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleStrike().run();
            }}
            title={
              isMac ? "Strikethrough (⌘⇧S)" : "Strikethrough (Ctrl+Shift+S)"
            }
          >
            <Strikethrough size={14} />
          </button>
          <button
            className={`bubble-toolbar-btn ${editor.isActive("code") ? "is-active" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleCode().run();
            }}
            title={isMac ? "Code (⌘E)" : "Code (Ctrl+E)"}
          >
            <Code size={14} />
          </button>

          <div className="bubble-toolbar-divider" />

          <button
            className={`bubble-toolbar-btn ${editor.isActive("link") ? "is-active" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              handleLinkOpen();
            }}
            title={isMac ? "Link (⌘K)" : "Link (Ctrl+K)"}
          >
            <LinkIcon size={14} />
          </button>

          <div className="bubble-toolbar-divider" />

          <button
            className="bubble-toolbar-btn"
            onMouseDown={(e) => {
              e.preventDefault();
              setShowColorPicker(!showColorPicker);
            }}
            title="Text color"
          >
            <Palette size={14} />
          </button>
          {showColorPicker && (
            <>
              <div className="bubble-toolbar-divider" />
              <UnifiedColorPicker
                color=""
                onChange={handleColorSelect}
                mode="preset-only"
              />
            </>
          )}
        </div>

        {/* Turn Into CommandPanel dropdown */}
        {showTurnInto && (
          <CommandPanel
            editor={editor}
            commands={PANEL_COMMANDS}
            mode="selection"
            selectedIndex={-1}
            filterQuery=""
            onExecute={handleTurnIntoExecute}
            onClose={() => setShowTurnInto(false)}
          />
        )}
      </div>
    </BubbleMenu>
  );
}
