import { useState, useEffect, useMemo, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoutineStats, ScheduleItem } from "../../../../types/schedule";
import type { RoutineGroup } from "../../../../types/routineGroup";
import { formatDateKey, formatDayFlowDate } from "../../../../utils/dateKey";
import { getDataService } from "../../../../services";

interface AchievementDetailsOverlayProps {
  stats: RoutineStats;
  onClose: () => void;
  groupForRoutine: Map<string, RoutineGroup>;
  routineGroups: RoutineGroup[];
}

function getHeatmapColor(rate: number): string {
  if (rate <= 0) return "bg-notion-hover";
  if (rate < 0.25) return "bg-green-900/30";
  if (rate < 0.5) return "bg-green-700/40";
  if (rate < 0.75) return "bg-green-600/50";
  return "bg-green-500/60";
}

function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

const JA_WEEKDAYS_SHORT = ["日", "月", "火", "水", "木", "金", "土"];
const EN_WEEKDAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function CompactBar({
  title,
  rate,
  color,
}: {
  title: string;
  rate: number;
  color?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-notion-text truncate">{title}</span>
        <span className="text-[10px] text-notion-text-secondary ml-2 shrink-0">
          {rate}%
        </span>
      </div>
      <div className="h-1 bg-notion-hover rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${rate}%`,
            backgroundColor: color ?? "#22c55e",
          }}
        />
      </div>
    </div>
  );
}

