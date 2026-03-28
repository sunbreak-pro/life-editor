import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { MoreVertical } from "lucide-react";
import { setStoredHeadingFontSize } from "../../../utils/headingFontSize";
import {
  type PanelCommand,
  type SubAction,
  GROUP_ORDER,
} from "./editorCommands";

const IMAGE_COMMAND_ID = "Image";
const PDF_COMMAND_ID = "PDF";

interface CommandPanelProps {
  editor: Editor;
  commands: PanelCommand[];
  mode: "selection" | "slash";
  selectedIndex: number;
  filterQuery: string;
  onExecute: (index: number) => void;
  onClose: () => void;
  deleteSlashText?: () => void;
  onImageUpload?: (file: File) => void;
  onPdfUpload?: (file: File) => void;
}

export function CommandPanel({
  editor,
  commands,
  mode,
  selectedIndex,
  filterQuery,
  onExecute,
  onClose,
  deleteSlashText,
  onImageUpload,
  onPdfUpload,
}: CommandPanelProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubMenu, setActiveSubMenu] = useState<number | null>(null);
  const [subMenuPos, setSubMenuPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [customFontSizeInput, setCustomFontSizeInput] = useState(false);
  const [customFontSize, setCustomFontSize] = useState("");
  const [customFontSizeLevel, setCustomFontSizeLevel] = useState<1 | 2 | 3>(1);

  const openFilePicker = useCallback(
    (accept: string, handler: (file: File) => void) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) handler(file);
      };
      input.click();
    },
    [],
  );

  const handleExecute = useCallback(
    (index: number) => {
      const cmd = commands[index];
      if (cmd?.title === IMAGE_COMMAND_ID) {
        deleteSlashText?.();
        openFilePicker("image/png,image/jpeg,image/gif,image/webp", (file) => {
          onImageUpload?.(file);
          onClose();
        });
      } else if (cmd?.title === PDF_COMMAND_ID) {
        deleteSlashText?.();
        openFilePicker(".pdf,application/pdf", (file) => {
          onPdfUpload?.(file);
          onClose();
        });
      } else {
        onExecute(index);
      }
    },
    [
      commands,
      onExecute,
      deleteSlashText,
      openFilePicker,
      onImageUpload,
      onPdfUpload,
      onClose,
    ],
  );

  const handleSubAction = useCallback(
    (sub: SubAction, cmd: PanelCommand) => {
      if (sub.label === "Custom...") {
        const headingMatch = cmd.title.match(/^Heading (\d)$/);
        const level = headingMatch
          ? (parseInt(headingMatch[1]) as 1 | 2 | 3)
          : 1;
        deleteSlashText?.();
        setCustomFontSizeLevel(level);
        setCustomFontSizeInput(true);
        setCustomFontSize("");
        setActiveSubMenu(null);
        setSubMenuPos(null);
      } else {
        deleteSlashText?.();
        sub.action(editor);
        setActiveSubMenu(null);
        setSubMenuPos(null);
        onClose();
      }
    },
    [editor, deleteSlashText, onClose],
  );

  // Custom font size input view
  if (customFontSizeInput) {
    return (
      <div className="command-panel-inline command-panel-fontsize-input">
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
                setStoredHeadingFontSize(customFontSizeLevel, `${size}px`);
                editor
                  .chain()
                  .focus()
                  .setHeading({ level: customFontSizeLevel })
                  .updateAttributes("heading", { fontSize: `${size}px` })
                  .run();
              }
              setCustomFontSizeInput(false);
              setCustomFontSize("");
              onClose();
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

  if (commands.length === 0) return null;

  // Group commands
  const grouped: {
    group: string;
    items: { cmd: PanelCommand; globalIndex: number }[];
  }[] = [];
  const groupMap = new Map<
    string,
    { cmd: PanelCommand; globalIndex: number }[]
  >();

  commands.forEach((cmd, i) => {
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
    <div ref={menuRef} className="command-panel-inline">
      {mode === "slash" && filterQuery && (
        <div className="command-panel-filter">
          <span className="command-panel-filter-slash">/</span>
          {filterQuery}
        </div>
      )}
      {grouped.map((g) => (
        <div key={g.group} className="command-panel-group">
          <div className="command-panel-group-label">{g.group}</div>
          {g.items.map(({ cmd, globalIndex }) => {
            const Icon = cmd.icon;
            const isSelected =
              mode === "slash" && globalIndex === selectedIndex;
            const isActive =
              mode === "selection" && cmd.check?.(editor) === true;
            return (
              <div key={cmd.title} style={{ position: "relative" }}>
                <div
                  role="button"
                  tabIndex={0}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleExecute(globalIndex);
                  }}
                  className={`command-panel-item${isSelected ? " selected" : ""}${isActive ? " active" : ""}`}
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
