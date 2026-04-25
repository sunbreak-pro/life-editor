import { SidebarLinksContext } from "../context/SidebarLinksContextValue";
import { createContextHook } from "./createContextHook";

export const useSidebarLinksContext = createContextHook(
  SidebarLinksContext,
  "useSidebarLinksContext",
);
