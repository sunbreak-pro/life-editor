import { useEffect, useRef } from "react";
import {
  FolderOpen,
  ExternalLink,
  Pencil,
  Trash2,
  Copy,
  FilePlus,
  FolderPlus,
  StickyNote,
  BookOpen,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FileEntry } from "../../types/fileExplorer";

interface FileContextMenuProps {
  x: number;
  y: number;
  entry: FileEntry | null;
  onClose: () => void;
  onOpen: (entry: FileEntry) => void;
  onOpenInSystem: (entry: FileEntry) => void;
  onRename: (entry: FileEntry) => void;
  onDelete: (entry: FileEntry) => void;
  onCopyPath: (entry: FileEntry) => void;
  onCopyToNote?: (entry: FileEntry) => void;
  onCopyToMemo?: (entry: FileEntry) => void;
  onNewFile: () => void;
  onNewFolder: () => void;
}

interface MenuItemProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

function MenuItem({ icon: Icon, label, onClick, danger }: MenuItemProps) {
  return (
    <button
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
        danger
          ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
          : "text-notion-text hover:bg-notion-hover"
      }`}
      onClick={onClick}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}

function Separator() {
  return <div className="my-1 border-t border-notion-border" />;
}

export function FileContextMenu({
  x,
  y,
  entry,
  onClose,
  onOpen,
  onOpenInSystem,
  onRename,
  onDelete,
  onCopyPath,
  onCopyToNote,
  onCopyToMemo,
  onNewFile,
  onNewFolder,
}: FileContextMenuProps) {
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

  // Adjust position to keep menu in viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menuRef.current.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menuRef.current.style.top = `${y - rect.height}px`;
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-notion-bg border border-notion-border rounded-lg shadow-lg py-1 min-w-[180px]"
      style={{ left: x, top: y }}
    >
      {entry && (
        <>
          <MenuItem
            icon={FolderOpen}
            label={t("files.open")}
            onClick={() => {
              onOpen(entry);
              onClose();
            }}
          />
          <MenuItem
            icon={ExternalLink}
            label={t("files.openInSystem")}
            onClick={() => {
              onOpenInSystem(entry);
              onClose();
            }}
          />
          <Separator />
          <MenuItem
            icon={Pencil}
            label={t("files.rename")}
            onClick={() => {
              onRename(entry);
              onClose();
            }}
          />
          <MenuItem
            icon={Copy}
            label={t("files.copyPath")}
            onClick={() => {
              onCopyPath(entry);
              onClose();
            }}
          />
          {entry.extension === ".md" && onCopyToNote && onCopyToMemo && (
            <>
              <Separator />
              <MenuItem
                icon={StickyNote}
                label={t("copy.copyToNote")}
                onClick={() => {
                  onCopyToNote(entry);
                  onClose();
                }}
              />
              <MenuItem
                icon={BookOpen}
                label={t("copy.copyToMemo")}
                onClick={() => {
                  onCopyToMemo(entry);
                  onClose();
                }}
              />
            </>
          )}
          <Separator />
          <MenuItem
            icon={Trash2}
            label={t("files.delete")}
            onClick={() => {
              onDelete(entry);
              onClose();
            }}
            danger
          />
          <Separator />
        </>
      )}
      <MenuItem
        icon={FilePlus}
        label={t("files.newFile")}
        onClick={() => {
          onNewFile();
          onClose();
        }}
      />
      <MenuItem
        icon={FolderPlus}
        label={t("files.newFolder")}
        onClick={() => {
          onNewFolder();
          onClose();
        }}
      />
    </div>
  );
}
