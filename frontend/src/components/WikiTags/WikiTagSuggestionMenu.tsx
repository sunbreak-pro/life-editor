import { useCallback } from "react";
import { Plus } from "lucide-react";
import type { Editor } from "@tiptap/react";
import { useTranslation } from "react-i18next";
import { useWikiTags } from "../../hooks/useWikiTags";
import { useWikiTagSuggestion } from "../../hooks/useWikiTagSuggestion";
import type { WikiTag } from "../../types/wikiTag";

interface WikiTagSuggestionMenuProps {
  editor: Editor;
}

export function WikiTagSuggestionMenu({ editor }: WikiTagSuggestionMenuProps) {
  const { t } = useTranslation();
  const { tags, createTag } = useWikiTags();

  const handleInsertTag = useCallback(
    (tag: WikiTag) => {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "wikiTag",
          attrs: { tagId: tag.id, tagName: tag.name },
        })
        .run();
    },
    [editor],
  );

  const handleCreateAndInsertTag = useCallback(
    async (name: string) => {
      const tag = await createTag(name);
      editor
        .chain()
        .focus()
        .insertContent({
          type: "wikiTag",
          attrs: { tagId: tag.id, tagName: tag.name },
        })
        .run();
    },
    [editor, createTag],
  );

  const {
    isOpen,
    position,
    selectedIndex,
    filteredTags,
    query,
    hasExactMatch,
    insertTag,
  } = useWikiTagSuggestion(
    editor,
    tags,
    handleInsertTag,
    handleCreateAndInsertTag,
  );

  if (!isOpen) return null;

  const showCreateOption = query.length > 0 && !hasExactMatch;

  return (
    <div
      className="absolute z-50 bg-notion-bg border border-notion-border rounded-lg shadow-lg overflow-hidden"
      style={{
        top: position.top,
        left: position.left,
        width: 280,
        maxHeight: 260,
      }}
    >
      <div className="p-1.5 border-b border-notion-border">
        <span className="text-[11px] text-notion-text-secondary px-1.5">
          {t("wikiTags.selectOrCreate")}
        </span>
      </div>
      <div className="overflow-y-auto max-h-[200px] p-1">
        {filteredTags.length === 0 && !showCreateOption && (
          <div className="px-2 py-3 text-xs text-notion-text-secondary text-center">
            {t("wikiTags.noResults")}
          </div>
        )}
        {filteredTags.map((tag, index) => (
          <button
            key={tag.id}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ${
              index === selectedIndex
                ? "bg-notion-hover text-notion-text"
                : "text-notion-text hover:bg-notion-hover/50"
            }`}
            onMouseDown={(e) => {
              e.preventDefault();
              insertTag(index);
            }}
            onMouseEnter={() => {
              // selectedIndex is managed by keyboard, don't override on hover
            }}
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
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ${
              selectedIndex === filteredTags.length
                ? "bg-notion-hover text-notion-text"
                : "text-notion-text-secondary hover:bg-notion-hover/50"
            }`}
            onMouseDown={(e) => {
              e.preventDefault();
              insertTag(filteredTags.length);
            }}
          >
            <Plus size={14} className="shrink-0" />
            <span className="truncate">
              {t("wikiTags.createNew")}: <strong>{query}</strong>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
