import { useState, useRef } from "react";
import {
  Calendar as CalendarIcon,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatDateKey, toLocalISOString } from "../../utils/dateKey";
import { useClickOutside } from "../../hooks/useClickOutside";
import { TimeInput } from "../shared/TimeInput";

interface DateTimePickerProps {
  value?: string;
  onChange: (value: string | null) => void;
  icon?: React.ReactNode;
  label?: string;
  activeColor?: boolean;
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

export function DateTimePicker({
  value,
  onChange,
  icon,
  label,
  activeColor,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = value ? new Date(value) : new Date();
  const [viewYear, setViewYear] = useState(current.getFullYear());
  const [viewMonth, setViewMonth] = useState(current.getMonth());
  const [hour, setHour] = useState(current.getHours());
  const [minute, setMinute] = useState(current.getMinutes());

  const closeDropdown = () => setOpen(false);
  useClickOutside(ref, closeDropdown, open);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = formatDateKey(new Date());
  const selectedKey = value ? value.substring(0, 10) : null;

  const handleSelectDate = (day: number) => {
    const dt = new Date(viewYear, viewMonth, day, hour, minute);
    onChange(toLocalISOString(dt));
  };

  const handleTimeChange = (h: number, m: number) => {
    setHour(h);
    setMinute(m);
    if (value) {
      const dt = new Date(value);
      dt.setHours(h, m);
      onChange(toLocalISOString(dt));
    }
  };

  const displayText = value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : label
      ? `Set ${label.toLowerCase()}`
      : "Set date";

  const hasValue = !!value && activeColor;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 text-sm px-2 py-1 rounded-md transition-colors ${
          hasValue
            ? "text-notion-accent bg-notion-accent/10"
            : "text-notion-text-secondary hover:bg-notion-hover"
        }`}
      >
        {icon ?? <CalendarIcon size={14} />}
        <span>{displayText}</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-notion-bg border border-notion-border rounded-lg shadow-lg p-3 w-64">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => {
                if (viewMonth === 0) {
                  setViewMonth(11);
                  setViewYear((y) => y - 1);
                } else setViewMonth((m) => m - 1);
              }}
              className="p-1 rounded hover:bg-notion-hover text-notion-text-secondary"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-medium text-notion-text">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              onClick={() => {
                if (viewMonth === 11) {
                  setViewMonth(0);
                  setViewYear((y) => y + 1);
                } else setViewMonth((m) => m + 1);
              }}
              className="p-1 rounded hover:bg-notion-hover text-notion-text-secondary"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div
                key={i}
                className="text-center text-xs text-notion-text-secondary py-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDay }, (_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isToday = key === today;
              const isSelected = key === selectedKey;
              return (
                <button
                  key={day}
                  onClick={() => handleSelectDate(day)}
                  className={`text-xs py-1 rounded transition-colors ${
                    isSelected
                      ? "bg-notion-accent text-white"
                      : isToday
                        ? "bg-notion-accent/20 text-notion-accent font-bold"
                        : "text-notion-text hover:bg-notion-hover"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Time selector */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-notion-border">
            <TimeInput
              hour={hour}
              minute={minute}
              onChange={handleTimeChange}
            />
          </div>

          {/* Clear button */}
          {value && (
            <button
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="flex items-center gap-1 mt-2 text-xs text-notion-text-secondary hover:text-notion-danger transition-colors"
            >
              <X size={12} />
              <span>Clear date</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
