import { ThemeContext } from "../context/ThemeContextValue";
import { createContextHook } from "./createContextHook";

export const useTheme = createContextHook(ThemeContext, "useTheme");
