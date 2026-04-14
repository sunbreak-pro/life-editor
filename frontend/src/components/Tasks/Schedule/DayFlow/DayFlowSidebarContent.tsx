import type { DayFlowFilterTab } from "./OneDaySchedule";
import type { TabItem } from "../../../shared/SectionTabs";
import { ProgressSection } from "../shared/ProgressSection";

export interface CategoryProgress {
  completed: number;
  total: number;
}

interface DayFlowSidebarContentProps {
  date: Date;
  activeFilters: Set<DayFlowFilterTab>;
  onToggleFilter: (tab: DayFlowFilterTab) => void;
  categoryProgress: Record<DayFlowFilterTab, CategoryProgress>;
  tabs?: readonly TabItem<DayFlowFilterTab>[];
  onReorderTabs?: (newOrder: DayFlowFilterTab[]) => void;
}

export function DayFlowSidebarContent({
  date,
  activeFilters,
  onToggleFilter,
  categoryProgress,
  tabs,
  onReorderTabs,
}: DayFlowSidebarContentProps) {
  return (
    <div className="flex flex-col gap-3">
      <ProgressSection
        date={date}
        categoryProgress={categoryProgress}
        activeFilters={activeFilters}
        onToggleFilter={onToggleFilter}
        tabs={tabs}
        onReorderTabs={onReorderTabs}
      />
    </div>
  );
}
