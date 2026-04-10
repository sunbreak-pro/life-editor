import { useState, useCallback } from "react";
import { FolderOpen, Folder, Plus, FolderPlus, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFileExplorerContext } from "../../hooks/useFileExplorerContext";
import type { FileEntry } from "../../types/fileExplorer";
import { getFileIcon } from "./fileIcons";

function FileListItem({
  entry,
  onSelect,
  isSelected,
}: {
  entry: FileEntry;
  onSelect: (entry: FileEntry) => void;
  isSelected: boolean;
}) {
  const Icon =
    entry.type === "directory"
      ? isSelected
        ? FolderOpen
        : Folder
      : getFileIcon(entry.extension);

  return (
    <button
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-notion-hover transition-colors ${
        isSelected
          ? "bg-notion-hover text-notion-text"
          : "text-notion-secondary"
      }`}
      onClick={() => onSelect(entry)}
      onDoubleClick={() => {
        if (entry.type !== "directory") onSelect(entry);
      }}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="truncate">{entry.name}</span>
    </button>
  );
}

export function FileExplorerSidebar() {
  const { t } = useTranslation();
  const {
    entries,
    selectedEntry,
    setSelectedEntry,
    navigateTo,
    refreshDirectory,
    createFolder,
    createFile,
    rootPath,
    isLoading,
    openTextFile,
    openBinaryFile,
  } = useFileExplorerContext();

  const [isCreating, setIsCreating] = useState<"file" | "folder" | null>(null);
  const [newName, setNewName] = useState("");

  const handleSelect = useCallback(
    (entry: FileEntry) => {
      if (entry.type === "directory") {
        navigateTo(entry.relativePath);
      } else {
        setSelectedEntry(entry);
        // Auto-open file
        const ext = entry.extension.toLowerCase();
        const textExts = new Set([
          ".txt",
          ".md",
          ".json",
          ".yaml",
          ".yml",
          ".toml",
          ".xml",
          ".csv",
          ".log",
          ".ts",
          ".tsx",
          ".js",
          ".jsx",
          ".html",
          ".css",
          ".scss",
          ".py",
          ".go",
          ".rs",
          ".java",
          ".c",
          ".cpp",
          ".h",
          ".sh",
          ".sql",
          ".env",
          ".gitignore",
          ".editorconfig",
        ]);
        if (textExts.has(ext)) {
          openTextFile(entry);
        } else {
          openBinaryFile(entry);
        }
      }
    },
    [navigateTo, setSelectedEntry, openTextFile, openBinaryFile],
  );

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

  if (!rootPath) {
    return (
      <div className="p-4 text-sm text-notion-secondary">
        <p>{t("files.noRootPath")}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-notion-border">
        <button
          className="p-1 rounded hover:bg-notion-hover text-notion-secondary"
          onClick={() => setIsCreating("file")}
          title={t("files.newFile")}
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          className="p-1 rounded hover:bg-notion-hover text-notion-secondary"
          onClick={() => setIsCreating("folder")}
          title={t("files.newFolder")}
        >
          <FolderPlus className="w-4 h-4" />
        </button>
        <button
          className="p-1 rounded hover:bg-notion-hover text-notion-secondary ml-auto"
          onClick={refreshDirectory}
          title={t("files.refresh")}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* New item input */}
      {isCreating && (
        <div className="px-2 py-1 border-b border-notion-border">
          <input
            type="text"
            className="w-full px-2 py-1 text-sm bg-notion-bg border border-notion-border rounded focus:outline-none focus:border-notion-primary"
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

      {/* File list */}
      <div className="flex-1 overflow-y-auto py-1">
        {entries.map((entry) => (
          <FileListItem
            key={entry.relativePath}
            entry={entry}
            onSelect={handleSelect}
            isSelected={selectedEntry?.relativePath === entry.relativePath}
          />
        ))}
        {entries.length === 0 && !isLoading && (
          <p className="px-4 py-2 text-sm text-notion-secondary">
            {t("files.emptyFolder")}
          </p>
        )}
      </div>
    </div>
  );
}
