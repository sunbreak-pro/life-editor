import { useState, useEffect, useContext, useCallback, useMemo } from "react";
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
  BarChart3,
  Globe,
  Compass,
  LayoutGrid,
  TerminalSquare,
  FolderTree,
  CalendarDays,
  Smartphone,
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
import { MobileAccessSettings } from "./MobileAccessSettings";
import { TasksTipsTab } from "../Tips/TasksTipsTab";
import { WorkTipsTab } from "../Tips/WorkTipsTab";
import { MemoTipsTab } from "../Tips/MemoTipsTab";
import { AnalyticsTab } from "../Tips/AnalyticsTab";
import { isMac } from "../../utils/platform";
import { RightSidebarContext } from "../../context/RightSidebarContext";
import type { ShortcutCategory } from "../../types/shortcut";
import { useSettingsHistory } from "../../hooks/useSettingsHistory";
import { useSettingsSearch } from "../../hooks/useSettingsSearch";
import { SearchBar } from "../shared/SearchBar";
// メインタブ（5つ）
type SettingsTab = "general" | "advanced" | "claude" | "shortcuts" | "tips";

// initialTab prop 用（レガシー値の受け入れ）
type SettingsInitialTab = SettingsTab | "trash" | "data" | "notifications";

const TABS = [
  { id: "general", labelKey: "settings.general", icon: Settings2 },
  { id: "advanced", labelKey: "settings.advancedTab", icon: Wrench },
  { id: "claude", labelKey: "settings.claude.title", icon: Bot },
  { id: "shortcuts", labelKey: "settings.shortcutsTab", icon: Keyboard },
  { id: "tips", labelKey: "tips.title", icon: Lightbulb },
] as const satisfies readonly TabItem<SettingsTab>[];

