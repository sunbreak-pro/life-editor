import { createPortal } from "react-dom";
import type { ReactNode } from "react";

export interface MobileActionSheetItem {
  id: string;
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

interface MobileActionSheetProps {
  isOpen: boolean;
  title?: string;
  items: MobileActionSheetItem[];
  onClose: () => void;
}

export function MobileActionSheet({
  isOpen,
  title,
  items,
  onClose,
}: MobileActionSheetProps) {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
      onClick={onClose}
    >
      <div
        className="rounded-t-2xl bg-notion-bg pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="border-b border-notion-border px-4 py-3 text-center text-xs font-medium text-notion-text-secondary">
            {title}
          </div>
        )}
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  item.onSelect();
                  onClose();
                }}
                className={`flex w-full items-center gap-3 border-b border-notion-border px-4 py-3.5 text-left text-sm transition-colors active:bg-notion-hover disabled:opacity-40 ${
                  item.destructive ? "text-red-500" : "text-notion-text"
                }`}
              >
                {item.icon && (
                  <span className="shrink-0 text-notion-text-secondary">
                    {item.icon}
                  </span>
                )}
                <span className="flex-1">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3.5 text-center text-sm font-medium text-notion-accent"
        >
          Cancel
        </button>
      </div>
    </div>,
    document.body,
  );
}
