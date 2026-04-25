import { useState, useEffect, useContext, useCallback } from "react";
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
  Cloud,
  FileCode,
  Puzzle,
  Timer,
  Globe,
  Compass,
  LayoutGrid,
  TerminalSquare,
  FolderTree,
  CalendarDays,
  Sliders,
  Monitor,
  HardDrive,
  Trash2,
  CheckSquare,
  Calendar,
  FileText,
  Volume2,
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
import { FilesSettings } from "./FilesSettings";
import { SyncSettings } from "./SyncSettings";
import { RightSidebarContext } from "../../context/RightSidebarContext";
import type { ShortcutCategory } from "../../types/shortcut";
import { useSettingsHistory } from "../../hooks/useSettingsHistory";
import { SearchTrigger } from "../shared/SearchTrigger";
import { TrashView } from "../Trash/TrashView";
import { getDataService } from "../../services";
import { ConfirmDialog } from "../shared/ConfirmDialog";

// メインタブ（4つ）
type SettingsTab = "general" | "advanced" | "claude" | "shortcuts" | "trash";

// initialTab prop 用（レガシー値の受け入れ）
export type SettingsInitialTab =
  | SettingsTab
  | "trash"
  | "data"
  | "notifications"
  | "timer"
  | "devtools"
  | "behaviors"
  | "system"
  | "mobile";

const TABS = [
  { id: "general", labelKey: "settings.general", icon: Settings2 },
  { id: "advanced", labelKey: "settings.advancedTab", icon: Wrench },
  { id: "claude", labelKey: "settings.claude.title", icon: Bot },
  { id: "shortcuts", labelKey: "settings.shortcutsTab", icon: Keyboard },
  { id: "trash", labelKey: "trash.title", icon: Trash2 },
] as const satisfies readonly TabItem<SettingsTab>[];

// Sub-navigation items for each settings tab
type GeneralSub =
  | "appearance"
  | "language"
  | "notifications"
  | "timer"
  | "behaviors";
type AdvancedSub =
  | "data"
  | "sync"
  | "updates"
  | "devtools"
  | "system"
  | "files";
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
  { id: "data", labelKey: "data.title", icon: Database },
  { id: "sync", labelKey: "sync.title", icon: Cloud },
  { id: "updates", labelKey: "updates.title", icon: Download },
  { id: "devtools", labelKey: "settings.developerTools", icon: Gauge },
  { id: "system", labelKey: "settings.system", icon: Monitor },
  { id: "files", labelKey: "files.settingsTitle", icon: HardDrive },
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

type TrashSub = "tasks" | "routine" | "events" | "materials" | "sounds";
const TRASH_SUBS: readonly TabItem<TrashSub>[] = [
  { id: "tasks", labelKey: "trash.tabTasks", icon: CheckSquare },
  { id: "routine", labelKey: "trash.tabRoutine", icon: Calendar },
  { id: "events", labelKey: "trash.tabEvents", icon: CalendarDays },
  { id: "materials", labelKey: "trash.tabMaterials", icon: FileText },
  { id: "sounds", labelKey: "trash.tabSounds", icon: Volume2 },
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
      return { tab: "trash" };
    case "data":
      return { tab: "advanced", advancedSub: "data" };
    case "notifications":
      return { tab: "general", generalSub: "notifications" };
    case "timer":
      return { tab: "general", generalSub: "timer" };
    case "devtools":
      return { tab: "advanced", advancedSub: "devtools" };
    case "behaviors":
      return { tab: "general", generalSub: "behaviors" };
    case "system":
      return { tab: "advanced", advancedSub: "system" };
    case "mobile":
      return { tab: "general" };
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
  const [shortcutsSub, setShortcutsSub] = useState<ShortcutsSub>("global");
  const [trashSub, setTrashSub] = useState<TrashSub>("tasks");
  const [settingsKey, setSettingsKey] = useState(0);
  const [trashSearchQuery] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const [resetIsError, setResetIsError] = useState(false);

  const handleHistoryApply = useCallback(() => {
    setSettingsKey((k) => k + 1);
  }, []);

  const handleReset = useCallback(async () => {
    setShowResetConfirm(false);
    try {
      const success = await getDataService().resetData();
      if (success) {
        setResetIsError(false);
        setResetStatus(t("data.resetSuccess"));
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (e) {
      setResetIsError(true);
      setResetStatus(
        t("data.resetFailed", {
          error: e instanceof Error ? e.message : t("data.unknownError"),
        }),
      );
    }
  }, [t]);

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
      case "trash":
        return (
          <div className="flex flex-col h-full">
            <div className="p-3 border-b border-notion-border">
              <button
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm bg-notion-danger/10 text-notion-danger hover:bg-notion-danger/20 transition-colors"
              >
                <Trash2 size={14} />
                {t("data.reset")}
              </button>
              {resetStatus && (
                <p
                  className={`text-xs mt-2 ${resetIsError ? "text-notion-danger" : "text-notion-success"}`}
                >
                  {resetStatus}
                </p>
              )}
            </div>
            <SearchTrigger className="px-3 pt-2 pb-1" />
            <div className="flex-1 overflow-y-auto">
              <VerticalNavList
                items={TRASH_SUBS}
                activeItem={trashSub}
                onItemChange={setTrashSub}
              />
            </div>
          </div>
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
          case "data":
            return <DataManagement />;
          case "sync":
            return <SyncSettings />;
          case "updates":
            return <UpdateSettings />;
          case "devtools":
            return <DeveloperTools />;
          case "system":
            return <SystemSettings />;
          case "files":
            return <FilesSettings />;
        }
      }
      return (
        <div className="space-y-8">
          <DataManagement />
          <div className="border-t border-notion-border" />
          <SyncSettings />
          <div className="border-t border-notion-border" />
          <UpdateSettings />
          <div className="border-t border-notion-border" />
          <DeveloperTools />
          <div className="border-t border-notion-border" />
          <SystemSettings />
          <div className="border-t border-notion-border" />
          <FilesSettings />
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

    if (activeTab === "trash") {
      return <TrashView activeTab={trashSub} searchQuery={trashSearchQuery} />;
    }

    return null;
  };

  const sidebarContent = renderSidebarContent();

  const sidebarPortalContent = sidebarContent ? (
    activeTab === "trash" ? (
      sidebarContent
    ) : (
      <div className="flex flex-col h-full">
        <SearchTrigger className="px-3 pt-2 pb-1" />
        <div className="flex-1 overflow-y-auto">{sidebarContent}</div>
      </div>
    )
  ) : null;

  return (
    <div
      className={`h-full flex flex-col ${LAYOUT.CONTENT_PX} ${LAYOUT.CONTENT_PT} ${LAYOUT.CONTENT_PB}`}
    >
      {rightSidebarTarget &&
        sidebarPortalContent &&
        createPortal(sidebarPortalContent, rightSidebarTarget)}

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

      {showResetConfirm && (
        <ConfirmDialog
          message={t("data.resetConfirm")}
          onConfirm={handleReset}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
    </div>
  );
}
