import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

type ViewMode = "month" | "week" | "day";

interface CalendarHeaderProps {
  year: number;
  month: number;
  viewMode: ViewMode;
  weekStartDate?: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  calendarMode?: "tasks" | "memo";
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SHORT_MONTH_NAMES = [
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

function formatDateRange(start: Date, offsetDays: number): string {
  const end = new Date(start);
  end.setDate(end.getDate() + offsetDays);

  const sMonth = SHORT_MONTH_NAMES[start.getMonth()];
  const eMonth = SHORT_MONTH_NAMES[end.getMonth()];
  const sDay = start.getDate();
  const eDay = end.getDate();
  const sYear = start.getFullYear();
  const eYear = end.getFullYear();

  if (sYear !== eYear) {
    return `${sMonth} ${sDay}, ${sYear} - ${eMonth} ${eDay}, ${eYear}`;
  }
  if (start.getMonth() !== end.getMonth()) {
    return `${sMonth} ${sDay} - ${eMonth} ${eDay}, ${sYear}`;
  }
  return `${sMonth} ${sDay} - ${eDay}, ${sYear}`;
}

export function CalendarHeader({
  year,
  month,
  viewMode,
  weekStartDate,
  onPrev,
  onNext,
  onToday,
  onViewModeChange,
  calendarMode,
}: CalendarHeaderProps) {
  const { t } = useTranslation();
  const title = (() => {
    if (viewMode === "week" && weekStartDate)
      return formatDateRange(weekStartDate, 6);
    if (viewMode === "day" && weekStartDate) {
      const d = weekStartDate;
      return `${SHORT_MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    }
    return `${MONTH_NAMES[month]} ${year}`;
  })();

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-notion-text">{title}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={onPrev}
            className="p-1 rounded-md text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={onNext}
            className="p-1 rounded-md text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <button
          onClick={onToday}
          className="px-2 py-1 text-xs rounded-md border border-notion-border text-notion-text-secondary hover:bg-notion-hover transition-colors"
        >
          {t("calendarHeader.today")}
        </button>
      </div>

      {calendarMode !== "memo" && (
        <div className="flex items-center gap-1 bg-notion-bg-secondary rounded-md p-0.5">
          <button
            onClick={() => onViewModeChange("month")}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              viewMode === "month"
                ? "bg-notion-bg text-notion-text shadow-sm"
                : "text-notion-text-secondary hover:text-notion-text"
            }`}
          >
            {t("calendarHeader.month")}
          </button>
          <button
            onClick={() => onViewModeChange("week")}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              viewMode === "week"
                ? "bg-notion-bg text-notion-text shadow-sm"
                : "text-notion-text-secondary hover:text-notion-text"
            }`}
          >
            {t("calendarHeader.week")}
          </button>
          <button
            onClick={() => onViewModeChange("day")}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              viewMode === "day"
                ? "bg-notion-bg text-notion-text shadow-sm"
                : "text-notion-text-secondary hover:text-notion-text"
            }`}
          >
            {t("calendarHeader.day")}
          </button>
        </div>
      )}
    </div>
  );
}
