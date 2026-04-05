import type { ReactNode } from "react";
import { useMemos } from "../hooks/useMemos";
import { MemoContext } from "./MemoContextValue";

export function MemoProvider({ children }: { children: ReactNode }) {
  const memoState = useMemos();
  return (
    <MemoContext.Provider value={memoState}>{children}</MemoContext.Provider>
  );
}
