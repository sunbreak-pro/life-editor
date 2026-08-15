import { createContext } from "react";
import type { useTodoTreeAPI } from "../hooks/useTodoTreeAPI";

export type TodoTreeContextValue = ReturnType<typeof useTodoTreeAPI>;

export const TodoTreeContext = createContext<TodoTreeContextValue | null>(null);
