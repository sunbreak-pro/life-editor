import { useTranslation } from "react-i18next";
import type { RoutineTag } from "../../../../types/routineTag";
import { getTextColorForBg } from "../../../../constants/folderColors";

interface RoutineGroupTagPickerProps {
  tags: RoutineTag[];
  selectedTagIds: number[];
  onChange: (tagIds: number[]) => void;
}

export function RoutineGroupTagPicker({
  tags,
  selectedTagIds,
  onChange,
}: RoutineGroupTagPickerProps) {
  const { t } = useTranslation();
  const selectedSet = new Set(selectedTagIds);

  const toggle = (tagId: number) => {
    if (selectedSet.has(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  return (
    <div>
      <label className="text-[11px] text-notion-text-secondary font-medium block mb-1">
        {t("routineGroup.assignedTags", "Assigned Tags")}
      </label>
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => {
          const selected = selectedSet.has(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggle(tag.id)}
              className={`inline-flex items-center px-2 py-0.5 text-[11px] rounded-full border transition-all ${
                selected
                  ? "border-transparent"
                  : "border-notion-border opacity-50 hover:opacity-80"
              }`}
              style={
                selected
                  ? {
                      backgroundColor: tag.color,
                      color: getTextColorForBg(tag.color),
                    }
                  : undefined
              }
            >
              {!selected && (
                <span
                  className="w-2 h-2 rounded-full mr-1 shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
              )}
              {tag.name}
            </button>
          );
        })}
        {tags.length === 0 && (
          <span className="text-[11px] text-notion-text-secondary">
            {t("routineGroup.noTags", "No tags available")}
          </span>
        )}
      </div>
    </div>
  );
}
