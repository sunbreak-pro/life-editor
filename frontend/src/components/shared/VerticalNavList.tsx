import { useTranslation } from "react-i18next";
import type { TabItem } from "./SectionTabs";

interface VerticalNavListProps<T extends string> {
  items: readonly TabItem<T>[];
  activeItem: T;
  onItemChange: (item: T) => void;
  title?: string;
}

export function VerticalNavList<T extends string>({
  items,
  activeItem,
  onItemChange,
  title,
}: VerticalNavListProps<T>) {
  const { t } = useTranslation();

  return (
    <div className="p-3 space-y-0.5">
      {title && (
        <h3 className="text-[10px] font-semibold text-notion-text-secondary uppercase tracking-wider px-2 pb-1.5">
          {title}
        </h3>
      )}
      {items.map((item) => (
        <button
          key={item.id}
          data-sidebar-item
          data-sidebar-active={activeItem === item.id || undefined}
          className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded transition-colors ${
            activeItem === item.id
              ? "bg-notion-hover text-notion-text"
              : "text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text"
          }`}
          onClick={() => onItemChange(item.id)}
        >
          {item.icon && (
            <span className="shrink-0">
              <item.icon size={14} />
            </span>
          )}
          <span className="truncate">{t(item.labelKey)}</span>
        </button>
      ))}
    </div>
  );
}
