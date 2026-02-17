import {
  CheckSquare,
  BookOpen,
  Play,
  BarChart3,
  Settings,
  Pencil,
  PanelLeft,
  Lightbulb,
} from "lucide-react";
import type { SectionId } from "../../types/taskTree";
import { useTimerContext } from "../../hooks/useTimerContext";
import { isMac } from "../../utils/platform";
import { useTranslation } from "react-i18next";

interface SidebarProps {
  width: number;
  activeSection: SectionId;
  onSectionChange: (section: SectionId) => void;
  onToggle: () => void;
}

const menuItems: {
  id: SectionId;
  labelKey: string;
  icon: typeof CheckSquare;
}[] = [
  { id: "tasks", labelKey: "sidebar.tasks", icon: CheckSquare },
  { id: "memo", labelKey: "sidebar.memo", icon: BookOpen },
  { id: "work", labelKey: "sidebar.work", icon: Play },
  { id: "analytics", labelKey: "sidebar.analytics", icon: BarChart3 },
  { id: "settings", labelKey: "sidebar.settings", icon: Settings },
  { id: "tips", labelKey: "sidebar.tips", icon: Lightbulb },
];

export function LeftSidebar({
  width,
  activeSection,
  onSectionChange,
  onToggle,
}: SidebarProps) {
  const timer = useTimerContext();
  const { t } = useTranslation();
  const showTimer = timer.activeTask !== null || timer.isRunning;

  return (
    <aside
      className="h-screen bg-notion-bg-secondary border-r border-notion-border flex flex-col"
      style={{ width }}
    >
      <div
        className={`flex justify-between items-center p-4 border-b border-notion-border titlebar-drag${
          isMac ? " pt-10" : ""
        }`}
      >
        <h1 className="text-2xl font-semibold text-notion-text">Sonic Flow</h1>
        <button
          onClick={onToggle}
          className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors titlebar-nodrag"
        >
          <PanelLeft size={18} />
        </button>
      </div>
      <nav className="flex-1 p-2 space-y-2.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <div key={item.id}>
              <button
                onClick={() => onSectionChange(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-notion-hover text-notion-text"
                    : "text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text"
                }`}
              >
                <Icon size={18} />
                <span>{t(item.labelKey)}</span>
              </button>

              {item.id === "work" && showTimer && (
                <div className="ml-3 mr-2 mb-1 px-3 py-2 rounded-md bg-notion-hover/50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-notion-text-secondary truncate">
                        {timer.activeTask?.title ?? t("sidebar.freeSession")}
                      </p>
                      <p className="text-sm font-mono tabular-nums text-notion-accent">
                        {timer.formatTime(timer.remainingSeconds)}
                      </p>
                    </div>
                    <button
                      onClick={() => onSectionChange("work")}
                      className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors shrink-0 cursor-pointer"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
