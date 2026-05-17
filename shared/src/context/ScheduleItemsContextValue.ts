import { createContext } from "react";
import type { useScheduleItemsAPI } from "../hooks/useScheduleItemsAPI";

export type ScheduleItemsContextValue = ReturnType<typeof useScheduleItemsAPI>;

export const ScheduleItemsContext =
  createContext<ScheduleItemsContextValue | null>(null);
