import type { ReactNode } from "react";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { WIDE_QUERY } from "../constants/breakpoints";
import { useSoftKeyboard } from "../hooks/useSoftKeyboard";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { cn } from "./cn";
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

/** The shell's section shape IS the nav's — aliased so callers can name it
 *  after the shell rather than reaching for the nav's type (#421: an empty
 *  extending interface is just its supertype). */
export type AppShellSection = SidebarNavSection;

export interface AppShellLabels {
  appName: string;
  collapse: string;
  expand: string;
  commandPalette: string;
  signOut: string;
  more: string;
  moreTitle: string;
  /** Name for the narrow "More" sheet's close button (#525). */
  moreClose: string;
  /** Keycap hint on the sidebar ⌘K footer row (wide layout only). */
  shortcutHint?: string;
  /** "Edit tags" sidebar footer row (#409) — wide layout only. */
  tagEditor?: string;
  /**
   * Accessible label for the action group in the narrow "More" sheet (#472) —
   * narrow layout only.
   */
  bottomBarActionsTitle?: string;
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
  /**
   * Opens the global tag editor (#409). Forwarded to the wide sidebar's footer
   * row above ⌘K; the narrow layout has no sidebar, so the entry is
   * wide-layout-only (mobile does not manage the tag master — §2 Consumption +
   * Quick capture).
   */
  onOpenTagEditor?: () => void;
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
   * (no-panel) shell — the panel is then simply not mounted.
   */
  detailPanelLabels?: DetailPanelLabels;
  /**
   * Standard section header row (Layout Standard v2 §1/§4 — a
   * <SectionHeader>). Rendered ABOVE the main + detail-panel flex row, so
   * its full-width divider spans main AND panel, the panel opens BELOW the
   * line, and the header's right-end controls never move when the panel
   * opens/closes. WIDE LAYOUT ONLY — the narrow layout keeps its in-body
   * rows untouched (v2 non-goal: mobile layout unchanged).
   */
  header?: ReactNode;
  /**
   * NARROW LAYOUT ONLY — app-global actions listed at the top of the bottom
   * bar's "More" sheet (#472). Because `header` is wide-only, controls that
   * act on the current screen no matter which section is open (undo/redo, the
   * command palette) have no other slot that every narrow section shares. The
   * wide branch ignores this prop, which is what keeps Desktop unchanged.
   *
   * Built from <BottomTabActionRow>; see that prop's contract on BottomTabBar
   * (return a component, not inline hook calls).
   */
  bottomBarActions?: (closeSheet: () => void) => ReactNode;
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
 * Scope (Layout Standard v1 #180 / v2): the shell only owns the STRUCTURE
 * — the wide↔narrow switch, the nav chrome, the v2 `header` slot, and the
 * detail-panel siblings. Content width, page gutter, and body scrolling are
 * NOT the shell's job: <main> is a bare overflow-hidden flex child, and the
 * host wraps `children` in a <PageContainer> that owns max-w / gutter /
 * self-scroll. That keeps canvas-style sections full-bleed and document
 * sections centered without the shell branching on content shape.
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
  onOpenTagEditor,
  userEmail,
  onSignOut,
  labels,
  children,
  wideQuery = WIDE_QUERY,
  maxBottomTabs = 4,
  detailPanelLabels,
  header,
  bottomBarActions,
}: AppShellProps) {
  const isWide = useMediaQuery(wideQuery, true);
  // #608: on a phone the bottom bar is the first thing the soft keyboard
  // fights with — it either rides up on top of the keyboard or sits behind it,
  // depending on what the UA does to the viewport. Neither is usable, and the
  // bar is navigation the user is not reaching for mid-sentence anyway, so it
  // stands down while typing. Only measured on the narrow layout (the wide one
  // has no bottom bar and Desktop has no soft keyboard to watch).
  const keyboardOpen = useSoftKeyboard(!isWide);
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
    // v2 §4 structure: the section header row sits in the content COLUMN,
    // above the main + detail-panel flex ROW — the header's divider spans
    // both, and the panel pushes only the area below the line.
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
          onOpenTagEditor={onOpenTagEditor}
          userEmail={userEmail}
          onSignOut={onSignOut}
          labels={labels}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          {header}
          <div className="flex min-h-0 flex-1 overflow-hidden">
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
        </div>
      </div>
    );
  }

  // Pull-to-refresh suppression lives on html/body (web/src/index.css, #631)
  // — overscroll-behavior on this non-scrolling div never fired.
  //
  // Safe areas (#791). `viewport-fit=cover` (web/index.html) plus the PWA's
  // `black-translucent` status-bar style means the web view spans the WHOLE
  // screen — on an iPhone the top of this div is under the clock, not under
  // the notch. Whatever renders first therefore has to clear the status bar
  // itself, and only the left/right insets were here: the narrow header row
  // was painting straight into the status bar (reported from the home-screen
  // PWA). `pt-` closes that, matching MobileDrawer / AuthScreen.
  //
  // The BOTTOM inset is deliberately NOT here — <BottomTabBar> owns the
  // home-indicator strip (its own `pb-`), which is the single-reservation
  // contract MobileFab's placement doc already leans on. Reserving it on both
  // would stack two paddings for one strip.
  //
  // box-sizing is border-box (Tailwind preflight), so these paddings come out
  // of the shell's box rather than adding to it: <main> shrinks, the shell
  // still ends exactly at the bottom of the screen.
  //
  // That height is --app-shell-height (shared/src/styles/tokens.css), not a
  // literal `100svh`: in the iOS home-screen app the small viewport comes out
  // one status bar short of the screen, and the token adds that strip back
  // (#1037). The host's `body { min-height }` reads the same token, which is
  // the pairing #631 relies on.
  return (
    <div className="flex h-[var(--app-shell-height)] flex-col bg-lumen-bg text-lumen-text pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]">
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      {/*
       * The bar stands down while typing (#608) by going INVISIBLE, not by
       * unmounting (#874). Unmounting gave its height back to <main>, so every
       * soft keyboard re-flowed the whole screen upward — and with a sheet open
       * over it, the user watched the page heave behind the panel they were
       * typing into. `invisible` is visibility:hidden, which keeps the box in
       * the layout while taking the bar out of the tab order and the
       * accessibility tree, so the stand-down still holds and nothing moves.
       *
       * This costs nothing in room: `interactive-widget` is left at its default
       * (web/index.html), so the layout viewport does not shrink for the
       * keyboard — the reserved strip is under it either way.
       */}
      <div className={cn("shrink-0", keyboardOpen && "invisible")}>
        <BottomTabBar
          sections={bottomSections}
          activeSection={activeSection}
          onNavigate={onNavigate}
          maxVisible={maxBottomTabs}
          labels={{
            more: labels.more,
            moreTitle: labels.moreTitle,
            moreClose: labels.moreClose,
            actionsTitle: labels.bottomBarActionsTitle,
          }}
          actions={bottomBarActions}
        />
      </div>
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
