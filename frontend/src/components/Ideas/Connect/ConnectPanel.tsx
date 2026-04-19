import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X, Plus, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { WikiTag, WikiTagAssignment } from "../../../types/wikiTag";
import { FOLDER_COLORS } from "../../../constants/folderColors";

type EntityType = "note" | "memo";

interface ConnectPanelProps {
  sourceEntityType: EntityType;
  sourceEntityId: string;
  sourceTitle: string;
  targetEntityType: EntityType;
  targetEntityId: string;
  targetTitle: string;
  tags: WikiTag[];
  assignments: WikiTagAssignment[];
  onCancel: () => void;
  onConnect: (payload: {
    tagId: string | null;
    newTagName: string | null;
    sourceTagIds: string[];
    targetTagIds: string[];
    newTagColor: string;
  }) => Promise<void> | void;
}

export function ConnectPanel({
  sourceEntityType,
  sourceEntityId,
  sourceTitle,
  targetEntityType,
  targetEntityId,
  targetTitle,
  tags,
  assignments,
  onCancel,
  onConnect,
}: ConnectPanelProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sourceTagIds = useMemo(
    () =>
      assignments
        .filter(
          (a) =>
            a.entityId === sourceEntityId && a.entityType === sourceEntityType,
        )
        .map((a) => a.tagId),
    [assignments, sourceEntityId, sourceEntityType],
  );

  const targetTagIds = useMemo(
    () =>
      assignments
        .filter(
          (a) =>
            a.entityId === targetEntityId && a.entityType === targetEntityType,
        )
        .map((a) => a.tagId),
    [assignments, targetEntityId, targetEntityType],
  );

  const sortedTags = useMemo(
    () => [...tags].sort((a, b) => a.name.localeCompare(b.name)),
    [tags],
  );

  const trimmedQuery = query.trim();
  const filteredTags = useMemo(() => {
    if (!trimmedQuery) return sortedTags;
    const lower = trimmedQuery.toLowerCase();
    return sortedTags.filter((tag) => tag.name.toLowerCase().includes(lower));
  }, [sortedTags, trimmedQuery]);

  const exactMatch = useMemo(
    () =>
      trimmedQuery
        ? sortedTags.find(
            (tag) => tag.name.toLowerCase() === trimmedQuery.toLowerCase(),
          )
        : undefined,
    [sortedTags, trimmedQuery],
  );

  const showCreateOption = !!trimmedQuery && !exactMatch;

  const canConnect =
    !isSubmitting && (selectedTagId !== null || showCreateOption);

  const handleConnect = async () => {
    if (!canConnect) return;
    setIsSubmitting(true);
    try {
      if (selectedTagId) {
        await onConnect({
          tagId: selectedTagId,
          newTagName: null,
          sourceTagIds,
          targetTagIds,
          newTagColor: "",
        });
      } else if (showCreateOption) {
        const color =
          FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)];
        await onConnect({
          tagId: null,
          newTagName: trimmedQuery,
          sourceTagIds,
          targetTagIds,
          newTagColor: color,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      void handleConnect();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const overlay = (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/30"
      onClick={onCancel}
    >
      <div
        className="w-[440px] max-h-[80vh] bg-notion-bg border border-notion-border rounded-lg shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-3 border-b border-notion-border">
          <div className="min-w-0">
            <p className="text-xs text-notion-text-secondary mb-1">
              {t("connect.panel.title")}
            </p>
            <div className="flex items-center gap-1.5 text-sm text-notion-text truncate">
              <span className="truncate max-w-[140px]" title={sourceTitle}>
                {sourceTitle}
              </span>
              <span className="text-notion-text-secondary">—</span>
              <span className="truncate max-w-[140px]" title={targetTitle}>
                {targetTitle}
              </span>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="shrink-0 p-1 rounded text-notion-text-secondary hover:bg-notion-hover"
            aria-label={t("connect.panel.cancel")}
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-3 border-b border-notion-border">
          <div className="relative">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-notion-text-secondary"
            />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedTagId(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder={t("connect.panel.searchPlaceholder")}
              autoFocus
              className="w-full pl-8 pr-2 py-1.5 text-xs rounded bg-notion-hover text-notion-text outline-none border border-transparent focus:border-notion-accent/50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 min-h-[160px] max-h-[360px]">
          {filteredTags.length === 0 && !showCreateOption && (
            <p className="text-[11px] text-notion-text-secondary text-center py-4">
              {t("connect.panel.noTags")}
            </p>
          )}
          {filteredTags.map((tag) => {
            const isSelected = selectedTagId === tag.id;
            const onBoth =
              sourceTagIds.includes(tag.id) && targetTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                disabled={onBoth}
                onClick={() => setSelectedTagId(tag.id)}
                className={
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors " +
                  (onBoth
                    ? "opacity-50 cursor-not-allowed"
                    : isSelected
                      ? "bg-notion-accent/15"
                      : "hover:bg-notion-hover")
                }
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="flex-1 text-xs text-notion-text truncate">
                  {tag.name}
                </span>
                {onBoth && (
                  <span className="text-[10px] text-notion-text-secondary shrink-0">
                    {t("connect.panel.alreadyLinked")}
                  </span>
                )}
                {isSelected && !onBoth && (
                  <Check size={12} className="text-notion-accent shrink-0" />
                )}
              </button>
            );
          })}
          {showCreateOption && (
            <button
              onClick={() => setSelectedTagId(null)}
              className={
                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left border border-dashed transition-colors " +
                (selectedTagId === null
                  ? "border-notion-accent bg-notion-accent/10 text-notion-text"
                  : "border-notion-border text-notion-text-secondary hover:bg-notion-hover")
              }
            >
              <Plus size={12} className="shrink-0" />
              <span className="flex-1 text-xs truncate">
                {t("connect.panel.createNew", { name: trimmedQuery })}
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-3 border-t border-notion-border">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded text-notion-text-secondary hover:bg-notion-hover"
          >
            {t("connect.panel.cancel")}
          </button>
          <button
            onClick={handleConnect}
            disabled={!canConnect}
            className={
              "px-3 py-1.5 text-xs rounded font-medium transition-colors " +
              (canConnect
                ? "bg-notion-accent text-white hover:brightness-110"
                : "bg-notion-hover text-notion-text-secondary cursor-not-allowed")
            }
          >
            {t("connect.panel.connect")}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
