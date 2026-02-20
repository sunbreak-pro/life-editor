import { useState, useRef, useEffect, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MemoNode } from "../../types/memo";
import { formatDisplayDate, formatDateKey } from "../../utils/dateKey";

const MISSING_DAYS_RANGE = 30;

const EN_SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const JA_SHORT_WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function formatDateWithWeekday(dateStr: string, locale: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const weekdays = locale.startsWith("ja")
    ? JA_SHORT_WEEKDAYS
    : EN_SHORT_WEEKDAYS;
  const weekday = weekdays[date.getDay()];
  return `${formatDisplayDate(dateStr)} (${weekday})`;
}

interface MemoDateListProps {
  memos: MemoNode[];
  selectedDate: string;
  todayKey: string;
  onSelectDate: (date: string) => void;
  onCreateForDate: (date: string) => void;
  onDelete: (date: string) => void;
}

export function MemoDateList({
  memos,
  selectedDate,
  todayKey,
  onSelectDate,
  onCreateForDate,
  onDelete,
}: MemoDateListProps) {
  const { i18n } = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  const missingDates = useMemo(() => {
    const existingDates = new Set(memos.map((m) => m.date));
    const dates: string[] = [];
    const today = new Date();
    for (let i = 0; i < MISSING_DAYS_RANGE; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = formatDateKey(d);
      if (!existingDates.has(key)) {
        dates.push(key);
      }
    }
    return dates;
  }, [memos]);

  return (
    <div className="w-60 shrink-0 border-r border-notion-border h-full flex flex-col">
      <div className="p-3 border-b border-notion-border">
        <div
          className="flex items-center justify-end relative"
          ref={dropdownRef}
        >
          <button
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
            title="Create memo for date"
          >
            <Plus size={16} />
          </button>
          {isDropdownOpen && (
            <div className="absolute top-full right-0 mt-1 w-52 bg-notion-bg-secondary border border-notion-border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
              {missingDates.length === 0 ? (
                <div className="px-3 py-2 text-xs text-notion-text-secondary">
                  No dates available
                </div>
              ) : (
                missingDates.map((date) => (
                  <button
                    key={date}
                    onClick={() => {
                      onCreateForDate(date);
                      setIsDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text transition-colors first:rounded-t-lg last:rounded-b-lg"
                  >
                    {formatDateWithWeekday(date, i18n.language)}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-1">
        {/* Today shortcut - always visible */}
        <button
          onClick={() => onSelectDate(todayKey)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
            selectedDate === todayKey
              ? "bg-notion-hover text-notion-text font-medium"
              : "text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text"
          }`}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          Today
        </button>

        {/* Memo date list */}
        {memos
          .filter((m) => m.date !== todayKey)
          .map((memo) => (
            <div key={memo.id} className="group relative">
              <button
                onClick={() => onSelectDate(memo.date)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedDate === memo.date
                    ? "bg-notion-hover text-notion-text font-medium"
                    : "text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text"
                }`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-notion-text-secondary/30 shrink-0" />
                <span className="flex-1">{formatDisplayDate(memo.date)}</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(memo.date);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-notion-text-secondary hover:text-red-500 rounded transition-all"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
