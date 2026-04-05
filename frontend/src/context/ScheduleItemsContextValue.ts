import { createContext } from "react";
import type { useScheduleItems } from "../hooks/useScheduleItems";

export type ScheduleItemsContextValue = ReturnType<typeof useScheduleItems>;

export const ScheduleItemsContext =
  createContext<ScheduleItemsContextValue | null>(null);
