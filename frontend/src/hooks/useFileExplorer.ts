import { useState, useCallback, useEffect, useRef } from "react";
import { getDataService } from "../services/dataServiceFactory";
import type { FileEntry, FileInfo } from "../types/fileExplorer";

export function useFileExplorer() {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<FileEntry | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For open file content
  const [openFile, setOpenFile] = useState<{
    path: string;
    content: string;
    info: FileInfo;
  } | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ds = getDataService();

  // Load root path from settings
  useEffect(() => {
    ds.getFilesRootPath().then((p) => setRootPath(p));
  }, []);

  // Load directory listing
  const loadDirectory = useCallback(
    async (relativePath: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const list = await ds.listDirectory(relativePath);
        setEntries(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setEntries([]);
      } finally {
        setIsLoading(false);
      }
    },
    [ds],
  );

  // Load on currentPath change
  useEffect(() => {
    if (rootPath) {
      loadDirectory(currentPath);
    }
  }, [currentPath, rootPath, loadDirectory]);

  // Subscribe to file system changes from main process
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onFileChange) return;

    const unsubscribe = api.onFileChange((changes) => {
      // Check if any change affects the current directory
      const currentDir = currentPath || "";
      const shouldRefresh = changes.some((c) => {
        const dir = c.path.includes("/")
          ? c.path.substring(0, c.path.lastIndexOf("/"))
          : "";
        return dir === currentDir || c.path.startsWith(currentDir + "/");
      });
      if (shouldRefresh) {
        loadDirectory(currentPath);
      }
    });

    return unsubscribe;
  }, [currentPath, loadDirectory]);

  const navigateTo = useCallback((path: string) => {
    setCurrentPath(path);
    setSelectedEntry(null);
    setOpenFile(null);
    setIsDirty(false);
  }, []);

  const navigateUp = useCallback(() => {
    if (!currentPath) return;
    const parts = currentPath.split("/");
    parts.pop();
    navigateTo(parts.join("/"));
  }, [currentPath, navigateTo]);

  const navigateToRoot = useCallback(() => {
    navigateTo("");
  }, [navigateTo]);

  const refreshDirectory = useCallback(() => {
    loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  const toggleExpanded = useCallback((folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  }, []);

  // File operations
  const createFolder = useCallback(
    async (name: string) => {
      const newPath = currentPath ? `${currentPath}/${name}` : name;
      await ds.createDirectory(newPath);
      refreshDirectory();
    },
    [currentPath, ds, refreshDirectory],
  );

  const createFile = useCallback(
    async (name: string) => {
      const newPath = currentPath ? `${currentPath}/${name}` : name;
      await ds.createFile(newPath);
      refreshDirectory();
    },
    [currentPath, ds, refreshDirectory],
  );

  const renameEntry = useCallback(
    async (oldRelPath: string, newName: string) => {
      const parts = oldRelPath.split("/");
      parts[parts.length - 1] = newName;
      const newRelPath = parts.join("/");
      await ds.renameFile(oldRelPath, newRelPath);
      refreshDirectory();
    },
    [ds, refreshDirectory],
  );

  const deleteEntry = useCallback(
    async (relativePath: string) => {
      await ds.deleteFile(relativePath);
      if (openFile?.path === relativePath) {
        setOpenFile(null);
        setIsDirty(false);
      }
      if (selectedEntry?.relativePath === relativePath) {
        setSelectedEntry(null);
      }
      refreshDirectory();
    },
    [ds, refreshDirectory, openFile, selectedEntry],
  );

  const moveEntry = useCallback(
    async (sourcePath: string, destPath: string) => {
      await ds.moveFile(sourcePath, destPath);
      refreshDirectory();
    },
    [ds, refreshDirectory],
  );

  const openInSystem = useCallback(
    async (relativePath: string) => {
      await ds.openFileInSystem(relativePath);
    },
    [ds],
  );

  // File content operations
  const openTextFile = useCallback(
    async (entry: FileEntry) => {
      setIsLoading(true);
      try {
        const [content, info] = await Promise.all([
          ds.readTextFile(entry.relativePath),
          ds.getFileInfo(entry.relativePath),
        ]);
        setOpenFile({ path: entry.relativePath, content, info });
        setIsDirty(false);
        setSelectedEntry(entry);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsLoading(false);
      }
    },
    [ds],
  );

  const openBinaryFile = useCallback(
    async (entry: FileEntry) => {
      setIsLoading(true);
      try {
        const info = await ds.getFileInfo(entry.relativePath);
        setOpenFile({ path: entry.relativePath, content: "", info });
        setIsDirty(false);
        setSelectedEntry(entry);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsLoading(false);
      }
    },
    [ds],
  );

  const updateFileContent = useCallback(
    (content: string) => {
      if (!openFile) return;
      setOpenFile((prev) => (prev ? { ...prev, content } : null));
      setIsDirty(true);

      // Auto-save with debounce
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await ds.writeTextFile(openFile.path, content);
          setIsDirty(false);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }, 2000);
    },
    [openFile, ds],
  );

  const saveCurrentFile = useCallback(async () => {
    if (!openFile || !isDirty) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    try {
      await ds.writeTextFile(openFile.path, openFile.content);
      setIsDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [openFile, isDirty, ds]);

  const closeFile = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setOpenFile(null);
    setIsDirty(false);
  }, []);

  // Breadcrumb
  const breadcrumbs = currentPath
    ? currentPath.split("/").map((part, i, arr) => ({
        name: part,
        path: arr.slice(0, i + 1).join("/"),
      }))
    : [];

  return {
    rootPath,
    setRootPath,
    currentPath,
    entries,
    selectedEntry,
    setSelectedEntry,
    expandedFolders,
    toggleExpanded,
    isLoading,
    error,
    openFile,
    isDirty,
    breadcrumbs,
    navigateTo,
    navigateUp,
    navigateToRoot,
    refreshDirectory,
    createFolder,
    createFile,
    renameEntry,
    deleteEntry,
    moveEntry,
    openInSystem,
    openTextFile,
    openBinaryFile,
    updateFileContent,
    saveCurrentFile,
    closeFile,
  };
}
