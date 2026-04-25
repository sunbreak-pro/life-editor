import { Check, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useWikiTagsOptional } from "../../../hooks/useWikiTagsOptional";
import type { WikiTagEntityType } from "../../../types/wikiTag";

interface MobileTagPickerProps {
  entityId: string;
  entityType: WikiTagEntityType;
  onClose: () => void;
}

export function MobileTagPicker({
  entityId,
  entityType,
  onClose,
}: MobileTagPickerProps) {
  const { t } = useTranslation();
  const ctx = useWikiTagsOptional();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const currentTagIds = useMemo(() => {
    if (!ctx) return new Set<string>();
    return new Set(ctx.getTagsForEntity(entityId).map((t) => t.id));
  }, [ctx, entityId]);

  const filteredTags = useMemo(() => {
    if (!ctx) return [];
    const q = query.trim().toLowerCase();
    if (!q) return ctx.tags;
    return ctx.tags.filter((t) => t.name.toLowerCase().includes(q));
  }, [ctx, query]);

  const exactMatch = useMemo(() => {
    if (!ctx) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return ctx.tags.some((t) => t.name.toLowerCase() === q);
  }, [ctx, query]);

  if (!ctx) return null;

  const toggleTag = async (tagId: string) => {
    const currentIds = Array.from(currentTagIds);
    const nextIds = currentTagIds.has(tagId)
      ? currentIds.filter((id) => id !== tagId)
      : [...currentIds, tagId];
    await ctx.setTagsForEntity(entityId, entityType, nextIds);
  };

  const createAndAssign = async () => {
    const name = query.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const created = await ctx.createTag(name);
      const currentIds = Array.from(currentTagIds);
      await ctx.setTagsForEntity(entityId, entityType, [
        ...currentIds,
        created.id,
      ]);
      setQuery("");
    } finally {
      setCreating(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-notion-bg pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-between border-b border-notion-border px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="text-notion-text-secondary active:opacity-60"
          aria-label={t("common.close", "Close")}
        >
          <X size={20} />
        </button>
        <h2 className="text-sm font-semibold text-notion-text">
          {t("mobile.tags.title", "Tags")}
        </h2>
        <span className="w-5" />
      </div>

      <div className="border-b border-notion-border px-4 py-2">
        <div className="flex items-center gap-2 rounded-lg bg-notion-hover px-3 py-2">
          <Search size={14} className="text-notion-text-secondary" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("mobile.tags.search", "Search or create tag")}
            className="flex-1 bg-transparent text-sm text-notion-text placeholder:text-notion-text-secondary focus:outline-none"
            autoFocus
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!exactMatch && query.trim() && (
          <button
            type="button"
            onClick={createAndAssign}
            disabled={creating}
            className="flex w-full items-center gap-2 border-b border-notion-border px-4 py-3 text-left text-sm text-notion-accent active:bg-notion-hover disabled:opacity-50"
          >
            <Plus size={16} />
            {t("mobile.tags.create", 'Create "{{name}}"', {
              name: query.trim(),
            })}
          </button>
        )}

        {filteredTags.length === 0 && !query.trim() && (
          <div className="p-8 text-center text-sm text-notion-text-secondary">
            {t("mobile.tags.empty", "No tags yet")}
          </div>
        )}

        <ul>
          {filteredTags.map((tag) => {
            const active = currentTagIds.has(tag.id);
            return (
              <li key={tag.id}>
                <button
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className="flex w-full items-center gap-3 border-b border-notion-border px-4 py-3 text-left active:bg-notion-hover"
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1 text-sm text-notion-text">
                    {tag.name}
                  </span>
                  {active && <Check size={16} className="text-notion-accent" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
