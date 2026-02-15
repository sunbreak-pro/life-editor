import { TimerContext } from "../context/TimerContextValue";
import { createContextHook } from "./createContextHook";

export const useTimerContext = createContextHook(
  TimerContext,
  "useTimerContext",
);
