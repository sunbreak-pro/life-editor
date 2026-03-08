import { useState, useEffect, useContext, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Settings2,
  Bell,
  Database,
  Wrench,
  Keyboard,
  Trash2,
  Bot,
  Lightbulb,
  Palette,
  Languages,
  Download,
  Gauge,
  FileText,
  Cog,
  FileCode,
  Puzzle,
  CheckSquare,
  Timer,
  BookOpen,
  BarChart3,
  Globe,
  Compass,
  LayoutGrid,
  TerminalSquare,
  FolderTree,
  CalendarDays,
  Undo2,
  Redo2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TabItem } from "../shared/SectionTabs";
import { SectionHeader } from "../shared/SectionHeader";
import { VerticalNavList } from "../shared/VerticalNavList";
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
import { McpToolsList } from "./McpToolsList";
import { ClaudeMdEditor } from "./ClaudeMdEditor";
import { SkillsManager } from "./SkillsManager";
import { TasksTipsTab } from "../Tips/TasksTipsTab";
import { WorkTipsTab } from "../Tips/WorkTipsTab";
import { MemoTipsTab } from "../Tips/MemoTipsTab";
import { AnalyticsTab } from "../Tips/AnalyticsTab";
import { isMac } from "../../utils/platform";
import { RightSidebarContext } from "../../context/RightSidebarContext";
import type { ShortcutCategory } from "../../types/shortcut";
import { useSettingsHistory } from "../../hooks/useSettingsHistory";

type SettingsTab =
  | "general"
  | "notifications"
  | "data"
  | "advanced"
  | "claude"
  | "shortcuts"
  | "tips"
  | "trash";

const TABS = [
  { id: "general", labelKey: "settings.general", icon: Settings2 },
  { id: "notifications", labelKey: "settings.notificationsTab", icon: Bell },
  { id: "data", labelKey: "settings.dataTab", icon: Database },
  { id: "advanced", labelKey: "settings.advancedTab", icon: Wrench },
  { id: "claude", labelKey: "settings.claude.title", icon: Bot },
  { id: "shortcuts", labelKey: "settings.shortcutsTab", icon: Keyboard },
  { id: "tips", labelKey: "tips.title", icon: Lightbulb },
] as const satisfies readonly TabItem<SettingsTab>[];

const RIGHT_TABS = [
  { id: "trash", labelKey: "sidebar.trash", icon: Trash2 },
] as const satisfies readonly TabItem<SettingsTab>[];

// Sub-navigation items for each settings tab
type GeneralSub = "appearance" | "language";
type AdvancedSub = "updates" | "performance" | "logs";
type ClaudeSub = "setup" | "mcpTools" | "claudeMd" | "skills";
type TipsSub = "tasks" | "work" | "memo" | "analytics";
type ShortcutsSub =
  | "global"
  | "navigation"
  | "layout"
  | "terminal"
  | "taskTree"
  | "calendar";

