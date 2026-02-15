import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDateKey, toLocalISOString } from "../../utils/dateKey";

interface MiniCalendarGridProps {
  startValue?: string;
  endValue?: string;
  isAllDay?: boolean;
  onStartChange: (value: string | undefined) => void;
  onEndChange: (value: string | undefined) => void;
  onAllDayChange: (value: boolean) => void;
  initialDate?: Date;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function generateDateOptions(
  viewYear: number,
  viewMonth: number,
): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let offset = -1; offset <= 1; offset++) {
    const m = viewMonth + offset;
    const y = viewYear + Math.floor(m / 12);
    const nm = ((m % 12) + 12) % 12;
    const days = new Date(y, nm + 1, 0).getDate();
    for (let d = 1; d <= days; d++) {
      const key = `${y}-${String(nm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      options.push({ value: key, label: `${nm + 1}/${d}` });
    }
  }
  return options;
}

export function MiniCalendarGrid({
  startValue,
  endValue,
  isAllDay,
  onStartChange,
  onEndChange,
  onAllDayChange,
  initialDate,
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

  const dateOptions = useMemo(
    () => generateDateOptions(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

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

  const handleStartDateSelect = (dateKey: string) => {
    const [y, mo, d] = dateKey.split("-").map(Number);
    const dt = new Date(y, mo - 1, d, startHour, startMinute);
    onStartChange(toLocalISOString(dt));
  };

  const handleEndDateSelect = (dateKey: string) => {
    const [y, mo, d] = dateKey.split("-").map(Number);
    const dt = new Date(y, mo - 1, d, endHour, endMinute);
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

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={hasEndDate}
              onChange={(e) => handleToggleEndDate(e.target.checked)}
              disabled={!!isAllDay}
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
              onChange={(e) => onAllDayChange(e.target.checked)}
              className="w-3 h-3 rounded accent-notion-accent"
            />
            <span className="text-[10px] text-notion-text-secondary">
              {t("taskDetail.allDay")}
            </span>
          </label>
        </div>
        {startValue && (
          <button
            onClick={handleClear}
            className="flex items-center gap-0.5 text-[10px] text-notion-text-secondary hover:text-notion-danger transition-colors"
          >
            <X size={10} />
            <span>{t("taskDetail.clearSchedule")}</span>
          </button>
        )}
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={prevMonth}
          className="p-0.5 rounded hover:bg-notion-hover text-notion-text-secondary"
        >
          <ChevronLeft size={12} />
        </button>
        <span className="text-xs font-medium text-notion-text">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="p-0.5 rounded hover:bg-notion-hover text-notion-text-secondary"
        >
          <ChevronRight size={12} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-0.5">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div
            key={i}
            className="text-center text-[10px] text-notion-text-secondary aspect-square flex items-center justify-center"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
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
              className={`text-[10px] aspect-square flex items-center justify-center rounded transition-colors ${
                isStart || isEnd
                  ? "bg-notion-accent text-white"
                  : inRange
                    ? "bg-notion-accent/20 text-notion-accent"
                    : isToday
                      ? "bg-notion-accent/10 text-notion-accent font-bold"
                      : "text-notion-text hover:bg-notion-hover"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Time selectors */}
      {!isAllDay && (
        <div className="mt-2 pt-2 border-t border-notion-border space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs mx-0.5 font-bold">開始 : </span>
            <select
              value={startValue ? formatDateKey(new Date(startValue)) : ""}
              onChange={(e) => handleStartDateSelect(e.target.value)}
              className="text-[10px] bg-notion-bg-secondary border border-notion-border rounded px-0.5 py-0.5 mr-2 text-notion-text w-16 "
            >
              {dateOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={startHour}
              onChange={(e) =>
                handleStartTimeChange(Number(e.target.value), startMinute)
              }
              className="flex-1 text-xs bg-notion-bg-secondary border border-notion-border rounded px-1 py-0.5 text-notion-text"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, "0")}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-notion-text-secondary">:</span>
            <select
              value={startMinute}
              onChange={(e) =>
                handleStartTimeChange(startHour, Number(e.target.value))
              }
              className="flex-1 text-xs bg-notion-bg-secondary border border-notion-border rounded px-1 py-0.5 text-notion-text"
            >
              {MINUTES.map((m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, "0")}
                </option>
              ))}
            </select>
          </div>
          {hasEndDate && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs mx-0.5 font-bold">終了 : </span>
              <select
                value={endValue ? formatDateKey(new Date(endValue)) : ""}
                onChange={(e) => handleEndDateSelect(e.target.value)}
                className="text-[10px] bg-notion-bg-secondary border border-notion-border rounded px-0.5 py-0.5 mr-2 text-notion-text w-16"
              >
                {dateOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                value={endHour}
                onChange={(e) =>
                  handleEndTimeChange(Number(e.target.value), endMinute)
                }
                className="flex-1 text-xs bg-notion-bg-secondary border border-notion-border rounded px-1 py-0.5 text-notion-text w-5"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, "0")}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-notion-text-secondary">:</span>
              <select
                value={endMinute}
                onChange={(e) =>
                  handleEndTimeChange(endHour, Number(e.target.value))
                }
                className="flex-1 text-xs bg-notion-bg-secondary border border-notion-border rounded px-1 py-0.5 text-notion-text"
              >
                {MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
