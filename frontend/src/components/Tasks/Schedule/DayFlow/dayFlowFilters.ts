import type { TabItem } from "../../../shared/SectionTabs";

export type DayFlowFilterTab =
  | "all"
  | "routine"
  | "tasks"
  | "events"
  | "daily"
  | "notes";

export const DAY_FLOW_FILTER_TABS: readonly TabItem<DayFlowFilterTab>[] = [
  { id: "all", labelKey: "dayFlow.filterAll" },
  { id: "routine", labelKey: "dayFlow.filterRoutine" },
  { id: "tasks", labelKey: "dayFlow.filterTasks" },
  { id: "events", labelKey: "dayFlow.filterEvents" },
];
