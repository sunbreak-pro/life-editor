import { createContext } from "react";

export interface RightSidebarContextValue {
  portalTarget: HTMLDivElement | null;
  requestOpen: () => void;
}

export const RightSidebarContext = createContext<RightSidebarContextValue>({
  portalTarget: null,
  requestOpen: () => {},
});
