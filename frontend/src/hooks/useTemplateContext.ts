import { TemplateContext } from "../context/TemplateContextValue";
import { createContextHook } from "./createContextHook";

export const useTemplateContext = createContextHook(
  TemplateContext,
  "useTemplateContext",
);
