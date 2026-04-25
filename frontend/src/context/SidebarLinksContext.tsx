import type { ReactNode } from "react";
import { useSidebarLinks } from "../hooks/useSidebarLinks";
import { SidebarLinksContext } from "./SidebarLinksContextValue";

export function SidebarLinksProvider({ children }: { children: ReactNode }) {
  const value = useSidebarLinks();
  return (
    <SidebarLinksContext.Provider value={value}>
      {children}
    </SidebarLinksContext.Provider>
  );
}