export function AchievementDetailsOverlay({
  stats,
  onClose,
  groupForRoutine,
  routineGroups,
}: AchievementDetailsOverlayProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const isJa = locale.startsWith("ja");

  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(formatDateKey(today));
  const [selectedDayItems, setSelectedDayItems] = useState<ScheduleItem[]>([]);
  const [heatmapData, setHeatmapData] = useState<Map<string, number>>(
    new Map(),
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroupExpand = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const { individualRates, groupRates } = useMemo(() => {
    const individualRates: RoutineStats["perRoutineRates"] = [];
    const groupMap = new Map<
      string,
      {
        group: RoutineGroup;
        routineRates: RoutineStats["perRoutineRates"];
        completedCount: number;
        totalCount: number;
      }
    >();

    for (const g of routineGroups) {
      groupMap.set(g.id, {
        group: g,
        routineRates: [],
        completedCount: 0,
        totalCount: 0,
      });
    }

    for (const rate of stats.perRoutineRates) {
      const group = groupForRoutine.get(rate.routineId);
      if (group) {
        const entry = groupMap.get(group.id);
        if (entry) {
          entry.routineRates.push(rate);
          entry.completedCount += rate.completedCount;
          entry.totalCount += rate.totalCount;
        }
      } else {
        individualRates.push(rate);
      }
    }

    const groupRates = [...groupMap.values()]
      .filter((e) => e.routineRates.length > 0)
      .map((e) => ({
        ...e,
        completionRate:
          e.totalCount > 0
            ? Math.round((e.completedCount / e.totalCount) * 100)
            : 0,
      }));

    return { individualRates, groupRates };
  }, [stats.perRoutineRates, groupForRoutine, routineGroups]);

  // Initialize heatmap from stats.monthlyHeatmap (90 days)
  useEffect(() => {
    const map = new Map<string, number>();
    for (const entry of stats.monthlyHeatmap) {
      map.set(entry.date, entry.completionRate);
    }
    setHeatmapData(map);
  }, [stats.monthlyHeatmap]);

  // Load additional heatmap data when navigating outside 90-day range
  useEffect(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const rangeStart = formatDateKey(firstDay);
    const rangeEnd = formatDateKey(lastDay);

    // Check if we need to fetch additional data
    const needsFetch = !heatmapData.has(rangeStart);
    if (needsFetch) {
      getDataService()
        .fetchScheduleItemsByDateRange(rangeStart, rangeEnd)
        .then((items) => {
          const dayMap = new Map<
            string,
            { completed: number; total: number }
          >();
          for (const item of items) {
            if (!item.routineId) continue;
            const entry = dayMap.get(item.date) ?? { completed: 0, total: 0 };
            entry.total++;
            if (item.completed) entry.completed++;
            dayMap.set(item.date, entry);
          }
          setHeatmapData((prev) => {
            const next = new Map(prev);
            for (const [date, { completed, total }] of dayMap) {
              next.set(date, total > 0 ? completed / total : 0);
            }
            return next;
          });
        })
        .catch(() => {});
    }
  }, [viewYear, viewMonth, heatmapData]);

  // Load selected day items
  useEffect(() => {
    getDataService()
      .fetchScheduleItemsByDate(selectedDate)
      .then((items) => {
        setSelectedDayItems(
          items
            .filter((i) => i.routineId)
            .sort((a, b) => a.startTime.localeCompare(b.startTime)),
        );
      })
      .catch(() => {});
  }, [selectedDate]);

  const goToPrevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const monthDays = useMemo(
    () => getMonthDays(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const firstDayOfWeek = monthDays[0]?.getDay() ?? 0;

  const weekdayLabels = isJa ? JA_WEEKDAYS_SHORT : EN_WEEKDAYS_SHORT;

  const monthLabel = isJa
    ? `${viewYear}年${viewMonth + 1}月`
    : new Date(viewYear, viewMonth).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      });

  const selectedDateObj = useMemo(
    () => new Date(selectedDate + "T00:00:00"),
    [selectedDate],
  );

  const completedItems = selectedDayItems.filter((i) => i.completed);
  const incompleteItems = selectedDayItems.filter((i) => !i.completed);
  const totalItems = selectedDayItems.length;
  const completedCount = completedItems.length;
  const rate =
    totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-notion-bg border border-notion-border rounded-xl shadow-xl w-[640px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-notion-border">
          <span className="text-base font-medium text-notion-text">
            {t("schedule.achievementDetails", "Achievement Details")}
          </span>
          <button
            onClick={onClose}
            className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {/* 2-column: Calendar + Day detail */}
          <div className="flex gap-4">
            {/* Left: Calendar heatmap */}
            <div className="w-1/2">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={goToPrevMonth}
                  className="p-0.5 text-notion-text-secondary hover:text-notion-text transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-medium text-notion-text">
                  {monthLabel}
                </span>
                <button
                  onClick={goToNextMonth}
                  className="p-0.5 text-notion-text-secondary hover:text-notion-text transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {weekdayLabels.map((label) => (
                  <div
                    key={label}
                    className="text-center text-[10px] text-notion-text-secondary"
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1">
                {/* Empty cells for first week offset */}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}
                {monthDays.map((day) => {
                  const key = formatDateKey(day);
                  const heatRate = heatmapData.get(key) ?? 0;
                  const isSelected = key === selectedDate;
                  const isToday = key === formatDateKey(today);
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedDate(key)}
                      className={`aspect-square rounded-md flex items-center justify-center text-[11px] transition-all ${getHeatmapColor(
                        heatRate,
                      )} ${isSelected ? "ring-1.5 ring-accent-primary" : ""} ${
                        isToday
                          ? "font-bold text-notion-text"
                          : "text-notion-text-secondary"
                      } hover:ring-1 hover:ring-notion-border`}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Selected day details */}
            <div className="w-1/2">
              <div className="text-sm font-medium text-notion-text mb-3">
                {formatDayFlowDate(selectedDateObj, locale)}
              </div>

              {totalItems === 0 ? (
                <p className="text-[11px] text-notion-text-secondary">
                  {t(
                    "schedule.noRoutineItems",
                    "No routine items for this day.",
                  )}
                </p>
              ) : (
                <>
                  {/* Completed items */}
                  {completedItems.length > 0 && (
                    <div className="mb-3">
                      <div className="text-[11px] text-notion-text-secondary uppercase tracking-wide mb-1">
                        {t("schedule.achieved", "Achieved")}
                      </div>
                      <div className="space-y-1">
                        {completedItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 px-2 py-1 rounded-md bg-green-500/10"
                          >
                            <span className="text-green-500 text-sm">
                              &#10003;
                            </span>
                            <span className="flex-1 text-xs text-notion-text-secondary truncate">
                              {item.title}
                            </span>
                            <span className="text-[11px] text-notion-text-secondary">
                              {item.startTime}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Incomplete items */}
                  {incompleteItems.length > 0 && (
                    <div className="mb-3">
                      <div className="text-[11px] text-notion-text-secondary uppercase tracking-wide mb-1">
                        {t("schedule.notAchieved", "Not Achieved")}
                      </div>
                      <div className="space-y-1">
                        {incompleteItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 px-2 py-1 rounded-md"
                          >
                            <span className="text-notion-text-secondary text-sm">
                              &#10007;
                            </span>
                            <span className="flex-1 text-xs text-notion-text truncate">
                              {item.title}
                            </span>
                            <span className="text-[11px] text-notion-text-secondary">
                              {item.startTime}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="text-xs text-notion-text-secondary mt-2">
                    {t(
                      "schedule.achievementRate",
                      "Achieved: {{completed}}/{{total}} ({{rate}}%)",
                      {
                        completed: completedCount,
                        total: totalItems,
                        rate,
                      },
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Per-routine rates: 2-column layout */}
          {stats.perRoutineRates.length > 0 && (
            <div className="mt-4 pt-3 border-t border-notion-border">
              {individualRates.length > 0 && groupRates.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {/* Individual column */}
                  <div>
                    <div className="text-[11px] text-notion-text-secondary uppercase tracking-wide mb-2">
                      {t("schedule.stats.individual", "Individual")}
                    </div>
                    <div className="space-y-1.5">
                      {individualRates.map((r) => (
                        <CompactBar
                          key={r.routineId}
                          title={r.routineTitle}
                          rate={r.completionRate}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Groups column */}
                  <div>
                    <div className="text-[11px] text-notion-text-secondary uppercase tracking-wide mb-2">
                      {t("schedule.stats.groups", "Groups")}
                    </div>
                    <div className="space-y-1.5">
                      {groupRates.map((g) => (
                        <div key={g.group.id}>
                          <button
                            onClick={() => toggleGroupExpand(g.group.id)}
                            className="w-full text-left"
                          >
                            <div className="flex items-center gap-1.5">
                              <ChevronRight
                                size={10}
                                className={`text-notion-text-secondary shrink-0 transition-transform ${expandedGroups.has(g.group.id) ? "rotate-90" : ""}`}
                              />
                              <span
                                className="w-2 h-2 rounded shrink-0"
                                style={{ backgroundColor: g.group.color }}
                              />
                              <span className="text-[11px] text-notion-text truncate">
                                {g.group.name}
                              </span>
                              <span className="text-[10px] text-notion-text-secondary ml-auto shrink-0">
                                {g.completionRate}%
                              </span>
                            </div>
                            <div className="h-1 bg-notion-hover rounded-full overflow-hidden mt-0.5">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${g.completionRate}%`,
                                  backgroundColor: g.group.color,
                                }}
                              />
                            </div>
                          </button>
                          {expandedGroups.has(g.group.id) && (
                            <div className="ml-4 mt-1 space-y-1">
                              {g.routineRates.map((r) => (
                                <CompactBar
                                  key={r.routineId}
                                  title={r.routineTitle}
                                  rate={r.completionRate}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : individualRates.length > 0 ? (
                <div>
                  <div className="text-[11px] text-notion-text-secondary uppercase tracking-wide mb-2">
                    {t("schedule.stats.perRoutine", "Per Routine")}
                  </div>
                  <div className="space-y-1.5">
                    {individualRates.map((r) => (
                      <CompactBar
                        key={r.routineId}
                        title={r.routineTitle}
                        rate={r.completionRate}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-[11px] text-notion-text-secondary uppercase tracking-wide mb-2">
                    {t("schedule.stats.groups", "Groups")}
                  </div>
                  <div className="space-y-1.5">
                    {groupRates.map((g) => (
                      <div key={g.group.id}>
                        <button
                          onClick={() => toggleGroupExpand(g.group.id)}
                          className="w-full text-left"
                        >
                          <div className="flex items-center gap-1.5">
                            <ChevronRight
                              size={10}
                              className={`text-notion-text-secondary shrink-0 transition-transform ${expandedGroups.has(g.group.id) ? "rotate-90" : ""}`}
                            />
                            <span
                              className="w-2 h-2 rounded shrink-0"
                              style={{ backgroundColor: g.group.color }}
                            />
                            <span className="text-[11px] text-notion-text truncate">
                              {g.group.name}
                            </span>
                            <span className="text-[10px] text-notion-text-secondary ml-auto shrink-0">
                              {g.completionRate}%
                            </span>
                          </div>
                          <div className="h-1 bg-notion-hover rounded-full overflow-hidden mt-0.5">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${g.completionRate}%`,
                                backgroundColor: g.group.color,
                              }}
                            />
                          </div>
                        </button>
                        {expandedGroups.has(g.group.id) && (
                          <div className="ml-4 mt-1 space-y-1">
                            {g.routineRates.map((r) => (
                              <CompactBar
                                key={r.routineId}
                                title={r.routineTitle}
                                rate={r.completionRate}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