// Sub-navigation items for each settings tab
type GeneralSub = "appearance" | "language" | "notifications" | "mobile";
type AdvancedSub = "data" | "updates" | "performance" | "logs" | "trash";
type ClaudeSub = "setup" | "mcpTools" | "claudeMd" | "skills";
type TipsSub = "tasks" | "work" | "ideas" | "analytics";
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
  { id: "notifications", labelKey: "notifications.title", icon: Bell },
  { id: "mobile", labelKey: "settings.mobileAccess.title", icon: Smartphone },
];
const ADVANCED_SUBS: readonly TabItem<AdvancedSub>[] = [
  { id: "data", labelKey: "data.title", icon: Database },
  { id: "updates", labelKey: "updates.title", icon: Download },
  { id: "performance", labelKey: "performance.title", icon: Gauge },
  { id: "logs", labelKey: "logs.title", icon: FileText },
  { id: "trash", labelKey: "sidebar.trash", icon: Trash2 },
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
  { id: "ideas", labelKey: "tips.ideas", icon: Lightbulb },
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

// Map sidebar shortcutsSub id to ShortcutCategory for filtering
const SHORTCUTS_SUB_TO_CATEGORY: Record<ShortcutsSub, ShortcutCategory> = {
  global: "global",
  navigation: "navigation",
  layout: "view",
  terminal: "terminal",
  taskTree: "taskTree",
  calendar: "calendar",
};

function resolveInitialTab(initialTab: SettingsInitialTab | undefined): {
  tab: SettingsTab;
  generalSub?: GeneralSub;
  advancedSub?: AdvancedSub;
} {
  switch (initialTab) {
    case "trash":
      return { tab: "advanced", advancedSub: "trash" };
    case "data":
      return { tab: "advanced", advancedSub: "data" };
    case "notifications":
      return { tab: "general", generalSub: "notifications" };
    case undefined:
      return { tab: "general" };
    default:
      return { tab: initialTab };
  }
}

interface SettingsProps {
  initialTab?: SettingsInitialTab;
}

export function Settings({ initialTab }: SettingsProps) {
  const resolved = resolveInitialTab(initialTab);
  const [activeTab, setActiveTab] = useState<SettingsTab>(resolved.tab);
  const { t } = useTranslation();
  const { portalTarget: rightSidebarTarget } = useContext(RightSidebarContext);

  // Sub-navigation states
  const [generalSub, setGeneralSub] = useState<GeneralSub>(
    resolved.generalSub ?? "appearance",
  );
  const [advancedSub, setAdvancedSub] = useState<AdvancedSub>(
    resolved.advancedSub ?? "data",
  );
  const [claudeSub, setClaudeSub] = useState<ClaudeSub>("setup");
  const [tipsSub, setTipsSub] = useState<TipsSub>("tasks");
  const [shortcutsSub, setShortcutsSub] = useState<ShortcutsSub>("global");
  const [showMac] = useState(isMac);
  const [settingsKey, setSettingsKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const settingsNavigators = useMemo(
    () => ({
      setActiveTab,
      setGeneralSub: (sub: string) => setGeneralSub(sub as GeneralSub),
      setAdvancedSub: (sub: string) => setAdvancedSub(sub as AdvancedSub),
      setClaudeSub: (sub: string) => setClaudeSub(sub as ClaudeSub),
      setTipsSub: (sub: string) => setTipsSub(sub as TipsSub),
      setShortcutsSub: (sub: string) => setShortcutsSub(sub as ShortcutsSub),
    }),
    [],
  );

  const { suggestions: settingsSearchSuggestions, navigateTo } =
    useSettingsSearch(searchQuery, settingsNavigators);

  const handleHistoryApply = useCallback(() => {
    setSettingsKey((k) => k + 1);
  }, []);

  const { pushSnapshot } = useSettingsHistory(handleHistoryApply);

  useEffect(() => {
    if (initialTab) {
      const r = resolveInitialTab(initialTab);
      setActiveTab(r.tab);
      if (r.generalSub) setGeneralSub(r.generalSub);
      if (r.advancedSub) setAdvancedSub(r.advancedSub);
    }
  }, [initialTab]);

  // Render sidebar content based on active tab
  const renderSidebarContent = () => {
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
      default:
        return null;
    }
  };

  // Render main content based on active tab + sub-selection
  const renderContent = () => {
    if (activeTab === "general") {
      if (rightSidebarTarget) {
        switch (generalSub) {
          case "appearance":
            return <AppearanceSettings />;
          case "language":
            return <LanguageSettings />;
          case "notifications":
            return <NotificationSettings />;
          case "mobile":
            return <MobileAccessSettings />;
        }
      }
      return (
        <div className="space-y-8">
          <AppearanceSettings />
          <div className="border-t border-notion-border" />
          <LanguageSettings />
          <div className="border-t border-notion-border" />
          <NotificationSettings />
          <div className="border-t border-notion-border" />
          <MobileAccessSettings />
        </div>
      );
    }

    if (activeTab === "advanced") {
      if (rightSidebarTarget) {
        switch (advancedSub) {
          case "data":
            return <DataManagement />;
          case "updates":
            return <UpdateSettings />;
          case "performance":
            return <PerformanceMonitor />;
          case "logs":
            return <LogViewer />;
          case "trash":
            return <TrashView />;
        }
      }
      return (
        <div className="space-y-8">
          <DataManagement />
          <div className="border-t border-notion-border" />
          <UpdateSettings />
          <div className="border-t border-notion-border" />
          <PerformanceMonitor />
          <div className="border-t border-notion-border" />
          <LogViewer />
          <div className="border-t border-notion-border" />
          <TrashView />
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
          case "ideas":
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
          {/* Ideas tips reuse MemoTipsTab */}
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

    return null;
  };

  const sidebarContent = renderSidebarContent();

  const handleSettingsSearchSelect = useCallback(
    (id: string) => {
      navigateTo(id);
      setSearchQuery("");
    },
    [navigateTo],
  );

  const sidebarWithSearch = sidebarContent ? (
    <div className="flex flex-col h-full">
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t("search.searchSettings")}
        showSuggestionsOnFocus={false}
        suggestions={settingsSearchSuggestions}
        onSuggestionSelect={handleSettingsSearchSelect}
      />
      <div className="flex-1 overflow-y-auto">{sidebarContent}</div>
    </div>
  ) : null;

  return (
    <div
      className={`h-full flex flex-col ${LAYOUT.CONTENT_PX} ${LAYOUT.CONTENT_PT} ${LAYOUT.CONTENT_PB}`}
    >
      {rightSidebarTarget &&
        sidebarWithSearch &&
        createPortal(sidebarWithSearch, rightSidebarTarget)}

      <SectionHeader
        title={t("settings.title")}
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div key={settingsKey} className="flex-1 overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  );
}
