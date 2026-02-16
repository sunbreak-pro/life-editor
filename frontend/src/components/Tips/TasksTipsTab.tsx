import { useState } from "react";
import { SectionTabs, type TabItem } from "../shared/SectionTabs";
import { TasksTab } from "./TasksTab";
import { CalendarTab } from "./CalendarTab";

const SUB_TABS = [
  { id: "taskTree", labelKey: "tabs.taskTree" },
  { id: "schedule", labelKey: "tabs.schedule" },
] as const satisfies readonly TabItem[];

type SubTabId = (typeof SUB_TABS)[number]["id"];

interface TasksTipsTabProps {
  showMac: boolean;
}

export function TasksTipsTab({ showMac }: TasksTipsTabProps) {
  const [subTab, setSubTab] = useState<SubTabId>("taskTree");

  return (
    <div className="space-y-4">
      <SectionTabs
        tabs={SUB_TABS}
        activeTab={subTab}
        onTabChange={setSubTab}
        size="sm"
      />
      {subTab === "taskTree" ? <TasksTab showMac={showMac} /> : <CalendarTab />}
    </div>
  );
}
