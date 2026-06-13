import { TimerContext } from "../context/TimerContextValue";
import { createContextHook } from "./createContextHook";

/*
 * Required context hook (CLAUDE.md §6.3). Timer is enabled on Mobile too (not
 * a §2 省略 Provider), so the hook throws when no Provider is mounted — there
 * is no Optional variant.
 */
export const useTimerContext = createContextHook(
  TimerContext,
  "useTimerContext",
);
