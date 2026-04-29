import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateKey } from "../../../utils/dateKey";
import type { DayItem } from "./dayItem";
import { MobileEventChip } from "./MobileEventChip";

const MAX_CHIPS_PER_CELL = 3;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

interface MobileMonthlyCalendarProps {
  selectedDate: string;
  onDateSelect: (dateStr: string) => void;
  viewDate: { year: number; month: number };
  onViewDateChange: (vd: { year: number; month: number }) => void;
  itemsByDate: Map<string, DayItem[]>;
}

export function MobileMonthlyCalendar({
  selectedDate,
  onDateSelect,
  viewDate,
  onViewDateChange,
  itemsByDate,
}: MobileMonthlyCalendarProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const dayLabels =
    lang === "ja"
      ? ["月", "火", "水", "木", "金", "土", "日"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const todayString = useMemo(() => formatDateKey(new Date()), []);

  const monthLabel = useMemo(() => {
    if (lang === "ja") return `${viewDate.year}年${viewDate.month + 1}月`;
    const d = new Date(viewDate.year, viewDate.month, 1);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
  }, [viewDate, lang]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewDate.year, viewDate.month, 1);
    const lastDay = new Date(viewDate.year, viewDate.month + 1, 0);

    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const days: Array<{ date: Date; inMonth: boolean }> = [];
    for (let i = startDow - 1; i >= 0; i--) {
      days.push({ date: addDays(firstDay, -i - 1), inMonth: false });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({
        date: new Date(viewDate.year, viewDate.month, d),
        inMonth: true,
      });
    }
    while (days.length % 7 !== 0) {
      const lastDate = days[days.length - 1].date;
      days.push({ date: addDays(lastDate, 1), inMonth: false });
    }
    return days;
  }, [viewDate]);

  const navigateMonth = useCallback(
    (direction: -1 | 1) => {
      let newMonth = viewDate.month + direction;
      let newYear = viewDate.year;
      if (newMonth < 0) {
        newMonth = 11;
        newYear--;
      } else if (newMonth > 11) {
        newMonth = 0;
        newYear++;
      }
      onViewDateChange({ year: newYear, month: newMonth });
    },
    [viewDate, onViewDateChange],
  );

  const goToToday = useCallback(() => {
    const now = new Date();
    onViewDateChange({ year: now.getFullYear(), month: now.getMonth() });
    onDateSelect(formatDateKey(now));
  }, [onDateSelect, onViewDateChange]);

  return (
    <div className="flex flex-col border-b border-notion-border bg-notion-bg">
      {/* Month header */}
      <div className="flex items-center justify-between px-3.5 pb-2 pt-2.5">
        <div className="text-[22px] font-bold tracking-tight text-notion-text">
          {monthLabel}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={goToToday}
            aria-label={t("mobile.calendar.today", "Today")}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-lg active:bg-notion-hover"
          >
            <CalendarDays size={18} className="text-notion-text-secondary" />
          </button>
          <button
            onClick={() => navigateMonth(-1)}
            aria-label="Previous month"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-lg active:bg-notion-hover"
          >
            <ChevronLeft size={18} className="text-notion-text-secondary" />
          </button>
          <button
            onClick={() => navigateMonth(1)}
            aria-label="Next month"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-lg active:bg-notion-hover"
          >
            <ChevronRight size={18} className="text-notion-text-secondary" />
          </button>
        </div>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 border-y border-notion-border bg-notion-bg-secondary">
        {dayLabels.map((l, i) => (
          <div
            key={l}
            className={`border-r border-notion-border py-1.5 text-center text-[11px] font-semibold last:border-r-0 ${
              i === 6
                ? "text-red-500"
                : i === 5
                  ? "text-red-400"
                  : "text-notion-text-secondary"
            }`}
          >
            {l}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-7 border-l border-notion-border">
        {calendarDays.map(({ date, inMonth }) => {
          const dateStr = formatDateKey(date);
          const items = itemsByDate.get(dateStr) ?? [];
          return (
            <DayCell
              key={dateStr}
              date={date}
              inMonth={inMonth}
              isToday={dateStr === todayString}
              isSelected={dateStr === selectedDate}
              items={items}
              onTap={() => onDateSelect(dateStr)}
            />
          );
        })}
      </div>
    </div>
  );
}

// --- Day cell ---

interface DayCellProps {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  items: DayItem[];
  onTap: () => void;
}

function DayCell({
  date,
  inMonth,
  isToday,
  isSelected,
  items,
  onTap,
}: DayCellProps) {
  const { t } = useTranslation();
  const day = date.getDate();
  const dow = date.getDay();
  const isSun = dow === 0;
  const isSat = dow === 6;

  const visible = items.slice(0, MAX_CHIPS_PER_CELL);
  const more = Math.max(0, items.length - MAX_CHIPS_PER_CELL);

  const monthLabel =
    day === 1 ? date.toLocaleDateString("en-US", { month: "short" }) : null;

  const numColor = !inMonth
    ? "text-notion-text-secondary/60"
    : isSun
      ? "text-red-500"
      : isSat
        ? "text-red-400"
        : "text-notion-text";

  return (
    <button
      onClick={onTap}
      className={`relative flex min-h-[78px] w-full min-w-0 max-w-full flex-col overflow-hidden border-b border-r border-notion-border px-[3px] pb-[3px] pt-1 text-left ${
        isSelected
          ? "bg-notion-accent/10"
          : inMonth
            ? "bg-notion-bg"
            : "bg-notion-bg-secondary/60"
      } ${inMonth ? "" : "opacity-85"}`}
      style={{ boxSizing: "border-box" }}
    >
      {isSelected && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ boxShadow: "inset 0 0 0 1.5px var(--color-notion-accent)" }}
        />
      )}
      {/* Date row */}
      <div className="flex items-center justify-between px-0.5 pb-0.5">
        {monthLabel ? (
          <span className="text-[9px] font-semibold uppercase tracking-wider text-notion-text-secondary">
            {monthLabel}
          </span>
        ) : (
          <span />
        )}
        {isToday ? (
          <div
            className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-notion-accent text-[11px] font-semibold text-white"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {day}
          </div>
        ) : (
          <span
            className={`px-0.5 text-[11.5px] tabular-nums ${numColor} ${
              isSelected ? "font-bold" : "font-medium"
            }`}
          >
            {day}
          </span>
        )}
      </div>

      {/* Chips: title list, max 3 + "+N more" */}
      <div className="flex min-w-0 flex-col gap-[1.5px] overflow-hidden px-px">
        {visible.map((item) => (
          <MobileEventChip key={item.id} item={item} dimmed={!inMonth} />
        ))}
        {more > 0 && (
          <div className="mt-px pl-[5px] text-[9px] font-medium text-notion-text-secondary">
            {t("mobile.calendar.moreCount", "+{{count}} more", { count: more })}
          </div>
        )}
      </div>
    </button>
  );
}
