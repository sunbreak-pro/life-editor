import { createContext } from "react";
import type { useRoutinesAPI } from "../hooks/useRoutinesAPI";

export type RoutineContextValue = ReturnType<typeof useRoutinesAPI>;

export const RoutineContext = createContext<RoutineContextValue | null>(null);
