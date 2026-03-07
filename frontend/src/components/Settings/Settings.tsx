import { useState, useEffect } from "react";
import {
  Settings2,
  Bell,
  Database,
  Wrench,
  Keyboard,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { SectionTabs, type TabItem } from "../shared/SectionTabs";
import { LAYOUT } from "../../constants/layout";
import { AppearanceSettings } from "./AppearanceSettings";
import { LanguageSettings } from "./LanguageSettings";
import { NotificationSettings } from "./NotificationSettings";
import { DataManagement } from "./DataManagement";
import { UpdateSettings } from "./UpdateSettings";
import { PerformanceMonitor } from "./PerformanceMonitor";
import { LogViewer } from "./LogViewer";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { TrashView } from "../Trash/TrashView";
import { ClaudeSetupSection } from "./ClaudeSetupSection";

type SettingsTab =
  | "general"
  | "notifications"
  | "data"
  | "advanced"
  | "shortcuts"
  | "trash";

const TABS = [
  { id: "general", labelKey: "settings.general", icon: Settings2 },
  { id: "notifications", labelKey: "settings.notificationsTab", icon: Bell },
  { id: "data", labelKey: "settings.dataTab", icon: Database },
  { id: "advanced", labelKey: "settings.advancedTab", icon: Wrench },
  { id: "shortcuts", labelKey: "settings.shortcutsTab", icon: Keyboard },
] as const satisfies readonly TabItem<SettingsTab>[];

const RIGHT_TABS = [
  { id: "trash", labelKey: "sidebar.trash", icon: Trash2 },
] as const satisfies readonly TabItem<SettingsTab>[];

interface SettingsProps {
  initialTab?: SettingsTab;
}

export function Settings({ initialTab }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    initialTab ?? "general",
  );
  const { t } = useTranslation();

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div
      className={`h-full flex flex-col ${LAYOUT.CONTENT_PX} ${LAYOUT.CONTENT_PT} ${LAYOUT.CONTENT_PB}`}
    >
      <div className="flex items-baseline gap-4 border-b border-notion-border mb-5">
        <h2 className="text-2xl font-bold text-notion-text">
          {t("settings.title")}
        </h2>
        <SectionTabs
          tabs={TABS}
          rightTabs={RIGHT_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          noBorder
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "general" && (
          <div className="space-y-8">
            <AppearanceSettings />
            <div className="border-t border-notion-border" />
            <LanguageSettings />
          </div>
        )}
        {activeTab === "notifications" && <NotificationSettings />}
        {activeTab === "data" && <DataManagement />}
        {activeTab === "advanced" && (
          <div className="space-y-8">
            <ClaudeSetupSection />
            <div className="border-t border-notion-border" />
            <UpdateSettings />
            <div className="border-t border-notion-border" />
            <PerformanceMonitor />
            <div className="border-t border-notion-border" />
            <LogViewer />
          </div>
        )}
        {activeTab === "shortcuts" && <KeyboardShortcuts />}
        {activeTab === "trash" && <TrashView />}
      </div>
    </div>
  );
}
