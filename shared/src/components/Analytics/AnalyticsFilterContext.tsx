import {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
  useRef,
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
  /** The active preset (drives the header pill group's checked state). */
  preset: DatePreset;
  period: Period;
  setPeriod: (period: Period) => void;
  setDateRange: (range: DateRange) => void;
  applyPreset: (preset: DatePreset) => void;
}

const DEFAULT_PRESET: DatePreset = "30d";

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
  onDateRangeChange,
}: {
  children: ReactNode;
  /**
   * Fired whenever the selected date range changes, including the initial
   * mount (with the default preset). Hosts use this to fetch schedule items
   * for exactly this window (per-range fetch) instead of loading all history.
   * The range stays owned HERE (single source of truth); the host only mirrors
   * it into a fetch, so the in-memory filter in ScheduleTab still holds.
   */
  onDateRangeChange?: (range: DateRange) => void;
}): React.JSX.Element {
  const [dateRange, setDateRange] = useState<DateRange>(() =>
    getPresetRange(DEFAULT_PRESET),
  );
  const [preset, setPreset] = useState<DatePreset>(DEFAULT_PRESET);
  const [period, setPeriod] = useState<Period>("day");

  // Latest-callback ref so an unmemoized host callback never causes a spurious
  // re-fire: the notify effect depends only on `dateRange`, but always calls
  // the current callback.
  const onDateRangeChangeRef = useRef(onDateRangeChange);
  useEffect(() => {
    onDateRangeChangeRef.current = onDateRangeChange;
  });
  useEffect(() => {
    onDateRangeChangeRef.current?.(dateRange);
  }, [dateRange]);

  const applyPreset = (next: DatePreset): void => {
    setPreset(next);
    setDateRange(getPresetRange(next));
  };

  const value = useMemo<AnalyticsFilterContextValue>(
    () => ({
      dateRange,
      preset,
      period,
      setPeriod,
      setDateRange,
      applyPreset,
    }),
    [dateRange, preset, period],
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
