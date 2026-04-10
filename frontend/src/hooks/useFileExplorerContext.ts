import { FileExplorerContext } from "../context/FileExplorerContextValue";
import { createContextHook } from "./createContextHook";

export const useFileExplorerContext = createContextHook(
  FileExplorerContext,
  "useFileExplorerContext",
);
