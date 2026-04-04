import {
  createContext,
  useContext,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import type { Period } from "../components/Analytics/PeriodSelector";

interface DateRange {
  start: Date;
  end: Date;
}

interface AnalyticsFilterState {
  dateRange: DateRange;
  selectedFolderIds: Set<string> | null; // null = all
  period: Period;
  visibleCharts: Set<string>;
}

interface AnalyticsFilterContextValue extends AnalyticsFilterState {
  setDateRange: (range: DateRange) => void;
  setSelectedFolderIds: (ids: Set<string> | null) => void;
  setPeriod: (period: Period) => void;
  setVisibleCharts: (charts: Set<string>) => void;
  toggleChart: (chartId: string) => void;
  applyPreset: (preset: DatePreset) => void;
}

export type DatePreset = "7d" | "30d" | "thisMonth" | "3m" | "all";

const DEFAULT_CHARTS = new Set([
  "workTimeChart",
  "taskWorkTimeChart",
  "workTimeHeatmap",
  "pomodoroRate",
  "workBreakBalance",
  "dailyTimeline",
  "taskCompletionTrend",
  "taskStagnation",
  "projectWorkTime",
]);

function getPresetRange(preset: DatePreset): DateRange {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  switch (preset) {
    case "7d":
      start.setDate(start.getDate() - 6);
      break;
    case "30d":
      start.setDate(start.getDate() - 29);
      break;
    case "thisMonth":
      start.setDate(1);
      break;
    case "3m":
      start.setMonth(start.getMonth() - 3);
      start.setDate(1);
      break;
    case "all":
      start.setFullYear(2020, 0, 1);
      break;
  }
  return { start, end };
}

const AnalyticsFilterContext =
  createContext<AnalyticsFilterContextValue | null>(null);

export function AnalyticsFilterProvider({ children }: { children: ReactNode }) {
  const [dateRange, setDateRange] = useState<DateRange>(() =>
    getPresetRange("30d"),
  );
  const [selectedFolderIds, setSelectedFolderIds] =
    useState<Set<string> | null>(null);
  const [period, setPeriod] = useState<Period>("day");
  const [visibleCharts, setVisibleCharts] = useState<Set<string>>(
    () => new Set(DEFAULT_CHARTS),
  );

  const toggleChart = (chartId: string) => {
    setVisibleCharts((prev) => {
      const next = new Set(prev);
      if (next.has(chartId)) {
        next.delete(chartId);
      } else {
        next.add(chartId);
      }
      return next;
    });
  };

  const applyPreset = (preset: DatePreset) => {
    setDateRange(getPresetRange(preset));
  };

  const value = useMemo<AnalyticsFilterContextValue>(
    () => ({
      dateRange,
      selectedFolderIds,
      period,
      visibleCharts,
      setDateRange,
      setSelectedFolderIds,
      setPeriod,
      setVisibleCharts,
      toggleChart,
      applyPreset,
    }),
    [dateRange, selectedFolderIds, period, visibleCharts],
  );

  return (
    <AnalyticsFilterContext.Provider value={value}>
      {children}
    </AnalyticsFilterContext.Provider>
  );
}

export function useAnalyticsFilter(): AnalyticsFilterContextValue {
  const ctx = useContext(AnalyticsFilterContext);
  if (!ctx) {
    throw new Error(
      "useAnalyticsFilter must be used within AnalyticsFilterProvider",
    );
  }
  return ctx;
}
