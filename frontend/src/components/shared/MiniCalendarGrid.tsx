import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDateKey, toLocalISOString } from "../../utils/dateKey";
import { TimeInput } from "./TimeInput";
import { DateInput } from "./DateInput";

interface MiniCalendarGridProps {
  startValue?: string;
  endValue?: string;
  isAllDay?: boolean;
  onStartChange: (value: string | undefined) => void;
  onEndChange: (value: string | undefined) => void;
  onAllDayChange: (value: boolean) => void;
  initialDate?: Date;
  controlsPosition?: "bottom" | "right";
}

const MONTH_NAMES = [
  "1月",
  "2月",
  "3月",
  "4月",
  "5月",
  "6月",
  "7月",
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
];

export function MiniCalendarGrid({
  startValue,
  endValue,
  isAllDay,
  onStartChange,
  onEndChange,
  onAllDayChange,
  initialDate,
  controlsPosition = "bottom",
}: MiniCalendarGridProps) {
  const { t } = useTranslation();

  const startDate = startValue
    ? new Date(startValue)
    : (initialDate ?? new Date());
  const [viewYear, setViewYear] = useState(
    initialDate?.getFullYear() ?? startDate.getFullYear(),
  );
  const [viewMonth, setViewMonth] = useState(
    initialDate?.getMonth() ?? startDate.getMonth(),
  );
  const [selectingEnd, setSelectingEnd] = useState(false);

  const [startHour, setStartHour] = useState(startDate.getHours());
  const [startMinute, setStartMinute] = useState(startDate.getMinutes());

  const endDate = endValue ? new Date(endValue) : null;
  const [endHour, setEndHour] = useState(
    endDate?.getHours() ?? startDate.getHours() + 1,
  );
  const [endMinute, setEndMinute] = useState(endDate?.getMinutes() ?? 0);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = formatDateKey(new Date());
  const startKey = startValue ? formatDateKey(new Date(startValue)) : null;
  const endKey = endValue ? formatDateKey(new Date(endValue)) : null;
  const hasEndDate = !!endValue;

  const handleSelectDate = (day: number) => {
    if (!hasEndDate) {
      const dt = new Date(
        viewYear,
        viewMonth,
        day,
        isAllDay ? 0 : startHour,
        isAllDay ? 0 : startMinute,
      );
      onStartChange(toLocalISOString(dt));
    } else if (!selectingEnd) {
      const dt = new Date(
        viewYear,
        viewMonth,
        day,
        isAllDay ? 0 : startHour,
        isAllDay ? 0 : startMinute,
      );
      onStartChange(toLocalISOString(dt));
      setSelectingEnd(true);
    } else {
      const dt = new Date(
        viewYear,
        viewMonth,
        day,
        isAllDay ? 23 : endHour,
        isAllDay ? 59 : endMinute,
      );
      const startDt = startValue ? new Date(startValue) : new Date();
      if (dt < startDt) {
        onStartChange(toLocalISOString(dt));
        onEndChange(toLocalISOString(startDt));
      } else {
        onEndChange(toLocalISOString(dt));
      }
      setSelectingEnd(false);
    }
  };

  const handleClear = () => {
    onStartChange(undefined);
    setSelectingEnd(false);
  };

  const handleToggleEndDate = (enabled: boolean) => {
    if (enabled) {
      const s = startValue ? new Date(startValue) : new Date();
      const e = new Date(s);
      e.setHours(e.getHours() + 1);
      setEndHour(e.getHours());
      setEndMinute(e.getMinutes());
      onEndChange(toLocalISOString(e));
    } else {
      onEndChange(undefined);
      setSelectingEnd(false);
    }
  };

  const handleStartTimeChange = (h: number, m: number) => {
    setStartHour(h);
    setStartMinute(m);
    if (startValue) {
      const dt = new Date(startValue);
      dt.setHours(h, m);
      onStartChange(toLocalISOString(dt));
    }
  };

  const handleEndTimeChange = (h: number, m: number) => {
    setEndHour(h);
    setEndMinute(m);
    if (endValue) {
      const dt = new Date(endValue);
      dt.setHours(h, m);
      onEndChange(toLocalISOString(dt));
    }
  };

  const handleStartDateInput = (y: number, m: number, d: number) => {
    const dt = new Date(y, m - 1, d, startHour, startMinute);
    onStartChange(toLocalISOString(dt));
  };

  const handleEndDateInput = (y: number, m: number, d: number) => {
    const dt = new Date(y, m - 1, d, endHour, endMinute);
    onEndChange(toLocalISOString(dt));
  };

  const isInRange = (key: string) => {
    if (!startKey || !endKey) return false;
    return key >= startKey && key <= endKey;
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const calendarSection = (
    <div className="w-full">
      {/* Month nav */}
      <div className="flex items-center justify-between px-2 py-1 mb-2">
        <button
          onClick={prevMonth}
          className="p-0.5 rounded-full hover:bg-notion-hover text-notion-text-secondary"
        >
          <ChevronLeft size={12} />
        </button>
        <span className="text-sm font-medium text-notion-text">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="p-0.5 rounded-full hover:bg-notion-hover text-notion-text-secondary"
        >
          <ChevronRight size={12} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 bg-red-500 rounded-md py-0.5 gap-1 mb-1 items-center justify-items-center">
        {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
          <div
            key={i}
            className="text-center text-sm text-cyan-50 flex items-center justify-center"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }, (_, i) => (
          <div key={`pad-${i}`} className="aspect-square" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = key === today;
          const isStart = key === startKey;
          const isEnd = key === endKey;
          const inRange = isInRange(key);
          return (
            <button
              key={day}
              onClick={() => handleSelectDate(day)}
              className={`text-sm aspect-square flex items-center justify-center rounded-full transition-colors ${
                isStart || isEnd
                  ? "bg-notion-accent text-white"
                  : inRange
                    ? "bg-notion-accent/15 text-notion-accent"
                    : isToday
                      ? "ring-1.5 ring-notion-accent text-notion-accent font-semibold"
                      : "text-notion-text hover:bg-notion-hover"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );

  const controlsContent = (
    <>
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={hasEndDate}
          onChange={(e) => {
            if (e.target.checked && isAllDay) {
              onAllDayChange(false);
            }
            handleToggleEndDate(e.target.checked);
          }}
          className="w-3 h-3 rounded accent-notion-accent"
        />
        <span className="text-[10px] text-notion-text-secondary">
          {t("taskDetail.showEndTime")}
        </span>
      </label>
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={!!isAllDay}
          onChange={(e) => {
            if (e.target.checked && hasEndDate) {
              handleToggleEndDate(false);
            }
            onAllDayChange(e.target.checked);
          }}
          className="w-3 h-3 rounded accent-notion-accent"
        />
        <span className="text-[10px] text-notion-text-secondary">
          {t("taskDetail.allDay")}
        </span>
      </label>
      {startValue && (
        <button
          onClick={handleClear}
          className="flex items-center gap-0.5 text-[10px] text-notion-text-secondary hover:text-notion-danger transition-colors"
        >
          <X size={10} />
          <span>{t("taskDetail.clearSchedule")}</span>
        </button>
      )}
    </>
  );

  const dateTimeInputs = !isAllDay ? (
    <div className="flex flex-col gap-1.5 pt-1">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-notion-text-secondary w-7 shrink-0">
          {t("calendar.startLabel")}
        </span>
        <DateInput
          year={startDate.getFullYear()}
          month={startDate.getMonth() + 1}
          day={startDate.getDate()}
          onChange={handleStartDateInput}
          size="sm"
        />
        <TimeInput
          hour={startHour}
          minute={startMinute}
          onChange={handleStartTimeChange}
          size="sm"
        />
      </div>
      {hasEndDate && endDate && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-notion-text-secondary w-7 shrink-0">
            {t("calendar.endLabel")}
          </span>
          <DateInput
            year={endDate.getFullYear()}
            month={endDate.getMonth() + 1}
            day={endDate.getDate()}
            onChange={handleEndDateInput}
            size="sm"
          />
          <TimeInput
            hour={endHour}
            minute={endMinute}
            onChange={handleEndTimeChange}
            size="sm"
          />
        </div>
      )}
    </div>
  ) : null;

  if (controlsPosition === "right") {
    return (
      <div className="flex gap-3">
        <div className="w-70 shrink-0">
          <div className="flex flex-col px-4 py-2 gap-2">
            {calendarSection}
            {dateTimeInputs}
          </div>
        </div>
        <div className="flex flex-col gap-2.5 pt-2 pl-3 border-l border-notion-border">
          {controlsContent}
        </div>
      </div>
    );
  }

  return (
    <div className="w-70">
      <div className="flex flex-col px-4 py-2 gap-2">
        {calendarSection}
        {/* Controls row */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-notion-border">
          <div className="flex items-center gap-3">{controlsContent}</div>
        </div>
        {dateTimeInputs}
      </div>
    </div>
  );
}
