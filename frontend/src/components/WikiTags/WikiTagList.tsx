import { useState, useRef, useEffect } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWikiTags } from "../../hooks/useWikiTags";
import { WikiTagChip } from "./WikiTagChip";
import type { WikiTagEntityType } from "../../types/wikiTag";

interface WikiTagListProps {
  entityId: string;
  entityType: WikiTagEntityType;
}

export function WikiTagList({ entityId, entityType }: WikiTagListProps) {
  const { t } = useTranslation();
  const { tags: allTags, getTagsForEntity, setTagsForEntity } = useWikiTags();
  const entityTags = getTagsForEntity(entityId);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

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

  const availableTags = allTags.filter(
    (t) =>
      !entityTags.some((et) => et.id === t.id) &&
      t.name.toLowerCase().includes(search.toLowerCase()),
  );

  if (entityTags.length === 0 && !showPicker) {
    return (
      <button
        onClick={() => setShowPicker(true)}
        className="text-[11px] text-notion-text-secondary hover:text-notion-text flex items-center gap-0.5 transition-colors"
      >
        <Plus size={11} />
        {t("wikiTags.addTag")}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-wrap relative">
      {entityTags.map((tag) => (
        <WikiTagChip
          key={tag.id}
          tag={tag}
          onRemove={() => handleRemove(tag.id)}
        />
      ))}
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="p-0.5 text-notion-text-secondary hover:text-notion-text transition-colors"
      >
        <Plus size={12} />
      </button>

      {showPicker && (
        <div
          ref={pickerRef}
          className="absolute top-full left-0 mt-1 z-50 bg-notion-bg border border-notion-border rounded-lg shadow-lg w-56 overflow-hidden"
        >
          <div className="p-1.5">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
            {availableTags.length === 0 && (
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
