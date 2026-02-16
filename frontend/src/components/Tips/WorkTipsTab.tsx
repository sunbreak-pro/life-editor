import { useState } from "react";
import { SectionTabs, type TabItem } from "../shared/SectionTabs";
import { TimerTab } from "./TimerTab";
import { PomodoroTipsContent } from "./PomodoroTipsContent";
import { MusicTipsContent } from "./MusicTipsContent";

const SUB_TABS = [
  { id: "timer", labelKey: "work.tabTimer" },
  { id: "pomodoro", labelKey: "work.tabPomodoro" },
  { id: "music", labelKey: "work.tabMusic" },
] as const satisfies readonly TabItem[];

type SubTabId = (typeof SUB_TABS)[number]["id"];

interface WorkTipsTabProps {
  showMac: boolean;
}

export function WorkTipsTab({ showMac }: WorkTipsTabProps) {
  const [subTab, setSubTab] = useState<SubTabId>("timer");

  return (
    <div className="space-y-4">
      <SectionTabs
        tabs={SUB_TABS}
        activeTab={subTab}
        onTabChange={setSubTab}
        size="sm"
      />
      {subTab === "timer" && <TimerTab showMac={showMac} />}
      {subTab === "pomodoro" && <PomodoroTipsContent />}
      {subTab === "music" && <MusicTipsContent />}
    </div>
  );
}
