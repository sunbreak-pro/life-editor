import { useContext } from "react";
import { WikiTagContext } from "../context/WikiTagContextValue";

export function useWikiTags() {
  const ctx = useContext(WikiTagContext);
  if (!ctx) throw new Error("useWikiTags must be used within WikiTagProvider");
  return ctx;
}
