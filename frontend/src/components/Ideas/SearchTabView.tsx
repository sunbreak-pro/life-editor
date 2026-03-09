import { useState, useMemo } from "react";
import { Search, CheckSquare, BookOpen, StickyNote } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWikiTags } from "../../hooks/useWikiTags";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";
import { useMemoContext } from "../../hooks/useMemoContext";
import { useNoteContext } from "../../hooks/useNoteContext";
import { WikiTagChip } from "../WikiTags/WikiTagChip";
import type { WikiTag, WikiTagEntityType } from "../../types/wikiTag";

interface SearchTabViewProps {
  onNavigateToTask?: (taskId: string) => void;
  onNavigateToMemo?: (date: string) => void;
  onNavigateToNote?: (noteId: string) => void;
}

interface SearchResult {
  entityId: string;
  entityType: WikiTagEntityType;
  title: string;
  subtitle?: string;
}

export function SearchTabView({
  onNavigateToTask,
  onNavigateToMemo,
  onNavigateToNote,
}: SearchTabViewProps) {
  const { t } = useTranslation();
  const { tags, assignments } = useWikiTags();
  const { nodes } = useTaskTreeContext();
  const { memos } = useMemoContext();
  const { notes } = useNoteContext();

  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<WikiTag | null>(null);

  const filteredTags = useMemo(() => {
    if (!query.trim()) return tags;
    const lower = query.toLowerCase();
    return tags.filter((tag) => tag.name.toLowerCase().includes(lower));
  }, [tags, query]);

  const results = useMemo<SearchResult[]>(() => {
    if (!selectedTag) return [];
    const tagAssignments = assignments.filter(
      (a) => a.tagId === selectedTag.id,
    );

    return tagAssignments.map((a) => {
      if (a.entityType === "task") {
        const task = nodes.find((n) => n.id === a.entityId);
        return {
          entityId: a.entityId,
          entityType: a.entityType,
          title: task?.title ?? a.entityId,
        };
      }
      if (a.entityType === "memo") {
        const memo = memos.find((m) => m.date === a.entityId);
        return {
          entityId: a.entityId,
          entityType: a.entityType,
          title: a.entityId,
          subtitle: memo?.content
            ? memo.content.replace(/<[^>]*>/g, "").slice(0, 60)
            : undefined,
        };
      }
      // note
      const note = notes.find((n) => n.id === a.entityId);
      return {
        entityId: a.entityId,
        entityType: a.entityType,
        title: note?.title ?? "Untitled",
      };
    });
  }, [selectedTag, assignments, nodes, memos, notes]);

  const handleSelectTag = (tag: WikiTag) => {
    setSelectedTag(tag);
    setQuery(tag.name);
  };

  const handleResultClick = (result: SearchResult) => {
    switch (result.entityType) {
      case "task":
        onNavigateToTask?.(result.entityId);
        break;
      case "memo":
        onNavigateToMemo?.(result.entityId);
        break;
      case "note":
        onNavigateToNote?.(result.entityId);
        break;
    }
  };

  const entityIcon = (type: WikiTagEntityType) => {
    switch (type) {
      case "task":
        return <CheckSquare size={14} className="text-notion-text-secondary" />;
      case "memo":
        return <BookOpen size={14} className="text-notion-text-secondary" />;
      case "note":
        return <StickyNote size={14} className="text-notion-text-secondary" />;
    }
  };

  return (
    <div className="h-full flex flex-col p-4">
      {/* Search input */}
      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-notion-text-secondary"
        />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (selectedTag && e.target.value !== selectedTag.name) {
              setSelectedTag(null);
            }
          }}
          placeholder={t("ideas.searchPlaceholder")}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-notion-hover text-notion-text outline-none border border-transparent focus:border-notion-accent/50"
        />
      </div>

      {/* Tag candidates */}
      {!selectedTag && query.trim() && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {filteredTags.map((tag) => (
            <WikiTagChip
              key={tag.id}
              tag={tag}
              size="md"
              onClick={() => handleSelectTag(tag)}
            />
          ))}
          {filteredTags.length === 0 && (
            <p className="text-xs text-notion-text-secondary">
              {t("ideas.noSearchResults")}
            </p>
          )}
        </div>
      )}

      {/* Show all tags when no query */}
      {!selectedTag && !query.trim() && (
        <div className="mb-4">
          <p className="text-xs text-notion-text-secondary mb-2">
            {t("ideas.selectTagToSearch")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <WikiTagChip
                key={tag.id}
                tag={tag}
                size="md"
                onClick={() => handleSelectTag(tag)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {selectedTag && (
        <div className="flex-1 overflow-y-auto space-y-1">
          {results.length === 0 ? (
            <p className="text-xs text-notion-text-secondary text-center py-4">
              {t("ideas.noSearchResults")}
            </p>
          ) : (
            results.map((result) => (
              <button
                key={`${result.entityType}-${result.entityId}`}
                onClick={() => handleResultClick(result)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-notion-hover text-left transition-colors"
              >
                {entityIcon(result.entityType)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-notion-text truncate">
                    {result.title}
                  </p>
                  {result.subtitle && (
                    <p className="text-xs text-notion-text-secondary truncate">
                      {result.subtitle}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-notion-text-secondary capitalize">
                  {result.entityType}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
