import { useState, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, getMondayOf, getWeekDates } from "../../utils/calendarGrid";
import { formatDateKey } from "../../utils/dateKey";

interface MobileCalendarStripProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  itemCountByDate?: Map<string, number>;
}

const DAY_LABELS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LABELS_JA = ["月", "火", "水", "木", "金", "土", "日"];

function getMonthLabel(dates: Date[], lang: string): string {
  const first = dates[0];
  const last = dates[6];

  const fmt = (d: Date) => {
    if (lang === "ja") {
      return `${d.getFullYear()}年${d.getMonth() + 1}月`;
    }
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
  };

  if (first.getMonth() === last.getMonth()) {
    return fmt(first);
  }
  // Week spans two months
  if (lang === "ja") {
    if (first.getFullYear() === last.getFullYear()) {
      return `${first.getFullYear()}年${first.getMonth() + 1}月 - ${last.getMonth() + 1}月`;
    }
    return `${fmt(first)} - ${fmt(last)}`;
  }
  if (first.getFullYear() === last.getFullYear()) {
    const m1 = first.toLocaleDateString("en-US", { month: "short" });
    const m2 = last.toLocaleDateString("en-US", { month: "short" });
    return `${m1} - ${m2} ${first.getFullYear()}`;
  }
  const m1 = first.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
  const m2 = last.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
  return `${m1} - ${m2}`;
}

const SWIPE_THRESHOLD = 50;

export function MobileCalendarStrip({
  selectedDate,
  onDateSelect,
  itemCountByDate,
}: MobileCalendarStripProps) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const dayLabels = lang === "ja" ? DAY_LABELS_JA : DAY_LABELS_EN;

  const todayStr = useMemo(() => formatDateKey(new Date()), []);

  const selectedDateObj = useMemo(
    () => new Date(selectedDate + "T00:00:00"),
    [selectedDate],
  );
  const [weekMonday, setWeekMonday] = useState<Date>(() =>
    getMondayOf(selectedDateObj),
  );

  const weekDates = useMemo(() => getWeekDates(weekMonday), [weekMonday]);
  const monthLabel = useMemo(
    () => getMonthLabel(weekDates, lang),
    [weekDates, lang],
  );

  // Touch handling
  const touchRef = useRef<{ startX: number; startY: number; swiping: boolean }>(
    {
      startX: 0,
      startY: 0,
      swiping: false,
    },
  );
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const navigateWeek = useCallback((direction: -1 | 1) => {
    setIsTransitioning(true);
    setSwipeOffset(direction * -100);
    setTimeout(() => {
      setWeekMonday((prev) => addDays(prev, direction * 7));
      setSwipeOffset(0);
      setIsTransitioning(false);
    }, 200);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      swiping: false,
    };
    setSwipeOffset(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchRef.current.startX;
    const deltaY = touch.clientY - touchRef.current.startY;

    // Lock direction after initial movement
    if (
      !touchRef.current.swiping &&
      Math.abs(deltaX) > Math.abs(deltaY) &&
      Math.abs(deltaX) > 10
    ) {
      touchRef.current.swiping = true;
    }

    if (touchRef.current.swiping) {
      e.preventDefault();
      // Convert pixel offset to percentage (capped)
      const pct = Math.max(
        -40,
        Math.min(40, (deltaX / window.innerWidth) * 100),
      );
      setSwipeOffset(pct);
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchRef.current.swiping) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchRef.current.startX;

      if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
        navigateWeek(deltaX > 0 ? -1 : 1);
      } else {
        setSwipeOffset(0);
      }
      touchRef.current.swiping = false;
    },
    [navigateWeek],
  );

  const goToToday = useCallback(() => {
    const today = new Date();
    setWeekMonday(getMondayOf(today));
    onDateSelect(formatDateKey(today));
  }, [onDateSelect]);

  return (
    <div className="select-none border-b border-notion-border bg-notion-bg">
      {/* Month header */}
      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <button
          onClick={() => navigateWeek(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full active:bg-notion-hover"
          aria-label="Previous week"
        >
          <ChevronLeft size={20} className="text-notion-text-secondary" />
        </button>

        <button
          onClick={goToToday}
          className="text-sm font-semibold text-notion-text active:opacity-60"
        >
          {monthLabel}
        </button>

        <button
          onClick={() => navigateWeek(1)}
          className="flex h-9 w-9 items-center justify-center rounded-full active:bg-notion-hover"
          aria-label="Next week"
        >
          <ChevronRight size={20} className="text-notion-text-secondary" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 px-2">
        {dayLabels.map((label, i) => (
          <div
            key={label}
            className={`py-1 text-center text-[11px] font-medium ${
              i >= 5
                ? "text-notion-text-secondary/60"
                : "text-notion-text-secondary"
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Week dates - swipeable */}
      <div
        className="overflow-hidden px-2 pb-3"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="grid grid-cols-7"
          style={{
            transform: `translateX(${swipeOffset}%)`,
            transition: isTransitioning ? "transform 200ms ease-out" : "none",
          }}
        >
          {weekDates.map((date) => {
            const dateStr = formatDateKey(date);
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === todayStr;
            const itemCount = itemCountByDate?.get(dateStr) ?? 0;

            return (
              <button
                key={dateStr}
                onClick={() => onDateSelect(dateStr)}
                className="flex flex-col items-center gap-1 py-1"
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    isSelected
                      ? "bg-notion-accent text-white"
                      : isToday
                        ? "border border-notion-accent text-notion-accent"
                        : "text-notion-text active:bg-notion-hover"
                  }`}
                >
                  {date.getDate()}
                </div>
                {/* Item indicator dots */}
                <div className="flex h-1.5 items-center gap-0.5">
                  {itemCount > 0 && (
                    <>
                      <span
                        className={`h-1 w-1 rounded-full ${
                          isSelected
                            ? "bg-notion-accent/50"
                            : "bg-notion-accent"
                        }`}
                      />
                      {itemCount > 1 && (
                        <span
                          className={`h-1 w-1 rounded-full ${
                            isSelected
                              ? "bg-notion-accent/50"
                              : "bg-notion-accent/60"
                          }`}
                        />
                      )}
                      {itemCount > 3 && (
                        <span
                          className={`h-1 w-1 rounded-full ${
                            isSelected
                              ? "bg-notion-accent/50"
                              : "bg-notion-accent/40"
                          }`}
                        />
                      )}
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
