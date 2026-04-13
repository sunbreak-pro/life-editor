import { useState, useCallback, useEffect, useRef } from "react";
import { getDataService } from "../../services/dataServiceFactory";
import { useToast } from "../../context/ToastContext";
import { useNoteContext } from "../../hooks/useNoteContext";
import { useMemoContext } from "../../hooks/useMemoContext";
import { DatePickerDialog } from "../shared/DatePickerDialog";
import {
  ChevronRight,
  Home,
  FolderOpen,
  Folder,
  Trash2,
  Pencil,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFileExplorerContext } from "../../hooks/useFileExplorerContext";
import type { FileEntry } from "../../types/fileExplorer";
import { getFileIcon, isTextFile, formatFileSize } from "./fileIcons";
import { FileEditor } from "./FileEditor";
import { FileContextMenu } from "./FileContextMenu";

function Breadcrumbs() {
  const { t } = useTranslation();
  const { breadcrumbs, navigateTo, navigateToRoot } = useFileExplorerContext();

  return (
    <div className="flex items-center gap-1 text-sm text-notion-secondary overflow-x-auto">
      <button
        className="p-1 rounded hover:bg-notion-hover shrink-0"
        onClick={navigateToRoot}
        title={t("files.root")}
      >
        <Home className="w-4 h-4" />
      </button>
      {breadcrumbs.map((crumb, i) => (
        <div key={crumb.path} className="flex items-center gap-1 shrink-0">
          <ChevronRight className="w-3 h-3" />
          <button
            className={`px-1 rounded hover:bg-notion-hover ${
              i === breadcrumbs.length - 1 ? "text-notion-text font-medium" : ""
            }`}
            onClick={() => navigateTo(crumb.path)}
          >
            {crumb.name}
          </button>
        </div>
      ))}
    </div>
  );
}

