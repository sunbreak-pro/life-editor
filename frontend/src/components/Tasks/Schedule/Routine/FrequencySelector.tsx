import { useTranslation } from "react-i18next";
import type { FrequencyType } from "../../../../types/routine";

interface FrequencySelectorProps {
  frequencyType: FrequencyType;
  frequencyDays: number[];
  frequencyInterval: number;
  frequencyStartDate: string;
  onFrequencyTypeChange: (type: FrequencyType) => void;
  onFrequencyDaysChange: (days: number[]) => void;
  onFrequencyIntervalChange: (interval: number) => void;
  onFrequencyStartDateChange: (date: string) => void;
  /** Hide the "group" option (used by Group edit dialog — a Group cannot itself defer to a Group). */
  hideGroupOption?: boolean;
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function FrequencySelector({
  frequencyType,
  frequencyDays,
  frequencyInterval,
  frequencyStartDate,
  onFrequencyTypeChange,
  onFrequencyDaysChange,
  onFrequencyIntervalChange,
  onFrequencyStartDateChange,
  hideGroupOption,
}: FrequencySelectorProps) {
  const { t } = useTranslation();

  const toggleDay = (day: number) => {
    if (frequencyDays.includes(day)) {
      onFrequencyDaysChange(frequencyDays.filter((d) => d !== day));
    } else {
      onFrequencyDaysChange([...frequencyDays, day].sort());
    }
  };

  const typeOptions = hideGroupOption
    ? (["daily", "weekdays", "interval"] as const)
    : (["daily", "weekdays", "interval", "group"] as const);

  return (
    <div className="space-y-2">
      <label className="text-[11px] text-notion-text-secondary uppercase tracking-wide block">
        {t("schedule.frequency", "Frequency")}
      </label>

      {/* Frequency type selector */}
      <div className="flex gap-1 flex-wrap">
        {typeOptions.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onFrequencyTypeChange(type)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              frequencyType === type
                ? "bg-notion-accent text-white"
                : "bg-notion-bg-secondary text-notion-text-secondary hover:bg-notion-hover"
            }`}
          >
            {t(
              `schedule.frequency${type.charAt(0).toUpperCase() + type.slice(1)}`,
            )}
          </button>
        ))}
      </div>

      {/* Weekday checkboxes */}
      {frequencyType === "weekdays" && (
        <div className="flex gap-1">
          {DAY_KEYS.map((key, index) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleDay(index)}
              className={`w-8 h-8 text-xs rounded-full transition-colors ${
                frequencyDays.includes(index)
                  ? "bg-notion-accent text-white"
                  : "bg-notion-bg-secondary text-notion-text-secondary hover:bg-notion-hover"
              }`}
            >
              {t(`schedule.${key}`)}
            </button>
          ))}
        </div>
      )}

      {/* Interval settings */}
      {frequencyType === "interval" && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-[10px] text-notion-text-secondary mb-0.5 block">
              {t("schedule.intervalDays", "Interval (days)")}
            </label>
            <input
              type="number"
              min={2}
              max={365}
              value={frequencyInterval}
              onChange={(e) =>
                onFrequencyIntervalChange(
                  Math.max(2, parseInt(e.target.value) || 2),
                )
              }
              className="w-full px-2 py-1 text-sm bg-notion-bg-secondary border border-notion-border rounded focus:outline-none focus:ring-1 focus:ring-notion-accent text-notion-text"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-notion-text-secondary mb-0.5 block">
              {t("schedule.startDate", "Start date")}
            </label>
            <input
              type="date"
              value={frequencyStartDate}
              onChange={(e) => onFrequencyStartDateChange(e.target.value)}
              className="w-full px-2 py-1 text-sm bg-notion-bg-secondary border border-notion-border rounded focus:outline-none focus:ring-1 focus:ring-notion-accent text-notion-text"
            />
          </div>
        </div>
      )}
    </div>
  );
}
