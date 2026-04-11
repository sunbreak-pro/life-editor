import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Pencil, Trash2, EyeOff } from "lucide-react";

interface GroupContextMenuProps {
  position: { x: number; y: number };
  onEdit?: () => void;
  onDismissToday?: () => void;
  onDeleteGroup?: () => void;
  onClose: () => void;
}

export function GroupContextMenu({
  position,
  onEdit,
  onDismissToday,
  onDeleteGroup,
  onClose,
}: GroupContextMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const menuWidth = 200;
  const menuHeight = 140;
  const left = Math.min(position.x, window.innerWidth - menuWidth - 8);
  const top = Math.min(position.y, window.innerHeight - menuHeight - 8);
  const iconSize = 14;
  const iconClass = "text-notion-text-secondary shrink-0";

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[60] bg-notion-bg border border-notion-border rounded-lg shadow-xl overflow-hidden py-1"
      style={{ top, left, width: menuWidth }}
    >
      {onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-notion-text hover:bg-notion-hover transition-colors text-left"
        >
          <Pencil size={iconSize} className={iconClass} />
          {t("groupContextMenu.edit", "Edit group")}
        </button>
      )}
      {onDismissToday && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismissToday();
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-notion-text hover:bg-notion-hover transition-colors text-left"
        >
          <EyeOff size={iconSize} className={iconClass} />
          {t("groupContextMenu.dismissToday", "Dismiss today")}
        </button>
      )}
      {(onEdit || onDismissToday) && onDeleteGroup && (
        <div className="h-px bg-notion-border my-1" />
      )}
      {onDeleteGroup && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteGroup();
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left"
        >
          <Trash2 size={iconSize} className="text-red-500 shrink-0" />
          {t("groupContextMenu.deleteGroup", "Delete group")}
        </button>
      )}
    </div>,
    document.body,
  );
}
