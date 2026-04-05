import { useState, useRef } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatScheduleRange } from "../../../../utils/formatSchedule";
import { useClickOutside } from "../../../../hooks/useClickOutside";
import { MiniCalendarGrid } from "../../../shared/MiniCalendarGrid";

interface DateTimeRangePickerProps {
  startValue?: string;
  endValue?: string;
  isAllDay?: boolean;
  onStartChange: (value: string | undefined) => void;
  onEndChange: (value: string | undefined) => void;
  onAllDayChange: (value: boolean) => void;
}

export function DateTimeRangePicker({
  startValue,
  endValue,
  isAllDay,
  onStartChange,
  onEndChange,
  onAllDayChange,
}: DateTimeRangePickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, () => setOpen(false), open);

  const displayText = (() => {
    if (!startValue) return t("taskDetail.schedule");
    const text = formatScheduleRange(startValue, endValue, isAllDay);
    if (isAllDay) return `${text} (${t("taskDetail.allDay")})`;
    return text;
  })();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${
          startValue
            ? "text-notion-accent bg-notion-accent/10"
            : "text-notion-text-secondary hover:bg-notion-hover"
        }`}
      >
        <CalendarIcon size={14} />
        <span>{displayText}</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-notion-bg border border-notion-border rounded-lg shadow-lg p-2 w-fit">
          <MiniCalendarGrid
            startValue={startValue}
            endValue={endValue}
            isAllDay={isAllDay}
            onStartChange={(val) => {
              onStartChange(val);
              if (val === undefined) setOpen(false);
            }}
            onEndChange={onEndChange}
            onAllDayChange={onAllDayChange}
          />
        </div>
      )}
    </div>
  );
}
