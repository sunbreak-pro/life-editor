import { useTranslation } from "react-i18next";
import { TimeInput } from "../TimeInput";

interface TimeSettingsInlineProps {
  isAllDay: boolean;
  onAllDayChange: (v: boolean) => void;
  startTime: string;
  onStartTimeChange: (v: string) => void;
  hasEndTime: boolean;
  onHasEndTimeChange: (v: boolean) => void;
  endTime: string;
  onEndTimeChange: (v: string) => void;
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
        checked ? "bg-notion-accent" : "bg-notion-border"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
          checked ? "translate-x-4" : ""
        }`}
      />
    </button>
  );
}

export function TimeSettingsInline({
  isAllDay,
  onAllDayChange,
  startTime,
  onStartTimeChange,
  hasEndTime,
  onHasEndTimeChange,
  endTime,
  onEndTimeChange,
}: TimeSettingsInlineProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      {/* All day toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-notion-text-secondary uppercase tracking-wide">
          {t("schedulePanel.allDay")}
        </span>
        <ToggleSwitch checked={isAllDay} onChange={onAllDayChange} />
      </div>

      {!isAllDay && (
        <>
          {/* End time toggle */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-notion-text-secondary uppercase tracking-wide">
              {t("schedulePanel.endTime")}
            </span>
            <ToggleSwitch checked={hasEndTime} onChange={onHasEndTimeChange} />
          </div>

          {/* Time inputs - side by side */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-notion-text-secondary mb-0.5 block">
                {t("schedule.start")}
              </label>
              <TimeInput
                hour={parseInt(startTime.split(":")[0] || "0", 10)}
                minute={parseInt(startTime.split(":")[1] || "0", 10)}
                onChange={(h, m) =>
                  onStartTimeChange(
                    `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
                  )
                }
                minuteStep={1}
                size="sm"
              />
            </div>

            {hasEndTime && (
              <div className="flex-1">
                <label className="text-[10px] text-notion-text-secondary mb-0.5 block">
                  {t("schedule.end")}
                </label>
                <TimeInput
                  hour={parseInt(endTime.split(":")[0] || "0", 10)}
                  minute={parseInt(endTime.split(":")[1] || "0", 10)}
                  onChange={(h, m) =>
                    onEndTimeChange(
                      `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
                    )
                  }
                  minuteStep={1}
                  size="sm"
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
