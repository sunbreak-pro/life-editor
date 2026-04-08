import { createContext } from "react";

export interface ScreenLockContextValue {
  isUnlocked: (itemId: string) => boolean;
  unlock: (itemId: string) => void;
  lock: (itemId: string) => void;
}

export const ScreenLockContext = createContext<ScreenLockContextValue | null>(
  null,
);
