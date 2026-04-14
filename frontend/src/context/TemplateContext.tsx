import type { ReactNode } from "react";
import { useTemplates } from "../hooks/useTemplates";
import { TemplateContext } from "./TemplateContextValue";

export function TemplateProvider({ children }: { children: ReactNode }) {
  const templateState = useTemplates();
  return (
    <TemplateContext.Provider value={templateState}>
      {children}
    </TemplateContext.Provider>
  );
}
