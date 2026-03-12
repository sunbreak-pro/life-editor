import { useState } from "react";
import { Search, X, Check } from "lucide-react";
import type { WikiTag } from "../../types/wikiTag";

interface TagFilterOverlayProps {
  tags: WikiTag[];
  selectedTagIds: string[];
  onToggle: (tagId: string) => void;
  onClose: () => void;
}

export function TagFilterOverlay({
  tags,
  selectedTagIds,
  onToggle,
  onClose,
}: TagFilterOverlayProps) {
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? tags.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    : tags;

  return (
    <div className="rounded-lg border border-notion-border bg-notion-bg shadow-lg p-2 w-60">
      <div className="flex items-center justify-between mb-2">
        <div className="relative flex-1">
          <Search
            size={12}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-notion-text-secondary"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tags..."
            className="w-full pl-7 pr-2 py-1 text-xs rounded bg-notion-hover text-notion-text outline-none border border-transparent focus:border-notion-accent/50"
            autoFocus
          />
        </div>
        <button
          onClick={onClose}
          className="p-0.5 ml-1 text-notion-text-secondary hover:text-notion-text"
        >
          <X size={14} />
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto space-y-0.5">
        {filtered.map((tag) => {
          const isSelected = selectedTagIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              onClick={() => onToggle(tag.id)}
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
                <Check size={12} className="text-notion-accent shrink-0" />
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-[10px] text-notion-text-secondary text-center py-2">
            No tags found
          </p>
        )}
      </div>
    </div>
  );
}
