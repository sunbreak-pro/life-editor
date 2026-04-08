import { type ReactNode, useState, useCallback, useMemo } from "react";
import { ScreenLockContext } from "./ScreenLockContextValue";

export function ScreenLockProvider({ children }: { children: ReactNode }) {
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());

  const isUnlocked = useCallback(
    (id: string) => unlockedIds.has(id),
    [unlockedIds],
  );

  const unlock = useCallback(
    (id: string) =>
      setUnlockedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      }),
    [],
  );

  const lock = useCallback(
    (id: string) =>
      setUnlockedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      }),
    [],
  );

  const value = useMemo(
    () => ({ isUnlocked, unlock, lock }),
    [isUnlocked, unlock, lock],
  );

  return (
    <ScreenLockContext.Provider value={value}>
      {children}
    </ScreenLockContext.Provider>
  );
}
