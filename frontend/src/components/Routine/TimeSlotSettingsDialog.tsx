import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TimeSlotConfig } from "./routineTimeSlotConfig";

interface TimeSlotSettingsDialogProps {
  config: TimeSlotConfig;
  onSave: (config: TimeSlotConfig) => void;
  onClose: () => void;
}

const SLOT_META = [
  { key: "morning" as const, emoji: "\u{1F305}" },
  { key: "afternoon" as const, emoji: "\u2600\uFE0F" },
  { key: "evening" as const, emoji: "\u{1F319}" },
];

export function TimeSlotSettingsDialog({
  config,
  onSave,
  onClose,
}: TimeSlotSettingsDialogProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<TimeSlotConfig>({ ...config });

  const handleChange = (
    slot: keyof TimeSlotConfig,
    field: "start" | "end",
    value: string,
  ) => {
    setDraft((prev) => ({
      ...prev,
      [slot]: { ...prev[slot], [field]: value },
    }));
  };

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-notion-bg border border-notion-border rounded-xl shadow-2xl p-5 w-80"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-notion-text mb-4">
          {t("routine.timeSlotSettings")}
        </h3>

        <div className="space-y-4">
          {SLOT_META.map(({ key, emoji }) => (
            <div key={key}>
              <label className="text-xs font-medium text-notion-text-secondary mb-1.5 flex items-center gap-1.5">
                <span>{emoji}</span>
                <span>{t(`routine.timeSlot.${key}`)}</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={draft[key].start}
                  onChange={(e) => handleChange(key, "start", e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-sm bg-transparent border border-notion-border rounded-lg outline-none focus:border-notion-accent text-notion-text"
                />
                <span className="text-xs text-notion-text-secondary">~</span>
                <input
                  type="time"
                  value={draft[key].end}
                  onChange={(e) => handleChange(key, "end", e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-sm bg-transparent border border-notion-border rounded-lg outline-none focus:border-notion-accent text-notion-text"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-notion-text-secondary hover:bg-notion-hover rounded-lg transition-colors"
          >
            {t("routine.cancel")}
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-xs bg-notion-accent text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
