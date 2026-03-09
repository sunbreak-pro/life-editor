import { useState, useRef, useEffect } from "react";
import { Plus, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWikiTags } from "../../hooks/useWikiTags";
import { WikiTagChip } from "./WikiTagChip";
import { ColorPicker } from "../shared/ColorPicker";
import type { WikiTagEntityType, WikiTag } from "../../types/wikiTag";
import { FOLDER_COLORS } from "../../constants/folderColors";

interface WikiTagListProps {
  entityId: string;
  entityType: WikiTagEntityType;
}

export function WikiTagList({ entityId, entityType }: WikiTagListProps) {
  const { t } = useTranslation();
  const {
    tags: allTags,
    getTagsForEntity,
    setTagsForEntity,
    createTag,
    updateTag,
  } = useWikiTags();
  const entityTags = getTagsForEntity(entityId);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  const [editingTag, setEditingTag] = useState<WikiTag | null>(null);
  const [editName, setEditName] = useState("");
  const editRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPicker]);

  useEffect(() => {
    if (!editingTag) return;
    const handleClick = (e: MouseEvent) => {
      if (editRef.current && !editRef.current.contains(e.target as Node)) {
        setEditingTag(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [editingTag]);

  const handleRemove = (tagId: string) => {
    const newIds = entityTags.filter((t) => t.id !== tagId).map((t) => t.id);
    setTagsForEntity(entityId, entityType, newIds);
  };

  const handleAdd = (tagId: string) => {
    const newIds = [...entityTags.map((t) => t.id), tagId];
    setTagsForEntity(entityId, entityType, newIds);
    setShowPicker(false);
    setSearch("");
  };

  const handleCreate = async (name: string) => {
    const defaultColor =
      FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)];
    const tag = await createTag(name, defaultColor);
    const newIds = [...entityTags.map((t) => t.id), tag.id];
    setTagsForEntity(entityId, entityType, newIds);
    setShowPicker(false);
    setSearch("");
  };

  const handleTagClick = (tag: WikiTag) => {
    setEditingTag(tag);
    setEditName(tag.name);
  };

  const handleEditSave = async () => {
    if (!editingTag) return;
    const trimmed = editName.trim();
    if (trimmed && trimmed !== editingTag.name) {
      await updateTag(editingTag.id, { name: trimmed });
    }
    setEditingTag(null);
  };

  const handleEditColorChange = async (color: string) => {
    if (!editingTag) return;
    await updateTag(editingTag.id, { color });
    setEditingTag((prev) => (prev ? { ...prev, color } : null));
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

  return (
    <div className="flex items-center gap-1 flex-wrap relative">
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="p-1 text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover rounded-md transition-colors shrink-0"
        title={t("wikiTags.addTag")}
      >
        <Tag size={14} />
      </button>
      {entityTags.length === 0 && !showPicker && (
        <button
          onClick={() => setShowPicker(true)}
          className="text-[11px] text-notion-text-secondary hover:text-notion-text transition-colors"
        >
          {t("wikiTags.addTag")}
        </button>
      )}
      {entityTags.map((tag) => (
        <div key={tag.id} className="relative">
          <WikiTagChip
            tag={tag}
            onRemove={() => handleRemove(tag.id)}
            onClick={() => handleTagClick(tag)}
          />
          {editingTag?.id === tag.id && (
            <div
              ref={editRef}
              className="absolute top-full left-0 mt-1 z-50 bg-notion-bg border border-notion-border rounded-lg shadow-lg w-52 overflow-hidden"
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
                    if (e.key === "Escape") setEditingTag(null);
                  }}
                  onBlur={(e) => {
                    if (editRef.current?.contains(e.relatedTarget as Node))
                      return;
                    handleEditSave();
                  }}
                  className="w-full text-xs px-2 py-1 rounded bg-notion-hover text-notion-text outline-none"
                  autoFocus
                />
                <ColorPicker
                  currentColor={editingTag.color}
                  onSelect={handleEditColorChange}
                  onClose={() => setEditingTag(null)}
                  inline
                />
              </div>
            </div>
          )}
        </div>
      ))}
      {entityTags.length > 0 && (
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="p-1 text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover rounded-md transition-colors"
        >
          <Plus size={16} />
        </button>
      )}

      {showPicker && (
        <div
          ref={pickerRef}
          className="absolute top-full left-0 mt-1 z-50 bg-notion-bg border border-notion-border rounded-lg shadow-lg w-56 overflow-hidden"
        >
          <div className="p-1.5">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={t("wikiTags.searchPlaceholder")}
              className="w-full text-xs px-2 py-1 rounded bg-notion-hover text-notion-text outline-none"
              autoFocus
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
        </div>
      )}
    </div>
  );
}
