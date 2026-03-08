import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { MoreVertical } from "lucide-react";
import { useSlashCommand } from "../../../hooks/useSlashCommand";
import { isValidUrl } from "../../../utils/urlValidation";
import {
  type PanelCommand,
  type SubAction,
  PANEL_COMMANDS,
  GROUP_ORDER,
} from "./editorCommands";

const IMAGE_COMMAND_ID = "Image";

interface SlashCommandMenuProps {
  editor: Editor;
}

export function SlashCommandMenu({ editor }: SlashCommandMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [imageUrlInput, setImageUrlInput] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageUrlError, setImageUrlError] = useState("");
  const [activeSubMenu, setActiveSubMenu] = useState<number | null>(null);
  const [subMenuPos, setSubMenuPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [customFontSizeInput, setCustomFontSizeInput] = useState(false);
  const [customFontSize, setCustomFontSize] = useState("");
  const [customFontSizeLevel, setCustomFontSizeLevel] = useState<1 | 2 | 3>(1);

  const {
    isOpen,
    position,
    selectedIndex,
    filteredCommands,
    executeCommand,
    deleteSlashText,
  } = useSlashCommand(editor, PANEL_COMMANDS);

  const handleExecute = useCallback(
    (index: number) => {
      const cmd = filteredCommands[index];
      if (cmd?.title === IMAGE_COMMAND_ID) {
        deleteSlashText();
        setImageUrlInput(true);
        setImageUrl("");
        setImageUrlError("");
      } else {
        executeCommand(index);
      }
    },
    [filteredCommands, executeCommand, deleteSlashText],
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

  const handleSubAction = useCallback(
    (sub: SubAction, cmd: PanelCommand) => {
      if (sub.label === "Custom...") {
        const headingMatch = cmd.title.match(/^Heading (\d)$/);
        const level = headingMatch
          ? (parseInt(headingMatch[1]) as 1 | 2 | 3)
          : 1;
        deleteSlashText();
        setCustomFontSizeLevel(level);
        setCustomFontSizeInput(true);
        setCustomFontSize("");
        setActiveSubMenu(null);
        setSubMenuPos(null);
      } else {
        deleteSlashText();
        sub.action(editor);
        setActiveSubMenu(null);
        setSubMenuPos(null);
      }
    },
    [editor, deleteSlashText],
  );

  if (!isOpen && !imageUrlInput && !customFontSizeInput) return null;

  // Image URL input view
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

  // Custom font size input view
  if (customFontSizeInput) {
    return (
      <div
        className="command-panel command-panel-fontsize-input"
        style={{ top: position.top, left: position.left }}
      >
        <div className="command-panel-input-label">Font Size (px)</div>
        <input
          className="command-panel-number-input"
          type="number"
          placeholder="e.g. 32"
          min="8"
          max="200"
          value={customFontSize}
          onChange={(e) => setCustomFontSize(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const size = parseInt(customFontSize);
              if (size >= 8 && size <= 200) {
                editor
                  .chain()
                  .focus()
                  .setHeading({ level: customFontSizeLevel })
                  .updateAttributes("heading", { fontSize: `${size}px` })
                  .run();
              }
              setCustomFontSizeInput(false);
              setCustomFontSize("");
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setCustomFontSizeInput(false);
              setCustomFontSize("");
            }
          }}
          autoFocus
        />
      </div>
    );
  }

  if (filteredCommands.length === 0) return null;

  // Group commands
  const grouped: {
    group: string;
    items: { cmd: PanelCommand; globalIndex: number }[];
  }[] = [];
  const groupMap = new Map<
    string,
    { cmd: PanelCommand; globalIndex: number }[]
  >();

  filteredCommands.forEach((cmd, i) => {
    if (!groupMap.has(cmd.group)) {
      groupMap.set(cmd.group, []);
    }
    groupMap.get(cmd.group)!.push({ cmd, globalIndex: i });
  });

  for (const g of GROUP_ORDER) {
    const items = groupMap.get(g);
    if (items && items.length > 0) {
      grouped.push({ group: g, items });
    }
  }

  return (
    <div
      ref={menuRef}
      className="command-panel"
      style={{ top: position.top, left: position.left }}
    >
      {grouped.map((g) => (
        <div key={g.group} className="command-panel-group">
          <div className="command-panel-group-label">{g.group}</div>
          {g.items.map(({ cmd, globalIndex }) => {
            const Icon = cmd.icon;
            const isSelected = globalIndex === selectedIndex;
            return (
              <div key={cmd.title} style={{ position: "relative" }}>
                <div
                  role="button"
                  tabIndex={0}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleExecute(globalIndex);
                  }}
                  className={`command-panel-item${isSelected ? " selected" : ""}`}
                >
                  <div className="command-panel-item-icon">
                    <Icon size={18} />
                  </div>
                  <div className="command-panel-item-text">
                    <span className="command-panel-item-title">
                      {cmd.title}
                    </span>
                    <span className="command-panel-item-desc">
                      {cmd.description}
                    </span>
                  </div>
                  {cmd.subActions && (
                    <button
                      className="command-panel-item-more"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (activeSubMenu === globalIndex) {
                          setActiveSubMenu(null);
                          setSubMenuPos(null);
                        } else {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const SUBMENU_W = 120;
                          const submenuH =
                            (cmd.subActions?.length ?? 0) * 28 + 8;
                          let left = rect.right + 4;
                          if (left + SUBMENU_W > window.innerWidth)
                            left = rect.left - SUBMENU_W - 4;
                          let top = rect.top;
                          if (top + submenuH > window.innerHeight)
                            top = window.innerHeight - submenuH - 8;
                          setSubMenuPos({ top, left });
                          setActiveSubMenu(globalIndex);
                        }
                      }}
                      type="button"
                    >
                      <MoreVertical size={14} />
                    </button>
                  )}
                </div>
                {activeSubMenu === globalIndex &&
                  cmd.subActions &&
                  subMenuPos &&
                  createPortal(
                    <div
                      className="command-panel-submenu"
                      style={{ top: subMenuPos.top, left: subMenuPos.left }}
                      onMouseLeave={() => {
                        setActiveSubMenu(null);
                        setSubMenuPos(null);
                      }}
                    >
                      {cmd.subActions.map((sub) => (
                        <button
                          key={sub.label}
                          className="command-panel-submenu-item"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSubAction(sub, cmd);
                          }}
                          type="button"
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>,
                    document.body,
                  )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export const SlashCommandExtension = Extension.create({
  name: "slashCommand",
});
