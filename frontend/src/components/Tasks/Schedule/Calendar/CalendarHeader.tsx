import { useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { FolderDropdown } from "../../Folder/FolderDropdown";
import { useTaskTreeContext } from "../../../../hooks/useTaskTreeContext";

type ViewMode = "month" | "week";

interface CalendarHeaderProps {
  year: number;
  month: number;
  viewMode: ViewMode;
  weekStartDate?: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  filterFolderId?: string | null;
  onFilterFolderChange?: (folderId: string | null) => void;
  showHolidays?: boolean;
  onShowHolidaysChange?: (show: boolean) => void;
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

const SHORT_MONTH_NAMES = [
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
  filterFolderId,
  onFilterFolderChange,
  showHolidays,
  onShowHolidaysChange,
}: CalendarHeaderProps) {
  const { t } = useTranslation();
  const { nodes } = useTaskTreeContext();

  const selectedFolderName = useMemo(() => {
    if (!filterFolderId) return null;
    return nodes.find((n) => n.id === filterFolderId)?.title ?? null;
  }, [filterFolderId, nodes]);

  const title = (() => {
    if (viewMode === "week" && weekStartDate)
      return formatDateRange(weekStartDate, 6);
    return `${MONTH_NAMES[month]} ${year}`;
  })();

  return (
    <div className="flex items-center justify-between mb-4 pt-5">
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
        {onFilterFolderChange && (
          <FolderDropdown
            selectedId={filterFolderId ?? null}
            onSelect={onFilterFolderChange}
            rootLabel={t("calendar.all")}
            panelMinWidth="min-w-44"
            trigger={
              <button
                className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border transition-colors ${
                  filterFolderId
                    ? "border-notion-accent/30 bg-notion-accent/10 text-notion-accent"
                    : "border-notion-border text-notion-text-secondary hover:bg-notion-hover"
                }`}
              >
                <Filter size={12} />
                <span className="truncate max-w-24">
                  {filterFolderId && selectedFolderName
                    ? selectedFolderName
                    : t("calendar.folder")}
                </span>
                <ChevronDown size={11} />
              </button>
            }
          />
        )}
        {onShowHolidaysChange && (
          <button
            onClick={() => onShowHolidaysChange(!showHolidays)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors ${
              showHolidays
                ? "border-green-500/30 bg-green-500/10 text-green-600"
                : "border-notion-border text-notion-text-secondary hover:bg-notion-hover"
            }`}
            title={t("calendarHeader.holidays", "Holidays")}
          >
            <Sparkles size={12} />
            {t("calendarHeader.holidays", "Holidays")}
          </button>
        )}
      </div>

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
      </div>
    </div>
  );
}
