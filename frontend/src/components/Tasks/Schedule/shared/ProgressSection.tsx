import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TabItem } from "../../../shared/SectionTabs";
import type { DayFlowFilterTab } from "../DayFlow/OneDaySchedule";
import { DAY_FLOW_FILTER_TABS } from "../DayFlow/OneDaySchedule";
import type { CategoryProgress } from "../DayFlow/DayFlowSidebarContent";

interface ProgressSectionProps {
  date: Date;
  categoryProgress: Record<DayFlowFilterTab, CategoryProgress>;
  activeFilters: Set<DayFlowFilterTab>;
  onToggleFilter: (tab: DayFlowFilterTab) => void;
  tabs?: readonly TabItem<DayFlowFilterTab>[];
}

export function ProgressSection({
  date,
  categoryProgress,
  activeFilters,
  onToggleFilter,
  tabs,
}: ProgressSectionProps) {
  const { t } = useTranslation();

  const dateLabel = `${date.getMonth() + 1}/${date.getDate()}`;

  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-notion-text-secondary uppercase tracking-wide font-medium px-3 py-1.5">
        {t("dayFlow.sidebarProgress", "Progress")}{" "}
        <span className="normal-case">({dateLabel})</span>
      </span>
      {(tabs ?? DAY_FLOW_FILTER_TABS).map((tab) => {
        const progress = categoryProgress[tab.id];
        const isActive =
          tab.id === "all"
            ? activeFilters.size === 0
            : activeFilters.has(tab.id);
        const pct =
          progress.total > 0
            ? Math.round((progress.completed / progress.total) * 100)
            : 0;

        return (
          <button
            key={tab.id}
            onClick={() => onToggleFilter(tab.id)}
            className={`flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
              isActive ? "bg-notion-hover" : "hover:bg-notion-hover/50"
            }`}
          >
            <div
              className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                isActive
                  ? "bg-notion-accent border-notion-accent"
                  : "border-notion-border"
              }`}
            >
              {isActive && <Check size={10} className="text-white" />}
            </div>
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
  );
}
