import type { ReactNode } from "react";
import { useDaily } from "../hooks/useDaily";
import { DailyContext } from "./DailyContextValue";

export function DailyProvider({ children }: { children: ReactNode }) {
  const dailyState = useDaily();
  return (
    <DailyContext.Provider value={dailyState}>{children}</DailyContext.Provider>
  );
}
