import { TodoTreeContext } from "../context/TodoTreeContextValue";
import { createContextHook } from "./createContextHook";

export const useTodoTreeContext = createContextHook(
  TodoTreeContext,
  "useTodoTreeContext",
);
