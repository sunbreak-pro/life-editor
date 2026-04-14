import { createContext } from "react";
import type { useTemplates } from "../hooks/useTemplates";

export type TemplateContextValue = ReturnType<typeof useTemplates>;

export const TemplateContext = createContext<TemplateContextValue | null>(null);
