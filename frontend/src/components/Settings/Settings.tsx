import { useState } from "react";
import { Settings2, Bell, Sparkles, Database, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SectionTabs, type TabItem } from "../shared/SectionTabs";
import { LAYOUT } from "../../constants/layout";
import { AppearanceSettings } from "./AppearanceSettings";
import { LanguageSettings } from "./LanguageSettings";
import { NotificationSettings } from "./NotificationSettings";
import { AISettings } from "./AISettings";
import { TrashBin } from "./TrashBin";
import { DataManagement } from "./DataManagement";
import { UpdateSettings } from "./UpdateSettings";
import { PerformanceMonitor } from "./PerformanceMonitor";
import { LogViewer } from "./LogViewer";

type SettingsTab = "general" | "notifications" | "ai" | "data" | "advanced";

const TABS = [
  { id: "general", labelKey: "settings.general", icon: Settings2 },
  { id: "notifications", labelKey: "settings.notificationsTab", icon: Bell },
  { id: "ai", labelKey: "settings.aiTab", icon: Sparkles },
  { id: "data", labelKey: "settings.dataTab", icon: Database },
  { id: "advanced", labelKey: "settings.advancedTab", icon: Wrench },
] as const satisfies readonly TabItem<SettingsTab>[];

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const { t } = useTranslation();

  return (
    <div
      className={`h-full flex flex-col ${LAYOUT.CONTENT_PX} ${LAYOUT.CONTENT_PT} ${LAYOUT.CONTENT_PB}`}
    >
      <h2 className={`text-2xl font-bold text-notion-text ${LAYOUT.TITLE_MB}`}>
        {t("settings.title")}
      </h2>

      <SectionTabs
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className={`flex-1 overflow-y-auto ${LAYOUT.TABS_MT}`}>
        {activeTab === "general" && (
          <div className="space-y-8">
            <AppearanceSettings />
            <div className="border-t border-notion-border" />
            <LanguageSettings />
          </div>
        )}
        {activeTab === "notifications" && <NotificationSettings />}
        {activeTab === "ai" && <AISettings />}
        {activeTab === "data" && (
          <div className="space-y-8">
            <DataManagement />
            <div className="border-t border-notion-border" />
            <TrashBin />
          </div>
        )}
        {activeTab === "advanced" && (
          <div className="space-y-8">
            <UpdateSettings />
            <div className="border-t border-notion-border" />
            <PerformanceMonitor />
            <div className="border-t border-notion-border" />
            <LogViewer />
          </div>
        )}
      </div>
    </div>
  );
}
