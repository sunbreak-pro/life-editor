import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DayFlowFilterTab } from "./OneDaySchedule";
import { DAY_FLOW_FILTER_TABS } from "./OneDaySchedule";
import { AchievementPanel } from "../Routine/AchievementPanel";
import { AchievementDetailsOverlay } from "../Routine/AchievementDetailsOverlay";
import type { RoutineStats } from "../../../../types/schedule";

export interface CategoryProgress {
  completed: number;
  total: number;
}

interface DayFlowSidebarContentProps {
  activeFilter: DayFlowFilterTab;
  onFilterChange: (tab: DayFlowFilterTab) => void;
  categoryProgress: Record<DayFlowFilterTab, CategoryProgress>;
  routineStats: RoutineStats | null;
}

export function DayFlowSidebarContent({
  activeFilter,
  onFilterChange,
  categoryProgress,
  routineStats,
}: DayFlowSidebarContentProps) {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {/* Category progress list */}
      <div className="flex flex-col">
        <span className="text-[10px] text-notion-text-secondary uppercase tracking-wide font-medium px-3 py-1.5">
          {t("dayFlow.sidebarProgress", "Progress")}
        </span>
        {DAY_FLOW_FILTER_TABS.map((tab) => {
          const progress = categoryProgress[tab.id];
          const isActive = activeFilter === tab.id;
          const pct =
            progress.total > 0
              ? Math.round((progress.completed / progress.total) * 100)
              : 0;

          return (
            <button
              key={tab.id}
              onClick={() => onFilterChange(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                isActive
                  ? "bg-notion-hover border-l-2 border-l-notion-accent"
                  : "hover:bg-notion-hover/50 border-l-2 border-l-transparent"
              }`}
            >
              <span
                className={`flex-1 text-xs ${
                  isActive
                    ? "text-notion-text font-medium"
                    : "text-notion-text-secondary"
                }`}
              >
                {t(tab.labelKey)}
              </span>
              <span
                className={`text-[11px] tabular-nums ${
                  isActive ? "text-notion-text" : "text-notion-text-secondary"
                }`}
              >
                {progress.completed}/{progress.total}
              </span>
              {/* Mini progress bar */}
              <div className="w-10 h-1 bg-notion-hover rounded-full overflow-hidden">
                <div
                  className="h-full bg-notion-accent rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Achievement panel */}
      {routineStats && (
        <div className="px-3">
          <AchievementPanel
            stats={routineStats}
            onShowDetails={() => setShowDetails(true)}
          />
        </div>
      )}

      {showDetails && routineStats && (
        <AchievementDetailsOverlay
          stats={routineStats}
          onClose={() => setShowDetails(false)}
        />
      )}
    </div>
  );
}
