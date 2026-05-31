import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

/**
 * Shell-level UI state shared across every section.
 *
 * Owns the open/close state of the global Drawer (per-section sidebar) and the
 * global SearchOverlay. The persistent Header toggles these; each section reads
 * `sidebarOpen` to render its own Drawer content (IA v3 — doc 12 / eval doc 13).
 */
export interface ShellContextValue {
  sidebarOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const value = useMemo<ShellContextValue>(
    () => ({
      sidebarOpen,
      openSidebar: () => setSidebarOpen(true),
      closeSidebar: () => setSidebarOpen(false),
      searchOpen,
      openSearch: () => setSearchOpen(true),
      closeSearch: () => setSearchOpen(false),
    }),
    [sidebarOpen, searchOpen],
  );

  return (
    <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
  );
}

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) {
    throw new Error("useShell must be used within a ShellProvider (AppShell)");
  }
  return ctx;
}
