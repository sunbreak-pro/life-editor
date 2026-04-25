import { createContext } from "react";
import type { UseSidebarLinksValue } from "../hooks/useSidebarLinks";

export type SidebarLinksContextValue = UseSidebarLinksValue;

export const SidebarLinksContext =
  createContext<SidebarLinksContextValue | null>(null);
