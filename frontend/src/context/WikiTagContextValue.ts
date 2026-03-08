import { createContext } from "react";
import type { useWikiTagAPI } from "../hooks/useWikiTagAPI";

export type WikiTagContextValue = ReturnType<typeof useWikiTagAPI>;

export const WikiTagContext = createContext<WikiTagContextValue | null>(null);
