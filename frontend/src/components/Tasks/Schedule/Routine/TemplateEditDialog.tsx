import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  RoutineTemplate,
  TemplateFrequencyType,
} from "../../../../types/schedule";
import type { RoutineTag } from "../../../../types/routineTag";
import { useConfirmableSubmit } from "../../../../hooks/useConfirmableSubmit";
import { RoutineTagSelector } from "./RoutineTagSelector";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface TemplateEditDialogProps {
  template?: RoutineTemplate;
  tags: RoutineTag[];
  onSubmit: (
    name: string,
    frequencyType: TemplateFrequencyType,
    frequencyDays: number[],
    tagId?: number | null,
  ) => void;
  onCreateTag?: (name: string, color: string) => Promise<RoutineTag>;
  onClose: () => void;
}

export function TemplateEditDialog({
  template,
  tags,
  onSubmit,
  onCreateTag,
  onClose,
}: TemplateEditDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(template?.name ?? "");
  const [frequencyType, setFrequencyType] = useState<TemplateFrequencyType>(
    template?.frequencyType ?? "daily",
  );
  const [frequencyDays, setFrequencyDays] = useState<number[]>(
    template?.frequencyDays ?? [],
  );
  const [tagId, setTagId] = useState<number | null>(template?.tagId ?? null);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit(name.trim(), frequencyType, frequencyDays, tagId);
    onClose();
  };

  const { inputRef, handleKeyDown, handleBlur, handleFocus, readyToSubmit } =
    useConfirmableSubmit(handleSubmit, onClose);

  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  const toggleDay = (day: number) => {
    setFrequencyDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort(),
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-notion-bg border border-notion-border rounded-lg shadow-xl p-4 w-80">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-notion-text">
            {template
              ? t("schedule.editTemplate", "Edit Template")
              : t("schedule.newTemplate", "New Template")}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-notion-text-secondary uppercase tracking-wide mb-1 block">
              {t("schedule.templateName", "Name")}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              onFocus={handleFocus}
              placeholder={t(
                "schedule.templateNamePlaceholder",
                "Template name",
              )}
              className="w-full px-2 py-1.5 text-sm bg-transparent border border-notion-border rounded-md outline-none focus:border-notion-accent text-notion-text placeholder:text-notion-text-secondary"
            />
          </div>

          <div>
            <label className="text-[10px] text-notion-text-secondary uppercase tracking-wide mb-1 block">
              {t("schedule.frequency", "Frequency")}
            </label>
            <div className="flex gap-1">
              <button
                onClick={() => setFrequencyType("daily")}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  frequencyType === "daily"
                    ? "bg-notion-accent/10 text-notion-accent"
                    : "text-notion-text-secondary hover:bg-notion-hover"
                }`}
              >
                {t("schedule.daily", "Daily")}
              </button>
              <button
                onClick={() => setFrequencyType("custom")}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  frequencyType === "custom"
                    ? "bg-notion-accent/10 text-notion-accent"
                    : "text-notion-text-secondary hover:bg-notion-hover"
                }`}
              >
                {t("schedule.custom", "Custom")}
              </button>
            </div>
          </div>

          {frequencyType === "custom" && (
            <div className="flex gap-1">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={`w-8 h-8 text-[10px] rounded-full transition-colors ${
                    frequencyDays.includes(i)
                      ? "bg-notion-accent text-white"
                      : "text-notion-text-secondary hover:bg-notion-hover"
                  }`}
                >
                  {label.charAt(0)}
                </button>
              ))}
            </div>
          )}

          <div>
            <label className="text-[10px] text-notion-text-secondary uppercase tracking-wide mb-1 block">
              {t("schedule.routineTag", "Tag")}
            </label>
            <RoutineTagSelector
              tags={tags}
              selectedTagId={tagId}
              onSelect={setTagId}
              onCreateTag={onCreateTag}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-notion-text-secondary hover:bg-notion-hover rounded-md transition-colors"
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className={`px-3 py-1.5 text-xs bg-notion-accent text-white rounded-md hover:bg-notion-accent/90 transition-colors disabled:opacity-50 ${readyToSubmit ? "ring-2 ring-notion-accent/50 animate-pulse" : ""}`}
          >
            {template
              ? t("common.save", "Save")
              : t("schedule.create", "Create")}
          </button>
        </div>
      </div>
    </div>
  );
}
