import {
  createContext,
  useContext,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import type { Period } from "./PeriodSelector";

/*
 * Analytics UI-state context (W4 · lean). Holds the period (day/week/month)
 * and date-range preset selection only — pure presentation state, so it is
 * allowed to live in shared (same tier as ThemeContext, see plan §重要な設計
 * 判断 5). The frontend version also tracked `visibleCharts` (per-chart toggle)
 * and `selectedFolderIds`; the lean port renders every chart and drops both.
 *
 * INTERNAL to the Analytics feature: AnalyticsView wraps its tabs in the
 * provider; it is NOT re-exported from the global components barrel.
 */

export interface DateRange {
  start: Date;
  end: Date;
}

export type DatePreset = "7d" | "30d" | "thisMonth" | "3m" | "all";

interface AnalyticsFilterContextValue {
  dateRange: DateRange;
  period: Period;
  setPeriod: (period: Period) => void;
  setDateRange: (range: DateRange) => void;
  applyPreset: (preset: DatePreset) => void;
}

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

export function AnalyticsFilterProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [dateRange, setDateRange] = useState<DateRange>(() =>
    getPresetRange("30d"),
  );
  const [period, setPeriod] = useState<Period>("day");

  const applyPreset = (preset: DatePreset): void => {
    setDateRange(getPresetRange(preset));
  };

  const value = useMemo<AnalyticsFilterContextValue>(
    () => ({
      dateRange,
      period,
      setPeriod,
      setDateRange,
      applyPreset,
    }),
    [dateRange, period],
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
