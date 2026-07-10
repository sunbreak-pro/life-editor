import type { ReactNode } from "react";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { SidebarNav, type SidebarNavSection } from "./SidebarNav";
import { BottomTabBar } from "./BottomTabBar";
import { RightSidebar } from "./RightSidebar";
import { MobileDrawer } from "./MobileDrawer";

/** Already-translated copy for the target-IA detail panel (App Shell Turn 2). */
export interface DetailPanelLabels {
  /** Panel title ("詳細" / "Details"). */
  title: string;
  /** aria-label for the close (X) button. */
  close: string;
  /** Empty-state copy shown while nothing is registered. */
  empty: string;
  /** aria-label for the wide panel's resize handle. */
  resize: string;
}

export interface AppShellSection extends SidebarNavSection {}

export interface AppShellLabels {
  appName: string;
  collapse: string;
  expand: string;
  commandPalette: string;
  signOut: string;
  more: string;
  moreTitle: string;
  /** Keycap hint on the sidebar ⌘K footer row (wide layout only). */
  shortcutHint?: string;
}

export interface AppShellProps {
  sections: AppShellSection[];
  /**
   * Utility group (Settings / Trash). Forwarded to the wide sidebar as its
   * bottom-pinned muted group. On the narrow layout these fold into the
   * bottom bar's "More" overflow via `mobileSections` (default appends them
   * after the mainline sections).
   */
  utilitySections?: AppShellSection[];
  /**
   * Explicit ordering for the narrow bottom bar (fixed tabs first, the rest
   * overflow into "More"). Defaults to `[...sections, ...utilitySections]`
   * so hosts that don't care get the natural order; hosts that want a
   * different Mobile priority (e.g. surface Work before Connect) pass it.
   */
  mobileSections?: AppShellSection[];
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
   * When set, the target-IA detail panel is mounted (App Shell Turn 2): a
   * push-in <RightSidebar> as a flex sibling of <main> on the wide layout, and
   * a left <MobileDrawer> on the narrow layout. Both read open/width/portal
   * state from a RightSidebarContext, so the HOST MUST wrap this AppShell in a
   * <RightSidebarProvider> when passing these labels. Omit for the legacy
   * (no-panel) shell — behavior is then byte-identical to before.
   */
  detailPanelLabels?: DetailPanelLabels;
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
 * Scope (Layout Standard v1, Issue #180): the shell only owns the STRUCTURE
 * — the wide↔narrow switch, the nav chrome, and the detail-panel siblings.
 * Content width, page gutter, and body scrolling are NOT the shell's job:
 * <main> is a bare overflow-hidden flex child, and the host wraps `children`
 * in a <PageContainer> that owns max-w / gutter / self-scroll. That keeps
 * canvas-style sections full-bleed and document sections centered without
 * the shell branching on content shape.
 *
 * Sidebar-collapsed is a shell-display concern (not section state), so the
 * shell persists it locally via useLocalStorage rather than lifting it.
 */
export function AppShell({
  sections,
  utilitySections,
  mobileSections,
  activeSection,
  onNavigate,
  onTogglePalette,
  userEmail,
  onSignOut,
  labels,
  children,
  wideQuery = "(min-width: 768px)",
  maxBottomTabs = 4,
  detailPanelLabels,
}: AppShellProps) {
  const isWide = useMediaQuery(wideQuery, true);
  const [collapsed, setCollapsed] = useLocalStorage<boolean>(
    SIDEBAR_COLLAPSED_KEY,
    false,
  );

  // Narrow bottom bar list: explicit `mobileSections` wins; otherwise the
  // mainline sections followed by the utility group (Settings / Trash).
  const bottomSections = mobileSections ?? [
    ...sections,
    ...(utilitySections ?? []),
  ];

  if (isWide) {
    return (
      <div className="flex h-screen overflow-hidden bg-lumen-bg text-lumen-text">
        <SidebarNav
          sections={sections}
          utilitySections={utilitySections}
          activeSection={activeSection}
          onNavigate={onNavigate}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((v) => !v)}
          onTogglePalette={onTogglePalette}
          userEmail={userEmail}
          onSignOut={onSignOut}
          labels={labels}
        />
        <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
        {detailPanelLabels && (
          <RightSidebar
            title={detailPanelLabels.title}
            closeLabel={detailPanelLabels.close}
            emptyLabel={detailPanelLabels.empty}
            resizeLabel={detailPanelLabels.resize}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className="flex h-[100svh] flex-col bg-lumen-bg text-lumen-text pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
      style={{ overscrollBehavior: "none" }}
    >
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      <BottomTabBar
        sections={bottomSections}
        activeSection={activeSection}
        onNavigate={onNavigate}
        maxVisible={maxBottomTabs}
        labels={{ more: labels.more, moreTitle: labels.moreTitle }}
      />
      {detailPanelLabels && (
        <MobileDrawer
          title={detailPanelLabels.title}
          closeLabel={detailPanelLabels.close}
          emptyLabel={detailPanelLabels.empty}
        />
      )}
    </div>
  );
}
