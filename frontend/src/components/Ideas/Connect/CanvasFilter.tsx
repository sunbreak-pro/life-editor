import { useState } from "react";
import { Filter, X, Check } from "lucide-react";
import type { WikiTag, WikiTagGroup } from "../../../types/wikiTag";
import { useTranslation } from "react-i18next";

interface CanvasFilterProps {
  tags: WikiTag[];
  groups: WikiTagGroup[];
  selectedGroupIds: string[];
  selectedTagIds: string[];
  onToggleGroup: (groupId: string) => void;
  onToggleTag: (tagId: string) => void;
  onClose: () => void;
  onClearAll?: () => void;
}

export function CanvasFilter({
  tags,
  groups,
  selectedGroupIds,
  selectedTagIds,
  onToggleGroup,
  onToggleTag,
  onClose,
  onClearAll,
}: CanvasFilterProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const lowerSearch = search.toLowerCase();

  const filteredGroups = search.trim()
    ? groups.filter((g) => g.name.toLowerCase().includes(lowerSearch))
    : groups;
  const filteredTags = search.trim()
    ? tags.filter((t) => t.name.toLowerCase().includes(lowerSearch))
    : tags;

  return (
    <div className="rounded-lg border border-notion-border bg-notion-bg shadow-lg p-2 w-56">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-notion-text-secondary">
          <Filter size={12} className="inline mr-1" />
          {t("ideas.canvasFilter")}
        </span>
        <div className="flex items-center gap-1">
          {onClearAll &&
            (selectedGroupIds.length > 0 || selectedTagIds.length > 0) && (
              <button
                onClick={onClearAll}
                className="text-[10px] text-notion-accent hover:text-notion-accent/80"
              >
                {t("ideas.clearFilter")}
              </button>
            )}
          <button
            onClick={onClose}
            className="p-0.5 text-notion-text-secondary hover:text-notion-text"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("wikiTags.searchPlaceholder")}
        className="w-full text-xs px-2 py-1 rounded bg-notion-hover text-notion-text outline-none border border-transparent focus:border-notion-accent/50 mb-2"
      />

      <div className="max-h-60 overflow-y-auto">
        {/* Groups */}
        {filteredGroups.length > 0 && (
          <div className="mb-2">
            <h5 className="text-[10px] font-semibold text-notion-text-secondary uppercase tracking-wider mb-1 px-1">
              {t("ideas.groups")}
            </h5>
            <div className="space-y-0.5">
              {filteredGroups.map((group) => {
                const isSelected = selectedGroupIds.includes(group.id);
                return (
                  <button
                    key={group.id}
                    onClick={() => onToggleGroup(group.id)}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-notion-hover transition-colors text-left"
                  >
                    <span className="flex-1 text-xs text-notion-text truncate">
                      {group.name}
                    </span>
                    {isSelected && (
                      <Check
                        size={12}
                        className="text-notion-accent shrink-0"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tags */}
        {filteredTags.length > 0 && (
          <div>
            <h5 className="text-[10px] font-semibold text-notion-text-secondary uppercase tracking-wider mb-1 px-1">
              {t("wikiTags.title")}
            </h5>
            <div className="space-y-0.5">
              {filteredTags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => onToggleTag(tag.id)}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-notion-hover transition-colors text-left"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 text-xs text-notion-text truncate">
                      {tag.name}
                    </span>
                    {isSelected && (
                      <Check
                        size={12}
                        className="text-notion-accent shrink-0"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
