import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Pencil,
  Plus,
  LucideFolderPlus,
  Play,
  ArrowUp,
  Trash2,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { useTranslation } from "react-i18next";

interface MenuAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

interface TaskNodeContextMenuProps {
  x: number;
  y: number;
  isFolder: boolean;
  isDone: boolean;
  isFolderDone?: boolean;
  hasParent: boolean;
  onRename: () => void;
  onAddTask: () => void;
  onAddFolder: () => void;
  onStartTimer: () => void;
  onMoveToRoot: () => void;
  onCompleteFolder?: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function TaskNodeContextMenu({
  x,
  y,
  isFolder,
  isDone,
  isFolderDone,
  hasParent,
  onRename,
  onAddTask,
  onAddFolder,
  onStartTimer,
  onMoveToRoot,
  onCompleteFolder,
  onDelete,
  onClose,
}: TaskNodeContextMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (rect.right > vw) {
      menuRef.current.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > vh) {
      menuRef.current.style.top = `${y - rect.height}px`;
    }
  }, [x, y]);

  const actions: (MenuAction | "separator")[] = [
    {
      label: t("contextMenu.rename"),
      icon: <Pencil size={14} />,
      onClick: onRename,
    },
  ];

  if (isFolder) {
    actions.push(
      {
        label: t("contextMenu.addTask"),
        icon: <Plus size={14} />,
        onClick: onAddTask,
      },
      {
        label: t("contextMenu.addFolder"),
        icon: <LucideFolderPlus size={14} />,
        onClick: onAddFolder,
      },
    );
    if (onCompleteFolder) {
      actions.push({
        label: isFolderDone
          ? t("contextMenu.markIncomplete")
          : t("contextMenu.completeFolder"),
        icon: isFolderDone ? (
          <RotateCcw size={14} />
        ) : (
          <CheckCircle2 size={14} />
        ),
        onClick: onCompleteFolder,
      });
    }
  }

  if (!isFolder && !isDone) {
    actions.push({
      label: t("contextMenu.startTimer"),
      icon: <Play size={14} />,
      onClick: onStartTimer,
    });
  }

  if (hasParent) {
    actions.push("separator", {
      label: t("contextMenu.moveToRoot"),
      icon: <ArrowUp size={14} />,
      onClick: onMoveToRoot,
    });
  }

  actions.push("separator", {
    label: t("contextMenu.delete"),
    icon: <Trash2 size={14} />,
    onClick: onDelete,
    danger: true,
  });

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 min-w-40 py-1 bg-notion-bg border border-notion-border rounded-lg shadow-lg"
      style={{ left: x, top: y }}
    >
      {actions.map((action, i) => {
        if (action === "separator") {
          return (
            <div
              key={`sep-${i}`}
              className="my-1 border-t border-notion-border"
            />
          );
        }
        return (
          <button
            key={action.label}
            onClick={() => {
              action.onClick();
              onClose();
            }}
            className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm transition-colors ${
              action.danger
                ? "text-notion-danger hover:bg-notion-danger/10"
                : "text-notion-text hover:bg-notion-hover"
            }`}
          >
            {action.icon}
            {action.label}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
