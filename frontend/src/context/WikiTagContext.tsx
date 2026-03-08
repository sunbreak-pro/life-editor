import type { ReactNode } from "react";
import { useWikiTagAPI } from "../hooks/useWikiTagAPI";
import { WikiTagContext } from "./WikiTagContextValue";

export function WikiTagProvider({ children }: { children: ReactNode }) {
  const wikiTag = useWikiTagAPI();
  return (
    <WikiTagContext.Provider value={wikiTag}>
      {children}
    </WikiTagContext.Provider>
  );
}
