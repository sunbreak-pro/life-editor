import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { TimeDropdown } from "../TimeDropdown";
import { ToggleSwitch } from "../ToggleSwitch";
import {
  adjustEndTimeForStartChange,
  clampEndTimeAfterStart,
  defaultEndTimeForStart,
} from "../../../utils/timeGridUtils";

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
  const prevStartRef = useRef(startTime);

  const handleHasEndTimeChange = (v: boolean) => {
    if (v && startTime) {
      onEndTimeChange(defaultEndTimeForStart(startTime));
    }
    onHasEndTimeChange(v);
  };

  const handleStartTimeChange = (h: number, m: number) => {
    const newStart = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    if (hasEndTime && prevStartRef.current && endTime) {
      onEndTimeChange(
        adjustEndTimeForStartChange(prevStartRef.current, newStart, endTime),
      );
    }
    prevStartRef.current = newStart;
    onStartTimeChange(newStart);
  };

  const handleEndTimeChange = (h: number, m: number) => {
    const newEnd = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    onEndTimeChange(
      startTime ? clampEndTimeAfterStart(startTime, newEnd) : newEnd,
    );
  };

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
            <ToggleSwitch
              checked={hasEndTime}
              onChange={handleHasEndTimeChange}
            />
          </div>

          {/* Time inputs - side by side */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-notion-text-secondary mb-0.5 block">
                {t("schedule.start")}
              </label>
              <TimeDropdown
                hour={parseInt(startTime.split(":")[0] || "0", 10)}
                minute={parseInt(startTime.split(":")[1] || "0", 10)}
                onChange={handleStartTimeChange}
                minuteStep={1}
                size="sm"
              />
            </div>

            {hasEndTime && (
              <div className="flex-1">
                <label className="text-[10px] text-notion-text-secondary mb-0.5 block">
                  {t("schedule.end")}
                </label>
                <TimeDropdown
                  hour={parseInt(endTime.split(":")[0] || "0", 10)}
                  minute={parseInt(endTime.split(":")[1] || "0", 10)}
                  onChange={handleEndTimeChange}
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
