import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Columns2,
  Square,
} from "lucide-react";
import { formatDayFlowDate } from "../../../../utils/dateKey";
import { useClickOutside } from "../../../../hooks/useClickOutside";
import { getTextColorForBg } from "../../../../constants/folderColors";
import type { DayFlowFilterTab } from "./OneDaySchedule";
import { DAY_FLOW_FILTER_TABS } from "./OneDaySchedule";
import type { RoutineTag } from "../../../../types/routineTag";
import type { RoutineGroup } from "../../../../types/routineGroup";

interface CompactDateNavProps {
  date: Date;
  isToday: boolean;
  onPrevDate: () => void;
  onNextDate: () => void;
  onToday: () => void;
  filterTab: DayFlowFilterTab;
  onFilterTabChange: (tab: DayFlowFilterTab) => void;
  selectedFilterTagIds: number[];
  onSelectedFilterTagIdsChange: (ids: number[]) => void;
  routineTags: RoutineTag[];
  isDualColumn?: boolean;
  onToggleDualColumn?: () => void;
  routineGroups?: RoutineGroup[];
  selectedFilterGroupIds?: string[];
  onSelectedFilterGroupIdsChange?: (ids: string[]) => void;
}

export function CompactDateNav({
  date,
  isToday,
  onPrevDate,
  onNextDate,
  onToday,
  filterTab,
  onFilterTabChange,
  selectedFilterTagIds,
  onSelectedFilterTagIdsChange,
  routineTags,
  isDualColumn,
  onToggleDualColumn,
  routineGroups,
  selectedFilterGroupIds,
  onSelectedFilterGroupIdsChange,
}: CompactDateNavProps) {
  const { t, i18n } = useTranslation();
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  useClickOutside(
    filterDropdownRef,
    () => setShowFilterDropdown(false),
    showFilterDropdown,
  );

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-notion-border">
      <button
        onClick={onPrevDate}
        className="p-0.5 text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover rounded transition-colors"
      >
        <ChevronLeft size={14} />
      </button>
      <span className="text-xs font-medium text-notion-text min-w-16 text-center">
        {formatDayFlowDate(date, i18n.language)}
      </span>
      <button
        onClick={onNextDate}
        className="p-0.5 text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover rounded transition-colors"
      >
        <ChevronRight size={14} />
      </button>
      {!isToday && (
        <button
          onClick={onToday}
          className="px-1.5 py-0.5 text-[9px] font-medium text-notion-accent border border-notion-accent/30 rounded hover:bg-notion-accent/10 transition-colors"
        >
          {t("calendarHeader.today", "Today")}
        </button>
      )}
      <div className="relative ml-auto" ref={filterDropdownRef}>
        <button
          onClick={() => setShowFilterDropdown((v) => !v)}
          className={`p-1 rounded-md transition-colors ${
            filterTab !== "all"
              ? "text-notion-accent bg-notion-accent/10"
              : "text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
          }`}
        >
          <Filter size={12} />
        </button>
        {showFilterDropdown && (
          <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-notion-bg border border-notion-border rounded-lg shadow-xl py-1">
            {DAY_FLOW_FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  onFilterTabChange(tab.id);
                  if (tab.id !== "all" && tab.id !== "routine") {
                    onSelectedFilterTagIdsChange([]);
                  }
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
                  filterTab === tab.id
                    ? "text-notion-accent bg-notion-accent/5"
                    : "text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    filterTab === tab.id ? "bg-notion-accent" : "bg-transparent"
                  }`}
                />
                {t(tab.labelKey)}
              </button>
            ))}
            {(filterTab === "all" || filterTab === "routine") &&
              routineTags.length > 0 && (
                <>
                  <div className="border-t border-notion-border my-1" />
                  <div className="flex items-center gap-1 flex-wrap px-3 py-1.5">
                    <button
                      onClick={() => onSelectedFilterTagIdsChange([])}
                      className={`text-[10px] px-1.5 py-0.5 rounded-full transition-colors ${
                        selectedFilterTagIds.length === 0
                          ? "bg-notion-text text-notion-bg"
                          : "bg-notion-hover text-notion-text-secondary hover:text-notion-text"
                      }`}
                    >
                      All
                    </button>
                    {routineTags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() =>
                          onSelectedFilterTagIdsChange(
                            selectedFilterTagIds.includes(tag.id)
                              ? selectedFilterTagIds.filter(
                                  (id) => id !== tag.id,
                                )
                              : [...selectedFilterTagIds, tag.id],
                          )
                        }
                        className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full transition-colors ${
                          selectedFilterTagIds.includes(tag.id)
                            ? "ring-1 ring-notion-text"
                            : "hover:opacity-80"
                        }`}
                        style={{
                          backgroundColor: tag.color + "E6",
                          color: getTextColorForBg(tag.color),
                          fontWeight: "bold",
                        }}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            {/* Group filter pills */}
            {(filterTab === "all" || filterTab === "routine") &&
              routineGroups &&
              routineGroups.length > 0 &&
              onSelectedFilterGroupIdsChange && (
                <>
                  <div className="border-t border-notion-border my-1" />
                  <div className="flex items-center gap-1 flex-wrap px-3 py-1.5">
                    <span className="text-[9px] text-notion-text-secondary mr-1">
                      {t("routineGroup.groups", "Groups")}
                    </span>
                    {routineGroups.map((group) => (
                      <button
                        key={group.id}
                        onClick={() =>
                          onSelectedFilterGroupIdsChange(
                            (selectedFilterGroupIds ?? []).includes(group.id)
                              ? (selectedFilterGroupIds ?? []).filter(
                                  (id) => id !== group.id,
                                )
                              : [...(selectedFilterGroupIds ?? []), group.id],
                          )
                        }
                        className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full transition-colors ${
                          (selectedFilterGroupIds ?? []).includes(group.id)
                            ? "ring-1 ring-notion-text"
                            : "hover:opacity-80"
                        }`}
                        style={{
                          backgroundColor: group.color + "30",
                          color: group.color,
                          fontWeight: "bold",
                        }}
                      >
                        <span
                          className="w-2 h-2 rounded"
                          style={{ backgroundColor: group.color }}
                        />
                        {group.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
          </div>
        )}
      </div>
      {onToggleDualColumn && (
        <button
          onClick={onToggleDualColumn}
          className={`p-1 rounded-md transition-colors ${
            isDualColumn
              ? "text-notion-accent bg-notion-accent/10"
              : "text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
          }`}
          title={t(
            isDualColumn ? "dayFlow.singleColumn" : "dayFlow.dualColumn",
          )}
        >
          {isDualColumn ? <Square size={12} /> : <Columns2 size={12} />}
        </button>
      )}
    </div>
  );
}
