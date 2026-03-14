import { useState, useRef, useEffect, useCallback } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useWikiTags } from "../hooks/useWikiTags";
import { UnifiedColorPicker } from "../components/shared/UnifiedColorPicker";
import { useTranslation } from "react-i18next";
import { getTextColorForBg } from "../constants/folderColors";

export function WikiTagView({ node }: NodeViewProps) {
  const { t } = useTranslation();
  const tagName = node.attrs.tagName || "";
  const tagId = node.attrs.tagId;
  const { tags, updateTag } = useWikiTags();
  const tag = tags.find((t) => t.id === tagId);
  const color = tag?.color;

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(tagName);
  const editRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) return;
    const handleClick = (e: MouseEvent) => {
      if (editRef.current && !editRef.current.contains(e.target as Node)) {
        setEditing(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [editing]);

  const handleClick = () => {
    if (tag) {
      setEditName(tag.name);
      setEditing(true);
    }
  };

  const handleEditSave = async () => {
    if (!tag) return;
    const trimmed = editName.trim();
    if (trimmed && trimmed !== tag.name) {
      await updateTag(tag.id, { name: trimmed });
    }
    setEditing(false);
  };

  const handleColorChange = useCallback(
    async (newColor: string) => {
      if (!tagId) return;
      await updateTag(tagId, { color: newColor });
    },
    [tagId, updateTag],
  );

  const handleTextColorChange = useCallback(
    async (newTextColor: string | undefined) => {
      if (!tagId) return;
      await updateTag(tagId, { textColor: newTextColor ?? null });
    },
    [tagId, updateTag],
  );

  const textColor = color
    ? (tag?.textColor ?? getTextColorForBg(color))
    : undefined;
  const style = color
    ? {
        backgroundColor: `${color}E6`,
        color: textColor,
        border: `1px solid ${color}CC`,
      }
    : undefined;

  return (
    <NodeViewWrapper
      as="span"
      className="wiki-tag-modern"
      contentEditable={false}
      data-wiki-tag=""
      data-tag-id={tagId}
      data-tag-name={tagName}
      style={{ ...style, ...(editing ? { zIndex: 100 } : {}) }}
      onClick={handleClick}
    >
      <span
        className="wiki-tag-symbol"
        style={color ? { color: textColor, opacity: 0.8 } : undefined}
      >
        #
      </span>
      <span className="wiki-tag-text">{tag?.name || tagName}</span>
      {editing && (
        <span
          ref={editRef}
          className="wiki-tag-edit-popup"
          contentEditable={false}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="p-2 space-y-2">
            <p className="text-[10px] text-notion-text-secondary font-medium">
              {t("wikiTags.editTag")}
            </p>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") handleEditSave();
                if (e.key === "Escape") setEditing(false);
              }}
              onBlur={(e) => {
                if (editRef.current?.contains(e.relatedTarget as Node)) return;
                handleEditSave();
              }}
              className="w-full text-xs px-2 py-1 rounded bg-notion-hover text-notion-text outline-none"
              autoFocus
            />
            <UnifiedColorPicker
              color={tag?.color || "#2eaadc"}
              onChange={handleColorChange}
              mode="preset-full"
              showTextColor
              textColor={tag?.textColor}
              effectiveTextColor={color ? getTextColorForBg(color) : undefined}
              onTextColorChange={handleTextColorChange}
              inline
            />
          </div>
        </span>
      )}
    </NodeViewWrapper>
  );
}
