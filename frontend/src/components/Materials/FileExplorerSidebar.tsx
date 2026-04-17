import { useState, useCallback } from "react";
import {
  FolderOpen,
  Folder,
  Plus,
  FolderPlus,
  RefreshCw,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFileExplorerContext } from "../../hooks/useFileExplorerContext";
import { getDataService } from "../../services/dataServiceFactory";
import type { FileEntry } from "../../types/fileExplorer";
import { getFileIcon } from "./fileIcons";

function FileTreeNode({
  entry,
  depth,
  isSelected,
  onSelect,
  onNavigate,
}: {
  entry: FileEntry;
  depth: number;
  isSelected: boolean;
  onSelect: (entry: FileEntry) => void;
  onNavigate: (path: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  const isDir = entry.type === "directory";
  const Icon = isDir
    ? isExpanded
      ? FolderOpen
      : Folder
    : getFileIcon(entry.extension);

  const handleToggle = useCallback(async () => {
    if (!isDir) return;
    if (!loaded) {
      try {
        const entries = await getDataService().listDirectory(
          entry.relativePath,
        );
        setChildren(
          entries.sort((a, b) => {
            if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
            return a.name.localeCompare(b.name);
          }),
        );
        setLoaded(true);
      } catch {
        setChildren([]);
        setLoaded(true);
      }
    }
    setIsExpanded((v) => !v);
  }, [isDir, loaded, entry.relativePath]);

  const handleClick = useCallback(() => {
    if (isDir) {
      handleToggle();
    } else {
      onSelect(entry);
    }
  }, [isDir, handleToggle, onSelect, entry]);

  const handleDoubleClick = useCallback(() => {
    if (isDir) {
      onNavigate(entry.relativePath);
    }
  }, [isDir, onNavigate, entry.relativePath]);

  return (
    <div>
      <button
        className={`w-full flex items-center gap-1.5 py-1 pr-2 text-sm rounded-md hover:bg-notion-hover transition-colors ${
          isSelected
            ? "bg-notion-hover text-notion-text"
            : "text-notion-secondary"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {isDir && (
          <span className="shrink-0 w-3.5">
            {isExpanded ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
          </span>
        )}
        {!isDir && <span className="shrink-0 w-3.5" />}
        <Icon className="w-4 h-4 shrink-0" />
        <span className="truncate">{entry.name}</span>
      </button>
      {isDir && isExpanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <FileTreeNode
              key={child.relativePath}
              entry={child}
              depth={depth + 1}
              isSelected={false}
              onSelect={onSelect}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
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
      setSelectedEntry(entry);
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
    },
    [setSelectedEntry, openTextFile, openBinaryFile],
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

  // Sort: directories first, then alphabetical
  const sortedEntries = [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

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

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {sortedEntries.map((entry) => (
          <FileTreeNode
            key={entry.relativePath}
            entry={entry}
            depth={0}
            isSelected={selectedEntry?.relativePath === entry.relativePath}
            onSelect={handleSelect}
            onNavigate={navigateTo}
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
