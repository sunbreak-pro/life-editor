import { ScheduleItemsContext } from "../context/ScheduleItemsContextValue";
import { createContextHook } from "./createContextHook";

export const useScheduleItemsContext = createContextHook(
  ScheduleItemsContext,
  "useScheduleItemsContext",
);