const GENERAL_SUBS: readonly TabItem<GeneralSub>[] = [
  { id: "appearance", labelKey: "settings.appearance", icon: Palette },
  { id: "language", labelKey: "settings.language", icon: Languages },
];
const ADVANCED_SUBS: readonly TabItem<AdvancedSub>[] = [
  { id: "updates", labelKey: "updates.title", icon: Download },
  { id: "performance", labelKey: "performance.title", icon: Gauge },
  { id: "logs", labelKey: "logs.title", icon: FileText },
];
const CLAUDE_SUBS: readonly TabItem<ClaudeSub>[] = [
  { id: "setup", labelKey: "settings.claude.setup", icon: Cog },
  { id: "mcpTools", labelKey: "settings.claude.mcpTools", icon: Wrench },
  { id: "claudeMd", labelKey: "settings.claude.claudeMd", icon: FileCode },
  { id: "skills", labelKey: "settings.claude.skills", icon: Puzzle },
];
const TIPS_SUBS: readonly TabItem<TipsSub>[] = [
  { id: "tasks", labelKey: "tips.tasks", icon: CheckSquare },
  { id: "work", labelKey: "tips.work", icon: Timer },
  { id: "memo", labelKey: "tips.memo", icon: BookOpen },
  { id: "analytics", labelKey: "tips.analytics", icon: BarChart3 },
];
const SHORTCUTS_SUBS: readonly TabItem<ShortcutsSub>[] = [
  { id: "global", labelKey: "tips.shortcutsTab.global", icon: Globe },
  { id: "navigation", labelKey: "tips.shortcutsTab.navigation", icon: Compass },
  { id: "layout", labelKey: "tips.shortcutsTab.view", icon: LayoutGrid },
  {
    id: "terminal",
    labelKey: "tips.shortcutsTab.terminal",
    icon: TerminalSquare,
  },
  { id: "taskTree", labelKey: "tips.shortcutsTab.taskTree", icon: FolderTree },
  {
    id: "calendar",
    labelKey: "tips.shortcutsTab.calendar",
    icon: CalendarDays,
  },
];
const NOTIFICATION_SUBS: readonly TabItem<"notifications">[] = [
  { id: "notifications", labelKey: "notifications.title", icon: Bell },
];
const DATA_SUBS: readonly TabItem<"data">[] = [
  { id: "data", labelKey: "data.title", icon: Database },
];

// Map sidebar shortcutsSub id to ShortcutCategory for filtering
const SHORTCUTS_SUB_TO_CATEGORY: Record<ShortcutsSub, ShortcutCategory> = {
  global: "global",
  navigation: "navigation",
  layout: "view",
  terminal: "terminal",
  taskTree: "taskTree",
  calendar: "calendar",
};

interface SettingsProps {
  initialTab?: SettingsTab;
}

