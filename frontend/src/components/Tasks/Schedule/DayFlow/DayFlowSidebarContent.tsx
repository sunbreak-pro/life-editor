import type { DayFlowFilterTab } from "./OneDaySchedule";
import type { TabItem } from "../../../shared/SectionTabs";
import { ProgressSection } from "../shared/ProgressSection";

export interface CategoryProgress {
  completed: number;
  total: number;
}

interface DayFlowSidebarContentProps {
  date: Date;
  activeFilter: DayFlowFilterTab;
  onFilterChange: (tab: DayFlowFilterTab) => void;
  categoryProgress: Record<DayFlowFilterTab, CategoryProgress>;
  tabs?: readonly TabItem<DayFlowFilterTab>[];
}

export function DayFlowSidebarContent({
  date,
  activeFilter,
  onFilterChange,
  categoryProgress,
  tabs,
}: DayFlowSidebarContentProps) {
  return (
    <div className="flex flex-col gap-3">
      <ProgressSection
        date={date}
        categoryProgress={categoryProgress}
        activeFilter={activeFilter}
        onFilterChange={onFilterChange}
        tabs={tabs}
      />
    </div>
  );
}
