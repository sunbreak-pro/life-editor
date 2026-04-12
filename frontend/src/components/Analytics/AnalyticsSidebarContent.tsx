import { useTranslation } from "react-i18next";
import {
  useAnalyticsFilter,
  type DatePreset,
} from "../../context/AnalyticsFilterContext";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";

const PRESETS: DatePreset[] = ["7d", "30d", "thisMonth", "3m", "all"];

const CHART_GROUPS = [
  {
    groupKey: "analytics.sidebar.chartGroup.work",
    charts: [
      { id: "workTimeChart", labelKey: "analytics.workTime" },
      { id: "taskWorkTimeChart", labelKey: "analytics.taskWorkTime" },
      { id: "workTimeHeatmap", labelKey: "analytics.heatmap.title" },
      { id: "pomodoroRate", labelKey: "analytics.pomodoroRate.title" },
      { id: "workBreakBalance", labelKey: "analytics.workBreak.title" },
      { id: "dailyTimeline", labelKey: "analytics.timeline.title" },
    ],
  },
  {
    groupKey: "analytics.sidebar.chartGroup.tasks",
    charts: [
      { id: "taskCompletionTrend", labelKey: "analytics.taskTrend.title" },
      { id: "taskStagnation", labelKey: "analytics.stagnation.title" },
      { id: "projectWorkTime", labelKey: "analytics.projectTime.title" },
    ],
  },
  {
    groupKey: "analytics.sidebar.chartGroup.schedule",
    charts: [
      {
        id: "eventCompletionTrend",
        labelKey: "analytics.schedule.eventTrend.title",
      },
      {
        id: "eventTimeDistribution",
        labelKey: "analytics.schedule.timeDistribution.title",
      },
      {
        id: "routineCompletionChart",
        labelKey: "analytics.schedule.routineCompletion.title",
      },
    ],
  },
  {
    groupKey: "analytics.sidebar.chartGroup.materials",
    charts: [
      {
        id: "noteCreationTrend",
        labelKey: "analytics.materials.creationTrend.title",
      },
      {
        id: "memoActivityHeatmap",
        labelKey: "analytics.materials.memoHeatmap.title",
      },
      { id: "notesByFolder", labelKey: "analytics.materials.byFolder.title" },
    ],
  },
  {
    groupKey: "analytics.sidebar.chartGroup.connect",
    charts: [
      { id: "tagUsageChart", labelKey: "analytics.connect.topTags.title" },
      {
        id: "tagEntityTypeChart",
        labelKey: "analytics.connect.byEntityType.title",
      },
      {
        id: "tagConnectionSummary",
        labelKey: "analytics.connect.connections.title",
      },
    ],
  },
];

const ALL_CHART_IDS = CHART_GROUPS.flatMap((g) => g.charts);

export function AnalyticsSidebarContent() {
  const { t } = useTranslation();
  const {
    dateRange,
    selectedFolderIds,
    visibleCharts,
    setDateRange,
    setSelectedFolderIds,
    toggleChart,
    setVisibleCharts,
    applyPreset,
  } = useAnalyticsFilter();
  const { nodes } = useTaskTreeContext();

  const folders = nodes.filter((n) => n.type === "folder" && !n.parentId);

  const formatDate = (d: Date) => {
    return d.toISOString().substring(0, 10);
  };

  return (
    <div className="p-3 space-y-5 text-sm">
      {/* Period presets */}
      <div>
        <h4 className="text-xs font-semibold text-notion-text-secondary uppercase tracking-wider mb-2">
          {t("analytics.sidebar.period")}
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => applyPreset(preset)}
              className="px-2.5 py-1 text-xs rounded-md bg-notion-hover text-notion-text hover:bg-notion-accent/10 hover:text-notion-accent transition-colors"
            >
              {t(`analytics.sidebar.preset.${preset}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date range */}
      <div className="border-t border-notion-border pt-4">
        <h4 className="text-xs font-semibold text-notion-text-secondary uppercase tracking-wider mb-2">
          {t("analytics.sidebar.dateRange")}
        </h4>
        <div className="space-y-2">
          <input
            type="date"
            value={formatDate(dateRange.start)}
            onChange={(e) =>
              setDateRange({
                start: new Date(e.target.value + "T00:00:00"),
                end: dateRange.end,
              })
            }
            className="w-full px-2.5 py-1.5 text-xs rounded-md border border-notion-border bg-notion-bg text-notion-text focus:outline-none focus:border-notion-accent"
          />
          <input
            type="date"
            value={formatDate(dateRange.end)}
            onChange={(e) =>
              setDateRange({
                start: dateRange.start,
                end: new Date(e.target.value + "T23:59:59"),
              })
            }
            className="w-full px-2.5 py-1.5 text-xs rounded-md border border-notion-border bg-notion-bg text-notion-text focus:outline-none focus:border-notion-accent"
          />
        </div>
      </div>

      {/* Folder filter */}
      <div className="border-t border-notion-border pt-4">
        <h4 className="text-xs font-semibold text-notion-text-secondary uppercase tracking-wider mb-2">
          {t("analytics.sidebar.folder")}
        </h4>
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedFolderIds === null}
              onChange={() => setSelectedFolderIds(null)}
              className="rounded border-notion-border text-notion-accent focus:ring-notion-accent"
            />
            <span className="text-xs text-notion-text">
              {t("analytics.sidebar.allFolders")}
            </span>
          </label>
          {folders.map((folder) => (
            <label
              key={folder.id}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={
                  selectedFolderIds === null || selectedFolderIds.has(folder.id)
                }
                onChange={() => {
                  if (selectedFolderIds === null) {
                    const newSet = new Set([folder.id]);
                    setSelectedFolderIds(newSet);
                  } else {
                    const newSet = new Set(selectedFolderIds);
                    if (newSet.has(folder.id)) {
                      newSet.delete(folder.id);
                      if (newSet.size === 0) {
                        setSelectedFolderIds(null);
                      } else {
                        setSelectedFolderIds(newSet);
                      }
                    } else {
                      newSet.add(folder.id);
                      if (newSet.size === folders.length) {
                        setSelectedFolderIds(null);
                      } else {
                        setSelectedFolderIds(newSet);
                      }
                    }
                  }
                }}
                className="rounded border-notion-border text-notion-accent focus:ring-notion-accent"
              />
              <span className="text-xs text-notion-text truncate">
                {folder.title || folder.id}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Chart toggles */}
      <div className="border-t border-notion-border pt-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-notion-text-secondary uppercase tracking-wider">
            {t("analytics.sidebar.charts")}
          </h4>
          <div className="flex gap-2">
            <button
              onClick={() =>
                setVisibleCharts(new Set(ALL_CHART_IDS.map((c) => c.id)))
              }
              className="text-[10px] text-notion-accent hover:underline"
            >
              {t("analytics.sidebar.showAll")}
            </button>
            <button
              onClick={() => setVisibleCharts(new Set())}
              className="text-[10px] text-notion-text-secondary hover:underline"
            >
              {t("analytics.sidebar.hideAll")}
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {CHART_GROUPS.map((group) => (
            <div key={group.groupKey}>
              <p className="text-[10px] font-medium text-notion-text-secondary mb-1">
                {t(group.groupKey)}
              </p>
              <div className="space-y-1">
                {group.charts.map((chart) => (
                  <label
                    key={chart.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={visibleCharts.has(chart.id)}
                      onChange={() => toggleChart(chart.id)}
                      className="rounded border-notion-border text-notion-accent focus:ring-notion-accent"
                    />
                    <span className="text-xs text-notion-text">
                      {t(chart.labelKey)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
