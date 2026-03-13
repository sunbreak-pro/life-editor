import { useTranslation } from "react-i18next";
import { Filter, ChevronDown } from "lucide-react";
import type { RoutineNode } from "../../../../types/routine";
import type { ScheduleItem } from "../../../../types/schedule";
import type { CalendarContentFilter } from "../../../../types/calendarItem";
import type { DayFlowFilterTab } from "../DayFlow/OneDaySchedule";
import type { CategoryProgress } from "../DayFlow/DayFlowSidebarContent";
import { FolderDropdown } from "../../Folder/FolderDropdown";
import { MiniRoutineFlow } from "../Routine/MiniRoutineFlow";
import { ProgressSection } from "../shared/ProgressSection";
import { useTaskTreeContext } from "../../../../hooks/useTaskTreeContext";
import { useMemo } from "react";

interface CalendarSidebarContentProps {
  progressDate: Date;
  categoryProgress: Record<DayFlowFilterTab, CategoryProgress>;
  activeProgressFilter: DayFlowFilterTab;
  onProgressFilterChange: (tab: DayFlowFilterTab) => void;
  filterFolderId: string | null;
  onFilterFolderChange: (folderId: string | null) => void;
  contentFilter: CalendarContentFilter;
  onContentFilterChange: (filter: CalendarContentFilter) => void;
  routines: RoutineNode[];
  scheduleItems: ScheduleItem[];
  tagAssignments: Map<string, number[]>;
  onToggleComplete: (id: string) => void;
}

const CONTENT_FILTERS: { id: CalendarContentFilter; labelKey: string }[] = [
  { id: "all", labelKey: "calendar.filterAll" },
  { id: "daily", labelKey: "calendar.filterDaily" },
  { id: "notes", labelKey: "calendar.filterNotes" },
  { id: "tasks", labelKey: "calendar.filterTasks" },
];

export function CalendarSidebarContent({
  progressDate,
  categoryProgress,
  activeProgressFilter,
  onProgressFilterChange,
  filterFolderId,
  onFilterFolderChange,
  contentFilter,
  onContentFilterChange,
  routines,
  scheduleItems,
  tagAssignments,
  onToggleComplete,
}: CalendarSidebarContentProps) {
  const { t } = useTranslation();
  const { nodes } = useTaskTreeContext();

  const selectedFolderName = useMemo(() => {
    if (!filterFolderId) return null;
    return nodes.find((n) => n.id === filterFolderId)?.title ?? null;
  }, [filterFolderId, nodes]);

  return (
    <div className="flex flex-col gap-3">
      {/* Progress Section */}
      <ProgressSection
        date={progressDate}
        categoryProgress={categoryProgress}
        activeFilter={activeProgressFilter}
        onFilterChange={onProgressFilterChange}
      />

      {/* Filter section */}
      <div className="flex flex-col">
        <span className="text-[10px] text-notion-text-secondary uppercase tracking-wide font-medium px-3 py-1.5">
          {t("calendar.filters", "Filters")}
        </span>

        {/* Content Type filter */}
        <div className="px-3 mb-2">
          <div className="text-[10px] text-notion-text-secondary mb-1">
            {t("calendar.contentType", "Content")}
          </div>
          <div className="flex gap-1 flex-wrap">
            {CONTENT_FILTERS.map((cf) => (
              <button
                key={cf.id}
                onClick={() => onContentFilterChange(cf.id)}
                className={`px-2 py-1 text-[11px] rounded-md transition-colors ${
                  contentFilter === cf.id
                    ? "bg-notion-accent/10 text-notion-accent"
                    : "text-notion-text-secondary hover:bg-notion-hover"
                }`}
              >
                {t(cf.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Folder filter */}
        <div className="px-3 mb-2">
          <div className="text-[10px] text-notion-text-secondary mb-1">
            {t("calendar.folder", "Folder")}
          </div>
          <FolderDropdown
            selectedId={filterFolderId}
            onSelect={onFilterFolderChange}
            rootLabel={t("calendar.all")}
            panelMinWidth="min-w-44"
            trigger={
              <button
                className={`flex items-center gap-1.5 px-2 py-1 text-[11px] rounded-md transition-colors w-full ${
                  filterFolderId
                    ? "bg-notion-accent/10 text-notion-accent"
                    : "text-notion-text-secondary hover:bg-notion-hover"
                }`}
              >
                <Filter size={12} />
                <span className="flex-1 text-left truncate">
                  {filterFolderId && selectedFolderName
                    ? selectedFolderName
                    : t("calendar.all")}
                </span>
                <ChevronDown size={11} />
              </button>
            }
          />
        </div>
      </div>

      {/* Mini Routine Flow */}
      <div className="px-3">
        <MiniRoutineFlow
          routines={routines}
          scheduleItems={scheduleItems}
          tagAssignments={tagAssignments}
          onToggleComplete={onToggleComplete}
        />
      </div>
    </div>
  );
}
