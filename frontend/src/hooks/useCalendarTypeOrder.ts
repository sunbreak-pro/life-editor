import { useCallback, useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { STORAGE_KEYS } from "../constants/storageKeys";
import type { DayFlowFilterTab } from "../components/Tasks/Schedule/DayFlow/OneDaySchedule";
import type { TabItem } from "../components/shared/SectionTabs";

const DEFAULT_ORDER: DayFlowFilterTab[] = [
  "routine",
  "tasks",
  "events",
  "daily",
  "notes",
];

export function useCalendarTypeOrder() {
  const [typeOrder, setTypeOrder] = useLocalStorage<DayFlowFilterTab[]>(
    STORAGE_KEYS.CALENDAR_TYPE_ORDER,
    DEFAULT_ORDER,
  );

  const getTabsInOrder = useCallback(
    (
      baseTabs: readonly TabItem<DayFlowFilterTab>[],
    ): TabItem<DayFlowFilterTab>[] => {
      const allTab = baseTabs.find((t) => t.id === "all");
      const rest = baseTabs.filter((t) => t.id !== "all");

      // Sort rest by position in typeOrder
      const sorted = [...rest].sort((a, b) => {
        const ai = typeOrder.indexOf(a.id);
        const bi = typeOrder.indexOf(b.id);
        // Items not in typeOrder go to end
        const posA = ai === -1 ? Infinity : ai;
        const posB = bi === -1 ? Infinity : bi;
        return posA - posB;
      });

      return allTab ? [allTab, ...sorted] : sorted;
    },
    [typeOrder],
  );

  const reorderTabs = useCallback(
    (newOrder: DayFlowFilterTab[]) => {
      setTypeOrder(newOrder);
    },
    [setTypeOrder],
  );

  return useMemo(
    () => ({ typeOrder, reorderTabs, getTabsInOrder }),
    [typeOrder, reorderTabs, getTabsInOrder],
  );
}
