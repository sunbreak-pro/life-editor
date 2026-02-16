import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Keyboard,
  ListTodo,
  Timer,
  CalendarDays,
  StickyNote,
  BarChart3,
  Type,
} from "lucide-react";
import { SectionTabs, type TabItem } from "../shared/SectionTabs";
import { isMac } from "../../utils/platform";
import { ShortcutsTab } from "./ShortcutsTab";
import { TasksTab } from "./TasksTab";
import { TimerTab } from "./TimerTab";
import { CalendarTab } from "./CalendarTab";
import { MemoTab } from "./MemoTab";
import { AnalyticsTab } from "./AnalyticsTab";
import { EditorTab } from "./EditorTab";

const TABS = [
  { id: "shortcuts", labelKey: "tips.shortcuts", icon: Keyboard },
  { id: "tasks", labelKey: "tips.tasks", icon: ListTodo },
  { id: "timer", labelKey: "tips.timer", icon: Timer },
  { id: "schedule", labelKey: "tips.schedule", icon: CalendarDays },
  { id: "memo", labelKey: "tips.memo", icon: StickyNote },
  { id: "analytics", labelKey: "tips.analytics", icon: BarChart3 },
  { id: "editor", labelKey: "tips.editor", icon: Type },
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
        return <TasksTab showMac={showMac} />;
      case "timer":
        return <TimerTab showMac={showMac} />;
      case "schedule":
        return <CalendarTab />;
      case "memo":
        return <MemoTab />;
      case "analytics":
        return <AnalyticsTab showMac={showMac} />;
      case "editor":
        return <EditorTab />;
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-notion-text">{t("tips.title")}</h2>

      <SectionTabs
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div>{renderTab()}</div>
    </div>
  );
}
