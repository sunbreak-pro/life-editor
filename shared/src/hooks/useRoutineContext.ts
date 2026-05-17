import { RoutineContext } from "../context/RoutineContextValue";
import { createContextHook } from "./createContextHook";

export const useRoutineContext = createContextHook(
  RoutineContext,
  "useRoutineContext",
);
