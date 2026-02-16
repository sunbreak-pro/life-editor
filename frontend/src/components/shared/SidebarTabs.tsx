import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface SidebarTabItem<T extends string = string> {
  id: T;
  labelKey: string;
  icon: LucideIcon;
}

interface SidebarTabsProps<T extends string> {
  tabs: readonly SidebarTabItem<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
}

export function SidebarTabs<T extends string>({
  tabs,
  activeTab,
  onTabChange,
}: SidebarTabsProps<T>) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-0.5 mx-3 mb-2 border-b border-notion-border">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? "text-notion-accent border-b-2 border-notion-accent"
                : "text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover rounded-t-md"
            }`}
          >
            <Icon size={12} />
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
