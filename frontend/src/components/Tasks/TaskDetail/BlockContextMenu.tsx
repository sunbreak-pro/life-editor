import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { Editor } from "@tiptap/react";
import type { Node as PmNode } from "@tiptap/pm/model";
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code2,
  Lightbulb,
  ChevronRight,
  Palette,
  PaintBucket,
  Copy,
  Trash2,
  Plus,
  ChevronRight as SubArrow,
} from "lucide-react";
import { PANEL_COMMANDS } from "./editorCommands";
import { BLOCK_BG_COLORS } from "../../../extensions/BlockBackground";
import { CALLOUT_COLORS } from "../../../extensions/Callout";
import { TextSelection } from "@tiptap/pm/state";
import { safeDispatch } from "../../../utils/prosemirrorHelpers";

interface BlockContextMenuProps {
  x: number;
  y: number;
  editor: Editor;
  blockPos: number;
  blockNode: PmNode;
  onClose: () => void;
}

// Turn Into commands: exclude Database, Image, PDF, HR
const TURN_INTO_COMMANDS = PANEL_COMMANDS.filter(
  (cmd) => !["Database", "Image", "PDF", "Horizontal Rule"].includes(cmd.title),
);

const TURN_INTO_ICONS: Record<string, typeof Type> = {
  Paragraph: Type,
  "Heading 1": Heading1,
  "Heading 2": Heading2,
  "Heading 3": Heading3,
  Blockquote: Quote,
  "Code Block": Code2,
  "Bullet List": List,
  "Ordered List": ListOrdered,
  "Task List": CheckSquare,
  Callout: Lightbulb,
  "Toggle List": ChevronRight,
};

const TEXT_COLORS = [
  { label: "Default", value: "" },
  { label: "Red", value: "#E03E3E" },
  { label: "Blue", value: "#2EAADC" },
  { label: "Green", value: "#0F7B6C" },
  { label: "Yellow", value: "#DFAB01" },
  { label: "Gray", value: "#6B7280" },
  { label: "Purple", value: "#9B59B6" },
  { label: "Orange", value: "#D9730D" },
];

const TURN_INTO_I18N: Record<string, string> = {
  Paragraph: "paragraph",
  "Heading 1": "heading1",
  "Heading 2": "heading2",
  "Heading 3": "heading3",
  Blockquote: "blockquote",
  "Code Block": "codeBlock",
  "Bullet List": "bulletList",
  "Ordered List": "orderedList",
  "Task List": "taskList",
  Callout: "callout",
  "Toggle List": "toggleList",
};

type SubMenu = "turnInto" | "color" | "background" | "calloutColor" | null;

