import { createContext } from "react";
import type { useTaskTreeAPI } from "../hooks/useTaskTreeAPI";

export type TaskTreeContextValue = ReturnType<typeof useTaskTreeAPI>;

export const TaskTreeContext = createContext<TaskTreeContextValue | null>(null);
