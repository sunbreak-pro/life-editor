import { createContext } from "react";
import type { useDailyAPI } from "../hooks/useDailyAPI";

export type DailyContextValue = ReturnType<typeof useDailyAPI>;

export const DailyContext = createContext<DailyContextValue | null>(null);
