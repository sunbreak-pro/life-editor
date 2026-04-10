import type { ReactNode } from "react";
import { useFileExplorer } from "../hooks/useFileExplorer";
import { FileExplorerContext } from "./FileExplorerContextValue";

export function FileExplorerProvider({ children }: { children: ReactNode }) {
  const fileExplorerState = useFileExplorer();
  return (
    <FileExplorerContext.Provider value={fileExplorerState}>
      {children}
    </FileExplorerContext.Provider>
  );
}
