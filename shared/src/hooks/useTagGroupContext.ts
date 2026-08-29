import { TagGroupContext } from "../context/TagGroupContextValue";
import { createContextHook } from "./createContextHook";

export const useTagGroupContext = createContextHook(
  TagGroupContext,
  "useTagGroupContext",
);
