import { ScheduleContext } from "../context/ScheduleContext";
import { createContextHook } from "./createContextHook";

export const useScheduleContext = createContextHook(
  ScheduleContext,
  "useScheduleContext",
);
