import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Keyboard,
  ListTodo,
  Briefcase,
  StickyNote,
  BarChart3,
} from "lucide-react";
import { SectionTabs, type TabItem } from "../shared/SectionTabs";
import { LAYOUT } from "../../constants/layout";
import { isMac } from "../../utils/platform";
import { ShortcutsTab } from "./ShortcutsTab";
import { TasksTipsTab } from "./TasksTipsTab";
import { WorkTipsTab } from "./WorkTipsTab";
import { MemoTipsTab } from "./MemoTipsTab";
import { AnalyticsTab } from "./AnalyticsTab";

const TABS = [
  { id: "shortcuts", labelKey: "tips.shortcuts", icon: Keyboard },
  { id: "tasks", labelKey: "tips.tasks", icon: ListTodo },
  { id: "work", labelKey: "tips.work", icon: Briefcase },
  { id: "memo", labelKey: "tips.memo", icon: StickyNote },
  { id: "analytics", labelKey: "tips.analytics", icon: BarChart3 },
] as const satisfies readonly TabItem[];

type TabId = (typeof TABS)[number]["id"];

export function Tips() {
  const [activeTab, setActiveTab] = useState<TabId>("shortcuts");
  const [showMac, setShowMac] = useState(isMac);
  const { t } = useTranslation();

  const renderTab = () => {
    switch (activeTab) {
      case "shortcuts":
        return <ShortcutsTab showMac={showMac} onToggleOS={setShowMac} />;
      case "tasks":
        return <TasksTipsTab showMac={showMac} />;
      case "work":
        return <WorkTipsTab showMac={showMac} />;
      case "memo":
        return <MemoTipsTab />;
      case "analytics":
        return <AnalyticsTab showMac={showMac} />;
    }
  };

  return (
    <div
      className={`h-full flex flex-col ${LAYOUT.CONTENT_PX} ${LAYOUT.CONTENT_PT} ${LAYOUT.CONTENT_PB}`}
    >
      <div className="flex items-baseline gap-4 border-b border-notion-border mb-5">
        <h2 className="text-2xl font-bold text-notion-text">
          {t("tips.title")}
        </h2>
        <SectionTabs
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          noBorder
        />
      </div>

      <div className="flex-1 overflow-y-auto">{renderTab()}</div>
    </div>
  );
}
