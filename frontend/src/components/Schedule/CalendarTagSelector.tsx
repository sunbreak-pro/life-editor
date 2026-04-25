import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, X } from "lucide-react";
import type { CalendarTag } from "../../types/calendarTag";

interface CalendarTagSelectorProps {
  tags: CalendarTag[];
  selectedTagId: number | null;
  onSelect: (tagId: number | null) => void;
}

export function CalendarTagSelector({
  tags,
  selectedTagId,
  onSelect,
}: CalendarTagSelectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const selectedTag = tags.find((t) => t.id === selectedTagId) ?? null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs bg-notion-bg-secondary border border-notion-border rounded-md text-notion-text outline-none hover:border-notion-accent/50 transition-colors"
      >
        {selectedTag ? (
          <>
            <span
              className="w-2.5 h-2.5 rounded-full ring-1 ring-notion-border shrink-0"
              style={{ backgroundColor: selectedTag.color }}
            />
            <span className="flex-1 truncate text-left">
              {selectedTag.name}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(null);
              }}
              className="p-0.5 rounded hover:bg-notion-hover text-notion-text-secondary"
              aria-label={t("common.clear", "Clear")}
            >
              <X size={11} />
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 text-left text-notion-text-secondary">
              {t("calendarTags.selectPlaceholder", "Select tag")}
            </span>
            <ChevronDown size={11} />
          </>
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-notion-bg-popover border border-notion-border rounded-md shadow-lg max-h-48 overflow-y-auto py-1">
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-2 py-1 text-xs text-left hover:bg-notion-hover ${
              selectedTagId === null ? "text-notion-accent" : ""
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full border border-dashed border-notion-text-secondary shrink-0" />
            <span className="flex-1 truncate text-notion-text-secondary italic">
              {t("calendarTags.none", "No tag")}
            </span>
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => {
                onSelect(tag.id);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-2 py-1 text-xs text-left hover:bg-notion-hover ${
                selectedTagId === tag.id ? "text-notion-accent" : ""
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full ring-1 ring-notion-border shrink-0"
                style={{ backgroundColor: tag.color }}
              />
              <span className="flex-1 truncate">{tag.name}</span>
            </button>
          ))}
          {tags.length === 0 && (
            <div className="px-2 py-1 text-[11px] text-notion-text-secondary italic">
              {t("calendarTags.empty", "No tags yet")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
