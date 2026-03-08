import { CheckSquare, BookOpen, Play, BarChart3, Settings } from "lucide-react";
import type { SectionId } from "../../types/taskTree";
import { useTranslation } from "react-i18next";

interface CollapsedSidebarProps {
  activeSection: SectionId;
  onSectionChange: (section: SectionId) => void;
}

const mainItems: {
  id: SectionId;
  labelKey: string;
  icon: typeof CheckSquare;
}[] = [
  { id: "tasks", labelKey: "sidebar.tasks", icon: CheckSquare },
  { id: "memo", labelKey: "sidebar.memo", icon: BookOpen },
  { id: "work", labelKey: "sidebar.work", icon: Play },
  { id: "analytics", labelKey: "sidebar.analytics", icon: BarChart3 },
];

export function CollapsedSidebar({
  activeSection,
  onSectionChange,
}: CollapsedSidebarProps) {
  const { t } = useTranslation();

  return (
    <div className="h-full bg-notion-bg-secondary border-r border-notion-border flex flex-col items-center py-2 shrink-0 w-12">
      <nav className="flex-1 flex flex-col items-center gap-1">
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
      <div className="flex flex-col items-center gap-1 border-t border-notion-border pt-2">
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
