import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import {
  RightSidebarContext,
  type RightSidebarContextValue,
} from "./RightSidebarContextValue";

/*
 * RightSidebarProvider — Pattern A 2/3 (CLAUDE.md §6.3). App Shell Turn 2.
 *
 * Host mounts this OUTSIDE the section switch (like ToastProvider) so the
 * detail panel keeps its open/width state while navigating between sections
 * and every section body can portal into it. Pure UI state — DataService-free
 * (§3.1); copy is injected at the panel/toggle boundary (§6.4).
 *
 *   isOpen — useState(false): NOT persisted (a fresh session starts closed).
 *   width  — useLocalStorage: the Desktop panel width IS persisted so a
 *            user's resize survives reloads.
 */
const RIGHT_SIDEBAR_WIDTH_KEY = "life-editor.shell.right-sidebar-width";
const DEFAULT_WIDTH = 320;

export interface RightSidebarProviderProps {
  children: ReactNode;
}

export function RightSidebarProvider({ children }: RightSidebarProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [width, setWidth] = useLocalStorage<number>(
    RIGHT_SIDEBAR_WIDTH_KEY,
    DEFAULT_WIDTH,
  );
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [contentCount, setContentCount] = useState(0);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  // Mount = +1, the returned cleanup = −1. Guards against double-decrement by
  // only ever moving one step per registration.
  const registerContent = useCallback(() => {
    setContentCount((c) => c + 1);
    return () => setContentCount((c) => Math.max(0, c - 1));
  }, []);

  const value = useMemo<RightSidebarContextValue>(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      width,
      setWidth,
      portalTarget,
      setPortalTarget,
      contentCount,
      registerContent,
    }),
    [
      isOpen,
      open,
      close,
      toggle,
      width,
      setWidth,
      portalTarget,
      contentCount,
      registerContent,
    ],
  );

  return (
    <RightSidebarContext.Provider value={value}>
      {children}
    </RightSidebarContext.Provider>
  );
}
