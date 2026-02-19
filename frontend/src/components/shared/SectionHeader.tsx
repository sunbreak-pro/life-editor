import type { ReactNode } from "react";
import { SectionTabs, type TabItem } from "./SectionTabs";

interface SectionHeaderProps<T extends string> {
  title: string;
  tabs?: readonly TabItem<T>[];
  activeTab?: T;
  onTabChange?: (tab: T) => void;
  actions?: ReactNode;
}

export function SectionHeader<T extends string>({
  title,
  tabs,
  activeTab,
  onTabChange,
  actions,
}: SectionHeaderProps<T>) {
  if (tabs && activeTab !== undefined && onTabChange) {
    return (
      <div className="flex items-baseline gap-4 border-b border-notion-border mb-5">
        <h2 className="text-2xl font-bold text-notion-text">{title}</h2>
        <SectionTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
          noBorder
        />
        {actions && <div className="ml-auto flex items-center">{actions}</div>}
      </div>
    );
  }

  return (
    <div className="flex items-baseline gap-4 border-b border-notion-border mb-5 pb-3">
      <h2 className="text-2xl font-bold text-notion-text">{title}</h2>
      {actions && <div className="ml-auto flex items-center">{actions}</div>}
    </div>
  );
}
