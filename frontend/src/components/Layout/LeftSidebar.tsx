import {
  CheckSquare,
  Calendar,
  Lightbulb,
  Play,
  BarChart3,
  Settings,
  Pencil,
  BookOpen,
  Terminal,
} from "lucide-react";
import type { SectionId } from "../../types/taskTree";
import type { LayoutHandle } from "./Layout";
import { useTimerContext } from "../../hooks/useTimerContext";
import { useTranslation } from "react-i18next";

interface SidebarProps {
  width: number;
  activeSection: SectionId;
  onSectionChange: (section: SectionId) => void;
  layoutRef: React.RefObject<LayoutHandle | null>;
}

const mainMenuItems: {
  id: SectionId;
  labelKey: string;
  icon: typeof CheckSquare;
}[] = [
  { id: "schedule", labelKey: "sidebar.schedule", icon: Calendar },
  { id: "materials", labelKey: "sidebar.materials", icon: BookOpen },
  { id: "connect", labelKey: "sidebar.connect", icon: Lightbulb },
  { id: "work", labelKey: "sidebar.work", icon: Play },
  { id: "analytics", labelKey: "sidebar.analytics", icon: BarChart3 },
];

export function LeftSidebar({
  width,
  activeSection,
  onSectionChange,
  layoutRef,
}: SidebarProps) {
  const timer = useTimerContext();
  const { t } = useTranslation();
  const showTimer = timer.activeTask !== null || timer.isRunning;

  return (
    <aside
      className="h-full bg-notion-bg-subsidebar border-r border-notion-border flex flex-col transition-colors"
      style={{ width }}
    >
      <nav className="flex-1 p-3 pt-5 space-y-2 overflow-y-auto">
        {mainMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <div key={item.id}>
              <button
                onClick={() => onSectionChange(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-scaling-sm transition-all duration-200 ${
                  isActive
                    ? "bg-notion-hover text-notion-text font-medium"
                    : "text-notion-text-secondary hover:bg-notion-hover/80 hover:text-notion-text"
                }`}
              >
                <Icon
                  size={18}
                  className={`transition-colors ${isActive ? "text-notion-accent" : ""}`}
                />
                <span>{t(item.labelKey)}</span>
              </button>

              {item.id === "work" && showTimer && (
                <div className="ml-3 mr-2 mb-2 mt-1 px-3 py-2.5 rounded-lg bg-notion-hover/50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-scaling-xs text-notion-text-secondary truncate">
                        {timer.activeTask?.title ?? t("sidebar.freeSession")}
                      </p>
                      <p className="text-scaling-sm font-mono font-medium tabular-nums text-notion-accent mt-0.5">
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
      <div className="px-3 pb-2 border-t border-notion-border pt-2">
        <AIActionsPanel activeSection={activeSection} layoutRef={layoutRef} />
      </div>
      <div className="p-3 border-t border-notion-border">
        <button
          onClick={() => onSectionChange("settings")}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-scaling-sm transition-all duration-200 ${
            activeSection === "settings"
              ? "bg-notion-hover text-notion-text font-medium"
              : "text-notion-text-secondary hover:bg-notion-hover/80 hover:text-notion-text"
          }`}
        >
          <Settings size={18} />
          <span>{t("sidebar.settings")}</span>
        </button>
      </div>
    </aside>
  );
}