export function BlockContextMenu({
  x,
  y,
  editor,
  blockPos,
  blockNode,
  onClose,
}: BlockContextMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [subMenu, setSubMenu] = useState<SubMenu>(null);

  const isCallout = blockNode.type.name === "callout";
  const showAddIcon = isCallout && blockNode.attrs.showIcon === false;

  // Position adjustment to keep menu in viewport
  const [position, setPosition] = useState({ left: x, top: y });
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const newPos = { left: x, top: y };
    if (rect.right > window.innerWidth - 8) {
      newPos.left = window.innerWidth - rect.width - 8;
    }
    if (rect.bottom > window.innerHeight - 8) {
      newPos.top = window.innerHeight - rect.height - 8;
    }
    setPosition(newPos);
  }, [x, y]);

  // Click outside to close
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleTurnInto = useCallback(
    (index: number) => {
      // Focus editor at the block position first
      try {
        const resolved = editor.state.doc.resolve(blockPos + 1);
        editor.view.dispatch(
          editor.state.tr.setSelection(TextSelection.near(resolved)),
        );
      } catch {
        /* best-effort */
      }
      TURN_INTO_COMMANDS[index]?.action(editor);
      onClose();
    },
    [editor, blockPos, onClose],
  );

  const handleTextColor = useCallback(
    (color: string) => {
      // Select all text in the block, then apply color
      try {
        const blockEnd = blockPos + blockNode.nodeSize;
        const tr = editor.state.tr.setSelection(
          TextSelection.create(editor.state.doc, blockPos + 1, blockEnd - 1),
        );
        editor.view.dispatch(tr);
        if (color) {
          editor.chain().setColor(color).run();
        } else {
          editor.chain().unsetColor().run();
        }
      } catch {
        /* best-effort */
      }
      onClose();
    },
    [editor, blockPos, blockNode, onClose],
  );

  const handleBackground = useCallback(
    (color: string) => {
      safeDispatch(editor.view, (tr) =>
        tr.setNodeMarkup(blockPos, undefined, {
          ...blockNode.attrs,
          backgroundColor: color || null,
        }),
      );
      onClose();
    },
    [editor, blockPos, blockNode, onClose],
  );

  const handleDuplicate = useCallback(() => {
    safeDispatch(editor.view, (tr) => {
      const blockEnd = blockPos + blockNode.nodeSize;
      const slice = editor.state.doc.slice(blockPos, blockEnd);
      return tr.insert(blockEnd, slice.content);
    });
    onClose();
  }, [editor, blockPos, blockNode, onClose]);

  const handleDelete = useCallback(() => {
    safeDispatch(editor.view, (tr) =>
      tr.delete(blockPos, blockPos + blockNode.nodeSize),
    );
    onClose();
  }, [editor, blockPos, blockNode, onClose]);

  const handleAddIcon = useCallback(() => {
    safeDispatch(editor.view, (tr) =>
      tr.setNodeMarkup(blockPos, undefined, {
        ...blockNode.attrs,
        showIcon: true,
        iconName: "Lightbulb",
      }),
    );
    onClose();
  }, [editor, blockPos, blockNode, onClose]);

  const handleCalloutColor = useCallback(
    (colorKey: string) => {
      safeDispatch(editor.view, (tr) =>
        tr.setNodeMarkup(blockPos, undefined, {
          ...blockNode.attrs,
          color: colorKey,
        }),
      );
      onClose();
    },
    [editor, blockPos, blockNode, onClose],
  );

  return createPortal(
    <div
      ref={menuRef}
      className="block-context-menu"
      style={{ left: position.left, top: position.top }}
    >
      {/* Turn Into */}
      <div
        className="block-context-menu-item"
        onMouseEnter={() => setSubMenu("turnInto")}
      >
        <Type size={14} />
        <span>{t("blockMenu.turnInto")}</span>
        <SubArrow size={12} className="block-context-menu-arrow" />
      </div>

      {/* Color (text color for normal blocks, callout color for callouts) */}
      <div
        className="block-context-menu-item"
        onMouseEnter={() => setSubMenu("color")}
      >
        <Palette size={14} />
        <span>{t("blockMenu.color")}</span>
        <SubArrow size={12} className="block-context-menu-arrow" />
      </div>

      {/* Background */}
      <div
        className="block-context-menu-item"
        onMouseEnter={() =>
          setSubMenu(isCallout ? "calloutColor" : "background")
        }
      >
        <PaintBucket size={14} />
        <span>{t("blockMenu.background")}</span>
        <SubArrow size={12} className="block-context-menu-arrow" />
      </div>

      <div className="block-context-menu-separator" />

      {/* Duplicate */}
      <div
        className="block-context-menu-item"
        onMouseEnter={() => setSubMenu(null)}
        onClick={handleDuplicate}
      >
        <Copy size={14} />
        <span>{t("blockMenu.duplicate")}</span>
      </div>

      {/* Delete */}
      <div
        className="block-context-menu-item block-context-menu-item-danger"
        onMouseEnter={() => setSubMenu(null)}
        onClick={handleDelete}
      >
        <Trash2 size={14} />
        <span>{t("blockMenu.delete")}</span>
      </div>

      {/* Add Icon (Callout only) */}
      {showAddIcon && (
        <>
          <div className="block-context-menu-separator" />
          <div
            className="block-context-menu-item"
            onMouseEnter={() => setSubMenu(null)}
            onClick={handleAddIcon}
          >
            <Plus size={14} />
            <span>{t("blockMenu.addIcon")}</span>
          </div>
        </>
      )}

      {/* Submenus */}
      {subMenu === "turnInto" && (
        <div className="block-context-submenu">
          {TURN_INTO_COMMANDS.map((cmd, i) => {
            const Icon = TURN_INTO_ICONS[cmd.title] || Type;
            const isActive = cmd.check?.(editor);
            const i18nKey = TURN_INTO_I18N[cmd.title];
            return (
              <div
                key={cmd.title}
                className={`block-context-menu-item${isActive ? " is-active" : ""}`}
                onClick={() => handleTurnInto(i)}
              >
                <Icon size={14} />
                <span>
                  {i18nKey
                    ? t(`blockMenu.turnIntoItems.${i18nKey}`)
                    : cmd.title}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {subMenu === "color" && (
        <div className="block-context-submenu">
          {TEXT_COLORS.map((c) => (
            <div
              key={c.label}
              className="block-context-menu-item"
              onClick={() => handleTextColor(c.value)}
            >
              <span
                className="block-context-color-swatch"
                style={{
                  backgroundColor: c.value || "var(--color-text-primary)",
                }}
              />
              <span>{t(`blockMenu.textColors.${c.label.toLowerCase()}`)}</span>
            </div>
          ))}
        </div>
      )}

      {subMenu === "calloutColor" && (
        <div className="block-context-submenu">
          {Object.entries(CALLOUT_COLORS).map(([key, cfg]) => (
            <div
              key={key}
              className="block-context-menu-item"
              onClick={() => handleCalloutColor(key)}
            >
              <span
                className="block-context-color-swatch"
                style={{
                  backgroundColor: cfg.border,
                  border:
                    key === "default"
                      ? "1px solid var(--color-border)"
                      : "none",
                }}
              />
              <span>{t(`blockMenu.calloutColors.${key}`)}</span>
              {blockNode.attrs.color === key && (
                <span style={{ marginLeft: "auto", opacity: 0.6 }}>✓</span>
              )}
            </div>
          ))}
        </div>
      )}

      {subMenu === "background" && (
        <div className="block-context-submenu">
          {BLOCK_BG_COLORS.map((c) => (
            <div
              key={c.label}
              className="block-context-menu-item"
              onClick={() => handleBackground(c.value)}
            >
              <span
                className="block-context-color-swatch"
                style={{
                  backgroundColor: c.value || "var(--color-bg-primary)",
                  border: c.value ? "none" : "1px solid var(--color-border)",
                }}
              />
              <span>{t(`blockMenu.bgColors.${c.label.toLowerCase()}`)}</span>
            </div>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
