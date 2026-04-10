import { createContext } from "react";
import type { useFileExplorer } from "../hooks/useFileExplorer";

export type FileExplorerContextValue = ReturnType<typeof useFileExplorer>;

export const FileExplorerContext =
  createContext<FileExplorerContextValue | null>(null);