function FileGridItem({
  entry,
  onOpen,
  onRename,
  onDelete,
  isSelected,
  onSelect,
  onContextMenu,
  onDragStart,
}: {
  entry: FileEntry;
  onOpen: (entry: FileEntry) => void;
  onRename: (entry: FileEntry) => void;
  onDelete: (entry: FileEntry) => void;
  isSelected: boolean;
  onSelect: (entry: FileEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  onDragStart: (e: React.DragEvent, entry: FileEntry) => void;
}) {
  const Icon =
    entry.type === "directory" ? Folder : getFileIcon(entry.extension);

  return (
    <div
      className={`group relative flex flex-col items-center gap-1.5 p-3 rounded-lg cursor-pointer hover:bg-notion-hover transition-colors ${
        isSelected ? "bg-notion-hover ring-1 ring-notion-primary" : ""
      }`}
      onClick={() => onSelect(entry)}
      onDoubleClick={() => onOpen(entry)}
      onContextMenu={(e) => onContextMenu(e, entry)}
      draggable
      onDragStart={(e) => onDragStart(e, entry)}
    >
      <Icon className="w-10 h-10 text-notion-secondary" />
      <span className="text-xs text-notion-text text-center truncate w-full">
        {entry.name}
      </span>
      {entry.type === "file" && (
        <span className="text-[10px] text-notion-secondary">
          {formatFileSize(entry.size)}
        </span>
      )}
      {/* Actions on hover */}
      <div className="absolute top-1 right-1 hidden group-hover:flex gap-0.5">
        <button
          className="p-1 rounded hover:bg-notion-border text-notion-secondary"
          onClick={(e) => {
            e.stopPropagation();
            onRename(entry);
          }}
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-notion-secondary hover:text-red-500"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(entry);
          }}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function RenameDialog({
  entry,
  onConfirm,
  onCancel,
}: {
  entry: FileEntry;
  onConfirm: (newName: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(entry.name);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-notion-bg border border-notion-border rounded-lg p-4 w-80 shadow-lg">
        <h3 className="text-sm font-medium text-notion-text mb-3">
          {t("files.rename")}
        </h3>
        <input
          type="text"
          className="w-full px-3 py-2 text-sm bg-notion-bg border border-notion-border rounded-md focus:outline-none focus:border-notion-primary"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onConfirm(name.trim());
            if (e.key === "Escape") onCancel();
          }}
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-3">
          <button
            className="px-3 py-1.5 text-sm text-notion-secondary hover:text-notion-text"
            onClick={onCancel}
          >
            {t("common.cancel")}
          </button>
          <button
            className="px-3 py-1.5 text-sm bg-notion-primary text-white rounded-md hover:opacity-90"
            onClick={() => name.trim() && onConfirm(name.trim())}
          >
            {t("common.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FileExplorerView() {
  const { t } = useTranslation();
  const {
    entries,
    selectedEntry,
    setSelectedEntry,
    navigateTo,
    navigateUp,
    openFile,
    renameEntry,
    deleteEntry,
    moveEntry,
    openTextFile,
    openBinaryFile,
    openInSystem,
    rootPath,
    error,
    createFolder,
    createFile,
    currentPath,
  } = useFileExplorerContext();

  const [renamingEntry, setRenamingEntry] = useState<FileEntry | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: FileEntry | null;
  } | null>(null);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [isCreating, setIsCreating] = useState<"file" | "folder" | null>(null);
  const [newName, setNewName] = useState("");
  const [datePickerEntry, setDatePickerEntry] = useState<FileEntry | null>(
    null,
  );
  const gridRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const { createNote, updateNote } = useNoteContext();
  const { upsertMemo } = useMemoContext();

  const handleCopyToNote = useCallback(
    async (entry: FileEntry) => {
      try {
        const ds = getDataService();
        const { title, content } = await ds.convertFileToTiptap(
          entry.relativePath,
        );
        const noteId = createNote(title);
        await updateNote(noteId, { content });
        showToast("success", t("copy.copiedToNote", { title }));
      } catch (e) {
        showToast(
          "error",
          e instanceof Error ? e.message : t("copy.copyFailed"),
        );
      }
    },
    [createNote, updateNote, showToast, t],
  );

  const handleCopyToMemo = useCallback((entry: FileEntry) => {
    setDatePickerEntry(entry);
  }, []);

  const handleDatePickerConfirm = useCallback(
    async (date: string) => {
      if (!datePickerEntry) return;
      try {
        const ds = getDataService();
        const { content } = await ds.convertFileToTiptap(
          datePickerEntry.relativePath,
        );
        upsertMemo(date, content);
        showToast("success", t("copy.copiedToMemo", { date }));
      } catch (e) {
        showToast(
          "error",
          e instanceof Error ? e.message : t("copy.copyFailed"),
        );
      } finally {
        setDatePickerEntry(null);
      }
    },
    [datePickerEntry, upsertMemo, showToast, t],
  );

  const handleOpen = useCallback(
    (entry: FileEntry) => {
      if (entry.type === "directory") {
        navigateTo(entry.relativePath);
      } else {
        const ext = entry.extension.toLowerCase();
        if (isTextFile(ext)) {
          openTextFile(entry);
        } else {
          openBinaryFile(entry);
        }
      }
    },
    [navigateTo, openTextFile, openBinaryFile],
  );

  const handleRename = useCallback(
    async (newName: string) => {
      if (!renamingEntry) return;
      await renameEntry(renamingEntry.relativePath, newName);
      setRenamingEntry(null);
    },
    [renamingEntry, renameEntry],
  );

  const handleDelete = useCallback(
    async (entry: FileEntry) => {
      await deleteEntry(entry.relativePath);
    },
    [deleteEntry],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, entry: FileEntry | null) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, entry });
    },
    [],
  );

  const handleCopyPath = useCallback((entry: FileEntry) => {
    navigator.clipboard.writeText(entry.relativePath);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) {
      setIsCreating(null);
      return;
    }
    try {
      if (isCreating === "folder") {
        await createFolder(newName.trim());
      } else {
        await createFile(newName.trim());
      }
    } catch {
      // Error handled in context
    }
    setNewName("");
    setIsCreating(null);
  }, [newName, isCreating, createFolder, createFile]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if focus is in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      // Don't handle if file editor is open
      if (openFile) return;

      const selectedIdx = selectedEntry
        ? entries.findIndex(
            (en) => en.relativePath === selectedEntry.relativePath,
          )
        : -1;

      switch (e.key) {
        case "ArrowDown":
        case "ArrowRight": {
          e.preventDefault();
          const nextIdx =
            selectedIdx < entries.length - 1 ? selectedIdx + 1 : 0;
          setSelectedEntry(entries[nextIdx]);
          break;
        }
        case "ArrowUp":
        case "ArrowLeft": {
          e.preventDefault();
          const prevIdx =
            selectedIdx > 0 ? selectedIdx - 1 : entries.length - 1;
          setSelectedEntry(entries[prevIdx]);
          break;
        }
        case "Enter": {
          e.preventDefault();
          if (selectedEntry) handleOpen(selectedEntry);
          break;
        }
        case "Backspace": {
          e.preventDefault();
          navigateUp();
          break;
        }
        case "Delete": {
          if (selectedEntry) {
            e.preventDefault();
            handleDelete(selectedEntry);
          }
          break;
        }
        case "F2": {
          if (selectedEntry) {
            e.preventDefault();
            setRenamingEntry(selectedEntry);
          }
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    entries,
    selectedEntry,
    setSelectedEntry,
    handleOpen,
    handleDelete,
    navigateUp,
    openFile,
  ]);

  // Drag and drop handlers
  const handleDragStart = useCallback(
    (e: React.DragEvent, entry: FileEntry) => {
      e.dataTransfer.setData("text/plain", entry.relativePath);
      e.dataTransfer.setData("application/x-file-entry", JSON.stringify(entry));
      e.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDropTarget(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDropTarget(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDropTarget(false);

      const entryJson = e.dataTransfer.getData("application/x-file-entry");
      if (entryJson) {
        try {
          const entry = JSON.parse(entryJson) as FileEntry;
          const destDir = currentPath || "";
          const destPath = destDir ? `${destDir}/${entry.name}` : entry.name;
          if (entry.relativePath !== destPath) {
            await moveEntry(entry.relativePath, destPath);
          }
        } catch {
          // Ignore invalid drag data
        }
      }
    },
    [currentPath, moveEntry],
  );

  if (!rootPath) {
    return (
      <div className="h-full flex items-center justify-center text-notion-secondary">
        <div className="text-center">
          <FolderOpen className="w-12 h-12 mx-auto mb-3" />
          <p className="text-sm">{t("files.noRootPath")}</p>
          <p className="text-xs mt-1">{t("files.configureInSettings")}</p>
        </div>
      </div>
    );
  }

  // Show file editor/preview when a file is open
  if (openFile) {
    return <FileEditor />;
  }

  return (
    <div
      className={`h-full flex flex-col ${isDropTarget ? "ring-2 ring-notion-primary ring-inset" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={(e) => {
        // Background context menu (no entry)
        if (
          e.target === e.currentTarget ||
          gridRef.current?.contains(e.target as Node)
        ) {
          handleContextMenu(e, null);
        }
      }}
    >
      {/* Breadcrumbs */}
      <div className="px-4 py-2 border-b border-notion-border">
        <Breadcrumbs />
      </div>

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 text-sm text-red-500 bg-red-50 dark:bg-red-900/20">
          {error}
        </div>
      )}

      {/* New item input */}
      {isCreating && (
        <div className="px-4 py-2 border-b border-notion-border">
          <input
            type="text"
            className="w-full px-3 py-2 text-sm bg-notion-bg border border-notion-border rounded-md focus:outline-none focus:border-notion-primary"
            placeholder={
              isCreating === "folder"
                ? t("files.folderNamePlaceholder")
                : t("files.fileNamePlaceholder")
            }
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") {
                setIsCreating(null);
                setNewName("");
              }
            }}
            onBlur={handleCreate}
            autoFocus
          />
        </div>
      )}

      {/* File grid */}
      <div ref={gridRef} className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
          {entries.map((entry) => (
            <FileGridItem
              key={entry.relativePath}
              entry={entry}
              onOpen={handleOpen}
              onRename={setRenamingEntry}
              onDelete={handleDelete}
              isSelected={selectedEntry?.relativePath === entry.relativePath}
              onSelect={setSelectedEntry}
              onContextMenu={handleContextMenu}
              onDragStart={handleDragStart}
            />
          ))}
        </div>
        {entries.length === 0 && (
          <div className="flex items-center justify-center h-full text-notion-secondary">
            <p className="text-sm">{t("files.emptyFolder")}</p>
          </div>
        )}
      </div>

      {/* Rename dialog */}
      {renamingEntry && (
        <RenameDialog
          entry={renamingEntry}
          onConfirm={handleRename}
          onCancel={() => setRenamingEntry(null)}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entry={contextMenu.entry}
          onClose={() => setContextMenu(null)}
          onOpen={handleOpen}
          onOpenInSystem={(entry) => openInSystem(entry.relativePath)}
          onRename={setRenamingEntry}
          onDelete={handleDelete}
          onCopyPath={handleCopyPath}
          onCopyToNote={handleCopyToNote}
          onCopyToMemo={handleCopyToMemo}
          onNewFile={() => setIsCreating("file")}
          onNewFolder={() => setIsCreating("folder")}
        />
      )}

      {/* Date picker for copy to memo */}
      {datePickerEntry && (
        <DatePickerDialog
          onConfirm={handleDatePickerConfirm}
          onCancel={() => setDatePickerEntry(null)}
        />
      )}
    </div>
  );
}
