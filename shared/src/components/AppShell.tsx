import type { ReactNode } from "react";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { SidebarNav, type SidebarNavSection } from "./SidebarNav";
import { BottomTabBar } from "./BottomTabBar";

export interface AppShellSection extends SidebarNavSection {}

export interface AppShellLabels {
  appName: string;
  collapse: string;
  expand: string;
  commandPalette: string;
  signOut: string;
  more: string;
  moreTitle: string;
}

export interface AppShellProps {
  sections: AppShellSection[];
  activeSection: string;
  onNavigate: (id: string) => void;
  onTogglePalette: () => void;
  userEmail: string;
  onSignOut: () => void;
  labels: AppShellLabels;
  /** Section body, rendered into the main content area. */
  children: ReactNode;
  /** min-width for the wide (sidebar) layout. Default Tailwind `md`. */
  wideQuery?: string;
  /** How many sections show as fixed tabs on the narrow bottom bar. */
  maxBottomTabs?: number;
  /**
   * When true, the active section body fills the main area edge-to-edge —
   * the centered max-w / padding wrapper is dropped so canvas-like sections
   * (Connect graph, calendar) can take the full width AND height. The host is
   * then responsible for giving the section its own h-full layout. Default
   * false keeps the readable centered column for document-style sections.
   */
  fluidContent?: boolean;
}

const SIDEBAR_COLLAPSED_KEY = "life-editor.shell.sidebar-collapsed";

/*
 * Responsive single app shell (W5). One component switches between the
 * wide sidebar layout (≥ md) and the narrow bottom-tab layout (< md) via
 * useMediaQuery (which falls back to wide under jsdom). Pure presentation:
 * DataService-free (§3.1), section routing stays a useState switch owned
 * by the host (§3.2 — no React Router), all labels/state injected as props
 * (§6.4). The host slots the active section body into `children`.
 *
 * Sidebar-collapsed is a shell-display concern (not section state), so the
 * shell persists it locally via useLocalStorage rather than lifting it.
 */
export function AppShell({
  sections,
  activeSection,
  onNavigate,
  onTogglePalette,
  userEmail,
  onSignOut,
  labels,
  children,
  wideQuery = "(min-width: 768px)",
  maxBottomTabs = 4,
  fluidContent = false,
}: AppShellProps) {
  const isWide = useMediaQuery(wideQuery, true);
  const [collapsed, setCollapsed] = useLocalStorage<boolean>(
    SIDEBAR_COLLAPSED_KEY,
    false,
  );

  if (isWide) {
    return (
      <div className="flex h-screen bg-notion-bg text-notion-text">
        <SidebarNav
          sections={sections}
          activeSection={activeSection}
          onNavigate={onNavigate}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((v) => !v)}
          onTogglePalette={onTogglePalette}
          userEmail={userEmail}
          onSignOut={onSignOut}
          labels={labels}
        />
        <main className="min-w-0 flex-1 overflow-y-auto">
          {fluidContent ? (
            children
          ) : (
            <div className="mx-auto max-w-3xl px-6 py-6">{children}</div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div
      className="flex h-[100svh] flex-col bg-notion-bg text-notion-text pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
      style={{ overscrollBehavior: "none" }}
    >
      <main
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ overscrollBehavior: "contain" }}
      >
        {fluidContent ? children : <div className="px-4 py-4">{children}</div>}
      </main>
      <BottomTabBar
        sections={sections}
        activeSection={activeSection}
        onNavigate={onNavigate}
        maxVisible={maxBottomTabs}
        labels={{ more: labels.more, moreTitle: labels.moreTitle }}
      />
    </div>
  );
}
