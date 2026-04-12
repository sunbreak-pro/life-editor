import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { LAYOUT } from "../../constants/layout";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";
import { getDataService } from "../../services";
import { RightSidebarContext } from "../../context/RightSidebarContext";
import { AnalyticsFilterProvider } from "../../context/AnalyticsFilterContext";
import type { TimerSession } from "../../types/timer";
import type { TabItem } from "../shared/SectionTabs";
import { SectionHeader } from "../shared/SectionHeader";
import { OverviewTab } from "./OverviewTab";
import { TimeTab } from "./TimeTab";
import { TasksTab } from "./TasksTab";
import { ScheduleTab } from "./ScheduleTab";
import { MaterialsTab } from "./MaterialsTab";
import { ConnectTab } from "./ConnectTab";
import { AnalyticsSidebarContent } from "./AnalyticsSidebarContent";

type AnalyticsTab =
  | "overview"
  | "tasks"
  | "schedule"
  | "materials"
  | "work"
  | "connect";

const ANALYTICS_TABS: readonly TabItem<AnalyticsTab>[] = [
  { id: "overview", labelKey: "analytics.tabs.overview" },
  { id: "tasks", labelKey: "analytics.tabs.tasks" },
  { id: "schedule", labelKey: "analytics.tabs.schedule" },
  { id: "materials", labelKey: "analytics.tabs.materials" },
  { id: "work", labelKey: "analytics.tabs.work" },
  { id: "connect", labelKey: "analytics.tabs.connect" },
];

export function AnalyticsView() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("overview");
  const { nodes } = useTaskTreeContext();
  const [sessions, setSessions] = useState<TimerSession[]>([]);
  const { portalTarget: rightSidebarTarget } = useContext(RightSidebarContext);

  useEffect(() => {
    getDataService().fetchTimerSessions().then(setSessions);
  }, []);

  const taskNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of nodes) {
      map.set(n.id, n.title || n.id);
    }
    return map;
  }, [nodes]);

  // Defer tab content rendering by 1 frame so ResponsiveContainer
  // can measure a laid-out parent instead of getting -1 dimensions.
  const [readyTab, setReadyTab] = useState<AnalyticsTab | null>(null);
  const rafRef = useRef(0);
  useEffect(() => {
    setReadyTab(null);
    rafRef.current = requestAnimationFrame(() => setReadyTab(activeTab));
    return () => cancelAnimationFrame(rafRef.current);
  }, [activeTab]);

  const renderTab = () => {
    if (readyTab !== activeTab) return null;
    switch (activeTab) {
      case "overview":
        return <OverviewTab sessions={sessions} nodes={nodes} />;
      case "tasks":
        return <TasksTab sessions={sessions} nodes={nodes} />;
      case "schedule":
        return <ScheduleTab />;
      case "materials":
        return <MaterialsTab />;
      case "work":
        return <TimeTab sessions={sessions} taskNameMap={taskNameMap} />;
      case "connect":
        return <ConnectTab />;
    }
  };

  return (
    <AnalyticsFilterProvider>
      <div
        className={`h-full flex flex-col ${LAYOUT.CONTENT_PX} ${LAYOUT.CONTENT_PT} ${LAYOUT.CONTENT_PB}`}
      >
        <SectionHeader
          title={t("analytics.title")}
          tabs={ANALYTICS_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        {rightSidebarTarget &&
          createPortal(<AnalyticsSidebarContent />, rightSidebarTarget)}
        <div className="flex-1 overflow-y-auto">
          <div className={`${LAYOUT.CONTENT_MAX_W} mx-auto w-full`}>
            {renderTab()}
          </div>
        </div>
      </div>
    </AnalyticsFilterProvider>
  );
}
