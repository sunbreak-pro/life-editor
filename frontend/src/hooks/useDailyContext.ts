import { DailyContext } from "../context/DailyContextValue";
import { createContextHook } from "./createContextHook";

export const useDailyContext = createContextHook(
  DailyContext,
  "useDailyContext",
);
