import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWikiTags } from "../../../hooks/useWikiTags";
import type { WikiTagEntityType } from "../../../types/wikiTag";
import { FOLDER_COLORS } from "../../../constants/folderColors";

interface ItemEditPopoverProps {
  entityId: string;
  entityType: WikiTagEntityType;
  title?: string;
  onTitleChange?: (title: string) => void;
  onClose: () => void;
  anchorEl: HTMLElement;
}

export function ItemEditPopover({
  entityId,
  entityType,
  title,
  onTitleChange,
  onClose,
  anchorEl,
}: ItemEditPopoverProps) {
  const { t } = useTranslation();
  const {
    tags: allTags,
    getTagsForEntity,
    setTagsForEntity,
    createTag,
  } = useWikiTags();
  const entityTags = getTagsForEntity(entityId);
  const [localTitle, setLocalTitle] = useState(title ?? "");
  const [search, setSearch] = useState("");
  const popupRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const rect = anchorEl.getBoundingClientRect();
    const popupWidth = 288; // w-72
    const left = Math.min(rect.left, window.innerWidth - popupWidth - 8);
    setPosition({
      top: rect.bottom + 4,
      left: Math.max(8, left),
    });
  }, [anchorEl]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const handleTitleBlur = () => {
    if (onTitleChange && localTitle !== title) {
      onTitleChange(localTitle);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleRemove = (tagId: string) => {
    const newIds = entityTags.filter((t) => t.id !== tagId).map((t) => t.id);
    setTagsForEntity(entityId, entityType, newIds);
  };

  const handleAdd = (tagId: string) => {
    const newIds = [...entityTags.map((t) => t.id), tagId];
    setTagsForEntity(entityId, entityType, newIds);
  };

  const handleCreate = async (name: string) => {
    const defaultColor =
      FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)];
    const tag = await createTag(name, defaultColor);
    const newIds = [...entityTags.map((t) => t.id), tag.id];
    setTagsForEntity(entityId, entityType, newIds);
    setSearch("");
  };

  const availableTags = allTags.filter(
    (t) =>
      !entityTags.some((et) => et.id === t.id) &&
      t.name.toLowerCase().includes(search.toLowerCase()),
  );

  const hasExactMatch = allTags.some(
    (t) => t.name.toLowerCase() === search.toLowerCase(),
  );
  const showCreateOption = search.length > 0 && !hasExactMatch;
  const showTitle = entityType === "note" && onTitleChange;

  return createPortal(
    <div
      ref={popupRef}
      className="fixed z-[9999] bg-notion-bg border border-notion-border rounded-lg shadow-lg w-72 overflow-hidden"
      style={{ top: position.top, left: position.left }}
    >
      {/* Title editing (notes only) */}
      {showTitle && (
        <div className="p-2 border-b border-notion-border">
          <label className="text-[10px] text-notion-text-secondary mb-1 block">
            {t("ideas.editName")}
          </label>
          <input
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            className="w-full text-xs px-2 py-1.5 rounded bg-notion-hover text-notion-text outline-none border border-transparent focus:border-notion-accent/50"
            autoFocus
          />
        </div>
      )}

      {/* Current tags */}
      {entityTags.length > 0 && (
        <div className="p-2 border-b border-notion-border">
          <label className="text-[10px] text-notion-text-secondary mb-1 block">
            {t("ideas.tagDots")}
          </label>
          <div className="flex flex-wrap gap-1">
            {entityTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
                <button
                  onClick={() => handleRemove(tag.id)}
                  className="hover:opacity-70"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search & add tags */}
      <div className="p-1.5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder={t("wikiTags.searchPlaceholder")}
          className="w-full text-xs px-2 py-1 rounded bg-notion-hover text-notion-text outline-none"
          autoFocus={!showTitle}
        />
      </div>
      <div className="max-h-32 overflow-y-auto p-1">
        {availableTags.map((tag) => (
          <button
            key={tag.id}
            onClick={() => handleAdd(tag.id)}
            className="w-full flex items-center gap-2 px-2 py-1 rounded text-sm text-left hover:bg-notion-hover text-notion-text transition-colors"
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: tag.color }}
            />
            <span className="truncate">{tag.name}</span>
          </button>
        ))}
        {showCreateOption && (
          <button
            onClick={() => handleCreate(search.trim())}
            className="w-full flex items-center gap-2 px-2 py-1 rounded text-sm text-left hover:bg-notion-hover text-notion-accent transition-colors"
          >
            <Plus size={14} className="shrink-0" />
            <span className="truncate">
              {t("wikiTags.createTag", { name: search.trim() })}
            </span>
          </button>
        )}
        {availableTags.length === 0 && !showCreateOption && (
          <p className="text-[11px] text-notion-text-secondary px-2 py-1 text-center">
            {t("wikiTags.noResults")}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
