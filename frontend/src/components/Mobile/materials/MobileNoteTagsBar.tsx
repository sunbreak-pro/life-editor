import { Plus, Tag as TagIcon, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useWikiTagsOptional } from "../../../hooks/useWikiTagsOptional";
import { MobileTagPicker } from "./MobileTagPicker";

interface MobileNoteTagsBarProps {
  entityId: string;
  readOnly?: boolean;
}

export function MobileNoteTagsBar({
  entityId,
  readOnly = false,
}: MobileNoteTagsBarProps) {
  const { t } = useTranslation();
  const ctx = useWikiTagsOptional();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!ctx) return null;

  const entityTags = ctx.getTagsForEntity(entityId);

  const handleRemove = (tagId: string) => {
    const nextIds = entityTags.filter((t) => t.id !== tagId).map((t) => t.id);
    void ctx.setTagsForEntity(entityId, "note", nextIds);
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <TagIcon size={14} className="text-notion-text-secondary" />
        {entityTags.length === 0 && !readOnly && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="rounded-full border border-dashed border-notion-border px-2.5 py-0.5 text-xs text-notion-text-secondary active:bg-notion-hover"
          >
            + {t("mobile.tags.add", "Add tags")}
          </button>
        )}
        {entityTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
            style={{
              backgroundColor: tag.color + "22",
              color: tag.textColor || tag.color,
            }}
          >
            {tag.name}
            {!readOnly && (
              <button
                type="button"
                onClick={() => handleRemove(tag.id)}
                className="opacity-60 active:opacity-100"
                aria-label="Remove tag"
              >
                <X size={10} />
              </button>
            )}
          </span>
        ))}
        {entityTags.length > 0 && !readOnly && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex h-5 w-5 items-center justify-center rounded-full text-notion-text-secondary active:bg-notion-hover"
            aria-label={t("mobile.tags.edit", "Edit tags")}
          >
            <Plus size={12} />
          </button>
        )}
      </div>

      {pickerOpen && (
        <MobileTagPicker
          entityId={entityId}
          entityType="note"
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}
