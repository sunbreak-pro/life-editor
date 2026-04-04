import { useContext, useEffect, useMemo, useState } from "react";
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
import { AnalyticsSidebarContent } from "./AnalyticsSidebarContent";

type AnalyticsTab = "overview" | "time" | "tasks";

const ANALYTICS_TABS: readonly TabItem<AnalyticsTab>[] = [
  { id: "overview", labelKey: "analytics.tabs.overview" },
  { id: "time", labelKey: "analytics.tabs.time" },
  { id: "tasks", labelKey: "analytics.tabs.tasks" },
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

  const renderTab = () => {
    switch (activeTab) {
      case "overview":
        return <OverviewTab sessions={sessions} nodes={nodes} />;
      case "time":
        return <TimeTab sessions={sessions} taskNameMap={taskNameMap} />;
      case "tasks":
        return <TasksTab sessions={sessions} nodes={nodes} />;
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
        <div className="flex-1 overflow-y-auto">{renderTab()}</div>
      </div>
    </AnalyticsFilterProvider>
  );
}
