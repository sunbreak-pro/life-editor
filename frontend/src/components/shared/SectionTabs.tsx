import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface TabItem<T extends string = string> {
  id: T;
  labelKey: string;
  icon?: LucideIcon;
}

interface SectionTabsProps<T extends string> {
  tabs: readonly TabItem<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
}

export function SectionTabs<T extends string>({
  tabs,
  activeTab,
  onTabChange,
}: SectionTabsProps<T>) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-1 border-b border-notion-border">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
              isActive
                ? "text-notion-text border-b-2 border-notion-accent"
                : "text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
            }`}
          >
            {Icon && <Icon size={14} />}
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
