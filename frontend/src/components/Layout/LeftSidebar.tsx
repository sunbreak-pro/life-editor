import {
  CheckSquare,
  BookOpen,
  Play,
  BarChart3,
  Settings,
  Pencil,
} from "lucide-react";
import type { SectionId } from "../../types/taskTree";
import { useTimerContext } from "../../hooks/useTimerContext";
import { useTranslation } from "react-i18next";

interface SidebarProps {
  width: number;
  activeSection: SectionId;
  onSectionChange: (section: SectionId) => void;
}

const mainMenuItems: {
  id: SectionId;
  labelKey: string;
  icon: typeof CheckSquare;
}[] = [
  { id: "tasks", labelKey: "sidebar.tasks", icon: CheckSquare },
  { id: "memo", labelKey: "sidebar.memo", icon: BookOpen },
  { id: "work", labelKey: "sidebar.work", icon: Play },
  { id: "analytics", labelKey: "sidebar.analytics", icon: BarChart3 },
];

export function LeftSidebar({
  width,
  activeSection,
  onSectionChange,
}: SidebarProps) {
  const timer = useTimerContext();
  const { t } = useTranslation();
  const showTimer = timer.activeTask !== null || timer.isRunning;

  return (
    <aside
      className="h-full bg-notion-bg-secondary border-r border-notion-border flex flex-col"
      style={{ width }}
    >
      <nav className="flex-1 p-2 pt-3 space-y-2.5">
        {mainMenuItems.map((item) => {
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
        <div className="mx-2 my-1 border-t border-notion-border" />
        <button
          onClick={() => onSectionChange("settings")}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
            activeSection === "settings"
              ? "bg-notion-hover text-notion-text"
              : "text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text"
          }`}
        >
          <Settings size={18} />
          <span>{t("sidebar.settings")}</span>
        </button>
      </nav>
    </aside>
  );
}
