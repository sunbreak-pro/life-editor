import { useState, useEffect, useContext, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Settings2,
  Bell,
  Database,
  Wrench,
  Keyboard,
  Bot,
  Palette,
  Languages,
  Download,
  Gauge,
  Cog,
  FileCode,
  Puzzle,
  Timer,
  Globe,
  Compass,
  LayoutGrid,
  TerminalSquare,
  FolderTree,
  CalendarDays,
  Smartphone,
  Sliders,
  Monitor,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TabItem } from "../shared/SectionTabs";
import { SectionHeader } from "../shared/SectionHeader";
import { VerticalNavList } from "../shared/VerticalNavList";
import { LAYOUT } from "../../constants/layout";
import { AppearanceSettings } from "./AppearanceSettings";
import { LanguageSettings } from "./LanguageSettings";
import { NotificationSettings } from "./NotificationSettings";
import { TimerSettings } from "./TimerSettings";
import { MobileAccessSettings } from "./MobileAccessSettings";
import { DataManagement } from "./DataManagement";
import { UpdateSettings } from "./UpdateSettings";
import { DeveloperTools } from "./DeveloperTools";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { ClaudeSetupSection } from "./ClaudeSetupSection";
import { McpToolsList } from "./McpToolsList";
import { ClaudeMdEditor } from "./ClaudeMdEditor";
import { SkillsManager } from "./SkillsManager";
import { BehaviorSettings } from "./BehaviorSettings";
import { SystemSettings } from "./SystemSettings";
import { RightSidebarContext } from "../../context/RightSidebarContext";
import type { ShortcutCategory } from "../../types/shortcut";
import { useSettingsHistory } from "../../hooks/useSettingsHistory";
import { useSettingsSearch } from "../../hooks/useSettingsSearch";
import { SearchBar } from "../shared/SearchBar";

// メインタブ（4つ）
type SettingsTab = "general" | "advanced" | "claude" | "shortcuts";

// initialTab prop 用（レガシー値の受け入れ）
export type SettingsInitialTab =
  | SettingsTab
  | "trash"
  | "data"
  | "notifications"
  | "timer"
  | "mobile"
  | "devtools"
  | "behaviors"
  | "system";

const TABS = [
  { id: "general", labelKey: "settings.general", icon: Settings2 },
  { id: "advanced", labelKey: "settings.advancedTab", icon: Wrench },
  { id: "claude", labelKey: "settings.claude.title", icon: Bot },
  { id: "shortcuts", labelKey: "settings.shortcutsTab", icon: Keyboard },
] as const satisfies readonly TabItem<SettingsTab>[];

// Sub-navigation items for each settings tab
type GeneralSub =
  | "appearance"
  | "language"
  | "notifications"
  | "timer"
  | "behaviors";
type AdvancedSub = "mobile" | "data" | "updates" | "devtools" | "system";
type ClaudeSub = "setup" | "mcpTools" | "claudeMd" | "skills";
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
  { id: "timer", labelKey: "timerSettings.title", icon: Timer },
  { id: "behaviors", labelKey: "settings.behaviors", icon: Sliders },
];
const ADVANCED_SUBS: readonly TabItem<AdvancedSub>[] = [
  { id: "mobile", labelKey: "settings.mobileAccess.title", icon: Smartphone },
  { id: "data", labelKey: "data.title", icon: Database },
  { id: "updates", labelKey: "updates.title", icon: Download },
  { id: "devtools", labelKey: "settings.developerTools", icon: Gauge },
  { id: "system", labelKey: "settings.system", icon: Monitor },
];
const CLAUDE_SUBS: readonly TabItem<ClaudeSub>[] = [
  { id: "setup", labelKey: "settings.claude.setup", icon: Cog },
  { id: "mcpTools", labelKey: "settings.claude.mcpTools", icon: Wrench },
  { id: "claudeMd", labelKey: "settings.claude.claudeMd", icon: FileCode },
  { id: "skills", labelKey: "settings.claude.skills", icon: Puzzle },
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
    case "data":
      return { tab: "advanced", advancedSub: "data" };
    case "notifications":
      return { tab: "general", generalSub: "notifications" };
    case "timer":
      return { tab: "general", generalSub: "timer" };
    case "mobile":
      return { tab: "advanced", advancedSub: "mobile" };
    case "devtools":
      return { tab: "advanced", advancedSub: "devtools" };
    case "behaviors":
      return { tab: "general", generalSub: "behaviors" };
    case "system":
      return { tab: "advanced", advancedSub: "system" };
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
    resolved.advancedSub ?? "mobile",
  );
  const [claudeSub, setClaudeSub] = useState<ClaudeSub>("setup");
  const [shortcutsSub, setShortcutsSub] = useState<ShortcutsSub>("global");
  const [settingsKey, setSettingsKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const settingsNavigators = useMemo(
    () => ({
      setActiveTab,
      setGeneralSub: (sub: string) => setGeneralSub(sub as GeneralSub),
      setAdvancedSub: (sub: string) => setAdvancedSub(sub as AdvancedSub),
      setClaudeSub: (sub: string) => setClaudeSub(sub as ClaudeSub),
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
          case "timer":
            return <TimerSettings />;
          case "behaviors":
            return <BehaviorSettings />;
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
          <TimerSettings />
          <div className="border-t border-notion-border" />
          <BehaviorSettings />
        </div>
      );
    }

    if (activeTab === "advanced") {
      if (rightSidebarTarget) {
        switch (advancedSub) {
          case "mobile":
            return <MobileAccessSettings />;
          case "data":
            return <DataManagement />;
          case "updates":
            return <UpdateSettings />;
          case "devtools":
            return <DeveloperTools />;
          case "system":
            return <SystemSettings />;
        }
      }
      return (
        <div className="space-y-8">
          <MobileAccessSettings />
          <div className="border-t border-notion-border" />
          <DataManagement />
          <div className="border-t border-notion-border" />
          <UpdateSettings />
          <div className="border-t border-notion-border" />
          <DeveloperTools />
          <div className="border-t border-notion-border" />
          <SystemSettings />
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
        <div className={`${LAYOUT.CONTENT_MAX_W} mx-auto w-full`}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
