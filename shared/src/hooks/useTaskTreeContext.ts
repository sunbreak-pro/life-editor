import { TaskTreeContext } from "../context/TaskTreeContextValue";
import { createContextHook } from "./createContextHook";

export const useTaskTreeContext = createContextHook(
  TaskTreeContext,
  "useTaskTreeContext",
);
