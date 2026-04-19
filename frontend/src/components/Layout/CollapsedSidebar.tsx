import {
  CheckSquare,
  Calendar,
  Lightbulb,
  Play,
  BarChart3,
  Settings,
  BookOpen,
} from "lucide-react";
import type { SectionId } from "../../types/taskTree";
import { useTranslation } from "react-i18next";

interface CollapsedSidebarProps {
  activeSection: SectionId;
  onSectionChange: (section: SectionId) => void;
  onToggleTips: () => void;
  tipsOpen: boolean;
}

const mainItems: {
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

export function CollapsedSidebar({
  activeSection,
  onSectionChange,
  onToggleTips,
  tipsOpen,
}: CollapsedSidebarProps) {
  const { t } = useTranslation();

  return (
    <div className="h-full bg-notion-bg-subsidebar border-r border-notion-border flex flex-col items-center py-2 shrink-0 w-12">
      <nav className="flex-1 flex flex-col items-center gap-0.5">
        {mainItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              title={t(item.labelKey)}
              onClick={() => onSectionChange(item.id)}
              className={`p-2 rounded-md transition-colors ${
                isActive
                  ? "bg-notion-hover text-notion-text"
                  : "text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
              }`}
            >
              <Icon size={18} />
            </button>
          );
        })}
      </nav>
      <div className="flex flex-col items-center gap-0.5 border-t border-notion-border pt-2">
        <button
          title={t("tips.panel.title")}
          onClick={onToggleTips}
          aria-pressed={tipsOpen}
          className={`p-2 rounded-md transition-colors ${
            tipsOpen
              ? "bg-notion-hover text-notion-text"
              : "text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
          }`}
        >
          <Lightbulb size={18} />
        </button>
        <button
          title={t("sidebar.settings")}
          onClick={() => onSectionChange("settings")}
          className={`p-2 rounded-md transition-colors ${
            activeSection === "settings"
              ? "text-notion-text"
              : "text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
          }`}
        >
          <Settings size={18} />
        </button>
      </div>
    </div>
  );
}