export function Settings({ initialTab }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    initialTab ?? "general",
  );
  const { t } = useTranslation();
  const { portalTarget: rightSidebarTarget } = useContext(RightSidebarContext);

  // Sub-navigation states
  const [generalSub, setGeneralSub] = useState<GeneralSub>("appearance");
  const [advancedSub, setAdvancedSub] = useState<AdvancedSub>("updates");
  const [claudeSub, setClaudeSub] = useState<ClaudeSub>("setup");
  const [tipsSub, setTipsSub] = useState<TipsSub>("tasks");
  const [shortcutsSub, setShortcutsSub] = useState<ShortcutsSub>("global");
  const [, setNotificationSub] = useState<"notifications">("notifications");
  const [, setDataSub] = useState<"data">("data");
  const [showMac] = useState(isMac);
  const [settingsKey, setSettingsKey] = useState(0);

  const handleHistoryApply = useCallback(() => {
    setSettingsKey((k) => k + 1);
  }, []);

  const { canUndo, canRedo, undo, redo, pushSnapshot } =
    useSettingsHistory(handleHistoryApply);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // Render sidebar content based on active tab
  const renderSidebarContent = () => {
    // TrashView handles its own portal
    if (activeTab === "trash") return null;

    switch (activeTab) {
      case "general":
        return (
          <VerticalNavList
            items={GENERAL_SUBS}
            activeItem={generalSub}
            onItemChange={setGeneralSub}
          />
        );
      case "advanced":
        return (
          <VerticalNavList
            items={ADVANCED_SUBS}
            activeItem={advancedSub}
            onItemChange={setAdvancedSub}
          />
        );
      case "claude":
        return (
          <VerticalNavList
            items={CLAUDE_SUBS}
            activeItem={claudeSub}
            onItemChange={setClaudeSub}
          />
        );
      case "tips":
        return (
          <VerticalNavList
            items={TIPS_SUBS}
            activeItem={tipsSub}
            onItemChange={setTipsSub}
          />
        );
      case "shortcuts":
        return (
          <VerticalNavList
            items={SHORTCUTS_SUBS}
            activeItem={shortcutsSub}
            onItemChange={setShortcutsSub}
          />
        );
      case "notifications":
        return (
          <VerticalNavList
            items={NOTIFICATION_SUBS}
            activeItem={"notifications"}
            onItemChange={setNotificationSub}
          />
        );
      case "data":
        return (
          <VerticalNavList
            items={DATA_SUBS}
            activeItem={"data"}
            onItemChange={setDataSub}
          />
        );
      default:
        return null;
    }
  };

  // Render main content based on active tab + sub-selection
  const renderContent = () => {
    if (activeTab === "general") {
      if (rightSidebarTarget) {
        // Show only selected sub-section
        switch (generalSub) {
          case "appearance":
            return <AppearanceSettings />;
          case "language":
            return <LanguageSettings />;
        }
      }
      // Fallback: show all
      return (
        <div className="space-y-8">
          <AppearanceSettings />
          <div className="border-t border-notion-border" />
          <LanguageSettings />
        </div>
      );
    }

    if (activeTab === "notifications") return <NotificationSettings />;
    if (activeTab === "data") return <DataManagement />;

    if (activeTab === "advanced") {
      if (rightSidebarTarget) {
        switch (advancedSub) {
          case "updates":
            return <UpdateSettings />;
          case "performance":
            return <PerformanceMonitor />;
          case "logs":
            return <LogViewer />;
        }
      }
      return (
        <div className="space-y-8">
          <UpdateSettings />
          <div className="border-t border-notion-border" />
          <PerformanceMonitor />
          <div className="border-t border-notion-border" />
          <LogViewer />
        </div>
      );
    }

    if (activeTab === "claude") {
      if (rightSidebarTarget) {
        switch (claudeSub) {
          case "setup":
            return <ClaudeSetupSection />;
          case "mcpTools":
            return <McpToolsList />;
          case "claudeMd":
            return <ClaudeMdEditor />;
          case "skills":
            return <SkillsManager />;
        }
      }
      return (
        <div className="space-y-8">
          <ClaudeSetupSection />
          <div className="border-t border-notion-border" />
          <McpToolsList />
          <div className="border-t border-notion-border" />
          <ClaudeMdEditor />
          <div className="border-t border-notion-border" />
          <SkillsManager />
        </div>
      );
    }

    if (activeTab === "tips") {
      if (rightSidebarTarget) {
        switch (tipsSub) {
          case "tasks":
            return <TasksTipsTab showMac={showMac} />;
          case "work":
            return <WorkTipsTab showMac={showMac} />;
          case "memo":
            return <MemoTipsTab />;
          case "analytics":
            return <AnalyticsTab showMac={showMac} />;
        }
      }
      return (
        <div className="space-y-8">
          <TasksTipsTab showMac={showMac} />
          <div className="border-t border-notion-border" />
          <WorkTipsTab showMac={showMac} />
          <div className="border-t border-notion-border" />
          <MemoTipsTab />
          <div className="border-t border-notion-border" />
          <AnalyticsTab showMac={showMac} />
        </div>
      );
    }

    if (activeTab === "shortcuts") {
      return (
        <KeyboardShortcuts
          activeCategory={
            rightSidebarTarget ? SHORTCUTS_SUB_TO_CATEGORY[shortcutsSub] : null
          }
          onBeforeChange={pushSnapshot}
        />
      );
    }

    if (activeTab === "trash") return <TrashView />;

    return null;
  };

  const sidebarContent = renderSidebarContent();

  return (
    <div
      className={`h-full flex flex-col ${LAYOUT.CONTENT_PX} ${LAYOUT.CONTENT_PT} ${LAYOUT.CONTENT_PB}`}
    >
      {rightSidebarTarget &&
        sidebarContent &&
        createPortal(sidebarContent, rightSidebarTarget)}

      <SectionHeader
        title={t("settings.title")}
        tabs={TABS}
        rightTabs={RIGHT_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        actions={
          <>
            <button
              onClick={undo}
              disabled={!canUndo}
              className="p-1 text-notion-text-secondary hover:text-notion-text transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title={t("common.undo")}
            >
              <Undo2 size={14} />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="p-1 text-notion-text-secondary hover:text-notion-text transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title={t("common.redo")}
            >
              <Redo2 size={14} />
            </button>
          </>
        }
      />

      <div key={settingsKey} className="flex-1 overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  );
}
