import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Pencil,
  Trash2,
  Heart,
  HeartOff,
  ImageIcon,
  FileOutput,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { NoteNode } from "../../types/note";

interface MenuAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

interface NoteNodeContextMenuProps {
  x: number;
  y: number;
  node: NoteNode;
  onRename: () => void;
  onChangeIcon: () => void;
  onTogglePin: () => void;
  onCopyToFiles?: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function NoteNodeContextMenu({
  x,
  y,
  node,
  onRename,
  onChangeIcon,
  onCopyToFiles,
  onTogglePin,
  onDelete,
  onClose,
}: NoteNodeContextMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const isFolder = node.type === "folder";

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
    actions.push({
      label: t("contextMenu.changeIcon"),
      icon: <ImageIcon size={14} />,
      onClick: onChangeIcon,
    });
  }

  actions.push({
    label: node.isPinned ? t("contextMenu.unpin") : t("contextMenu.pin"),
    icon: node.isPinned ? <HeartOff size={14} /> : <Heart size={14} />,
    onClick: onTogglePin,
  });

  if (!isFolder && onCopyToFiles) {
    actions.push({
      label: t("contextMenu.copyToFiles"),
      icon: <FileOutput size={14} />,
      onClick: onCopyToFiles,
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
