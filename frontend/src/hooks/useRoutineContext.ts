import { RoutineContext } from "../context/RoutineContext";
import { createContextHook } from "./createContextHook";

export const useRoutineContext = createContextHook(
  RoutineContext,
  "useRoutineContext",
);
