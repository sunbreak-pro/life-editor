import { createContext } from "react";
import type { useDaily } from "../hooks/useDaily";

export type DailyContextValue = ReturnType<typeof useDaily>;

export const DailyContext = createContext<DailyContextValue | null>(null);
