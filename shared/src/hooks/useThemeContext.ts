import { createContextHook } from "./createContextHook";
import { ThemeContext } from "../context/ThemeContextValue";

export const useThemeContext = createContextHook(
  ThemeContext,
  "useThemeContext",
);
