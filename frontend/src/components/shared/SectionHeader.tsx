import { useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SectionTabs, type TabItem } from "./SectionTabs";
import { HeaderPortalContext } from "../Layout/HeaderPortalContext";

interface SectionHeaderProps<T extends string> {
  title: string;
  tabs?: readonly TabItem<T>[];
  rightTabs?: readonly TabItem<T>[];
  activeTab?: T;
  onTabChange?: (tab: T) => void;
  actions?: ReactNode;
}

export function SectionHeader<T extends string>({
  title,
  tabs,
  rightTabs,
  activeTab,
  onTabChange,
  actions,
}: SectionHeaderProps<T>) {
  const portalTarget = useContext(HeaderPortalContext);

  const hasTabs = tabs && activeTab !== undefined && onTabChange;

  const content = (
    <>
      <span className="text-sm font-semibold text-notion-text whitespace-nowrap">
        {title}
      </span>
      {hasTabs && (
        <SectionTabs
          tabs={tabs}
          rightTabs={rightTabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
          noBorder
          size="sm"
        />
      )}
      {actions && <div className="ml-auto flex items-center">{actions}</div>}
    </>
  );

  if (portalTarget) {
    return createPortal(
      <div className="titlebar-nodrag flex items-center gap-3 h-full">
        {content}
      </div>,
      portalTarget,
    );
  }

  // Fallback: render in-place
  return (
    <div
      className={`flex items-baseline gap-4 border-b border-notion-border mb-5${hasTabs ? "" : " pb-3"}`}
    >
      <h2 className="text-2xl font-bold text-notion-text">{title}</h2>
      {hasTabs && (
        <SectionTabs
          tabs={tabs}
          rightTabs={rightTabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
          noBorder
        />
      )}
      {actions && <div className="ml-auto flex items-center">{actions}</div>}
    </div>
  );
}
