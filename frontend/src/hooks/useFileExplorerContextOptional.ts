import { FileExplorerContext } from "../context/FileExplorerContextValue";
import { createOptionalContextHook } from "./createOptionalContextHook";

export const useFileExplorerContextOptional =
  createOptionalContextHook(FileExplorerContext);
