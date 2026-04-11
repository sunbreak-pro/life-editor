import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  Check,
  Circle,
  Pencil,
  StickyNote,
  Clock,
  Minus,
  Copy,
  CalendarDays,
  Link,
  RefreshCw,
  CopyPlus,
  Trash2,
  Bell,
  BellOff,
} from "lucide-react";

interface TimeGridContextMenuProps {
  position: { x: number; y: number };
  itemType: "schedule" | "task";
  isCompleted: boolean;
  isRoutine: boolean;
  onToggleComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddMemo: () => void;
  onExtend15: () => void;
  onShrink15: () => void;
  onCopyTime: () => void;
  onMoveToDay?: () => void;
  onLinkToTask?: () => void;
  onConvertToRoutine?: () => void;
  onDuplicate: () => void;
  onClose: () => void;
  reminderEnabled?: boolean;
  onToggleReminder?: () => void;
}

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  hidden?: boolean;
}

export function TimeGridContextMenu({
  position,
  itemType,
  isCompleted,
  isRoutine,
  onToggleComplete,
  onEdit,
  onDelete,
  onAddMemo,
  onExtend15,
  onShrink15,
  onCopyTime,
  onMoveToDay,
  onLinkToTask,
  onConvertToRoutine,
  onDuplicate,
  onClose,
  reminderEnabled,
  onToggleReminder,
}: TimeGridContextMenuProps) {
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

  const iconSize = 14;
  const iconClass = "text-notion-text-secondary shrink-0";

  const basicItems: MenuItem[] = [
    {
      icon: isCompleted ? (
        <Circle size={iconSize} className={iconClass} />
      ) : (
        <Check size={iconSize} className={iconClass} />
      ),
      label: isCompleted
        ? t("timeGridContextMenu.uncomplete", "Mark incomplete")
        : t("timeGridContextMenu.complete", "Complete"),
      onClick: onToggleComplete,
    },
    {
      icon: <Pencil size={iconSize} className={iconClass} />,
      label: t("timeGridContextMenu.edit", "Edit"),
      onClick: onEdit,
    },
    {
      icon: <StickyNote size={iconSize} className={iconClass} />,
      label: t("timeGridContextMenu.addMemo", "Add memo"),
      onClick: onAddMemo,
    },
  ];

  const timeItems: MenuItem[] = [
    {
      icon: <Clock size={iconSize} className={iconClass} />,
      label: t("timeGridContextMenu.extend15", "+15 min"),
      onClick: onExtend15,
    },
    {
      icon: <Minus size={iconSize} className={iconClass} />,
      label: t("timeGridContextMenu.shrink15", "-15 min"),
      onClick: onShrink15,
    },
    {
      icon: <Copy size={iconSize} className={iconClass} />,
      label: t("timeGridContextMenu.copyTime", "Copy time"),
      onClick: onCopyTime,
    },
    {
      icon: <CalendarDays size={iconSize} className={iconClass} />,
      label: t("timeGridContextMenu.moveToDay", "Move to another day"),
      onClick: onMoveToDay ?? onClose,
      hidden: !onMoveToDay,
    },
  ];

  const reminderItem: MenuItem = {
    icon: reminderEnabled ? (
      <BellOff size={iconSize} className={iconClass} />
    ) : (
      <Bell size={iconSize} className={iconClass} />
    ),
    label: reminderEnabled
      ? t("reminders.removeReminder", "Remove Reminder")
      : t("reminders.setReminder", "Set Reminder"),
    onClick: onToggleReminder ?? onClose,
    hidden: !onToggleReminder,
  };

  const advancedItems: MenuItem[] = [
    reminderItem,
    {
      icon: <Link size={iconSize} className={iconClass} />,
      label: t("timeGridContextMenu.linkToTask", "Link to task"),
      onClick: onLinkToTask ?? onClose,
      hidden: itemType !== "schedule" || !onLinkToTask,
    },
    {
      icon: <RefreshCw size={iconSize} className={iconClass} />,
      label: t("timeGridContextMenu.convertToRoutine", "Convert to routine"),
      onClick: onConvertToRoutine ?? onClose,
      hidden: itemType !== "schedule" || isRoutine || !onConvertToRoutine,
    },
    {
      icon: <CopyPlus size={iconSize} className={iconClass} />,
      label: t("timeGridContextMenu.duplicate", "Duplicate"),
      onClick: onDuplicate,
    },
  ];

  const deleteItem: MenuItem = {
    icon: <Trash2 size={iconSize} className="text-red-500 shrink-0" />,
    label: t("timeGridContextMenu.delete", "Delete"),
    onClick: onDelete,
    danger: true,
  };

  const renderItems = (items: MenuItem[]) =>
    items
      .filter((item) => !item.hidden)
      .map((item) => (
        <button
          key={item.label}
          onClick={(e) => {
            e.stopPropagation();
            item.onClick();
            onClose();
          }}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors text-left ${
            item.danger
              ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
              : "text-notion-text hover:bg-notion-hover"
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ));

  const menuWidth = 200;
  const menuHeight = 360;
  const left = Math.min(position.x, window.innerWidth - menuWidth - 8);
  const top = Math.min(position.y, window.innerHeight - menuHeight - 8);

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[60] bg-notion-bg border border-notion-border rounded-lg shadow-xl overflow-hidden py-1"
      style={{ top, left, width: menuWidth }}
    >
      {renderItems(basicItems)}
      <div className="h-px bg-notion-border my-1" />
      {renderItems(timeItems)}
      <div className="h-px bg-notion-border my-1" />
      {renderItems(advancedItems.filter((i) => !i.hidden))}
      {advancedItems.some((i) => !i.hidden) && (
        <div className="h-px bg-notion-border my-1" />
      )}
      {renderItems([deleteItem])}
    </div>,
    document.body,
  );
}
