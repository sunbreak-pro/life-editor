import { useMemo, useState, type ComponentProps, type ReactNode } from "react";
import {
  getDataService,
  signOut,
  AppShell,
  PageContainer,
  HeaderTabs,
  type HeaderTab,
  SegmentedControl,
  SectionHeader,
  RightSidebarToggle,
  CommandSearchField,
  useMediaQuery,
  isMac,
  CommandPalette,
  useTranslation,
  useUnsavedGuardOptional,
  type DataService,
  type SectionId,
  type Session,
  WIDE_QUERY,
} from "@life-editor/shared";
import { AppProviders } from "./AppProviders";
import { TagEditorHost } from "./tags/TagEditorHost";
import { HeaderUndoRedo } from "./HeaderUndoRedo";
import { MobileShellActions } from "./MobileShellActions";
import {
  SECTION_DESCRIPTORS,
  type NarrowHeader,
  type TabBandId,
} from "./sectionDescriptors";
import { useShellNavigation } from "./hooks/useShellNavigation";
import { useShellChrome } from "./hooks/useShellChrome";
import { usePaletteItemSearch } from "./hooks/usePaletteItemSearch";

/*
 * Phase 2 S1+S2 host shell — target-IA wiring (App Shell).
 *
 * One DataService is created once and handed to <AppProviders>, which injects
 * it into every global Provider (the shared hooks never reach a module
 * singleton — CLAUDE.md §6.4). The global chain itself — its order, the two
 * headless bridges inside it, and the Mobile 省略 gate — moved to
 * `AppProviders.tsx` in #676 (a); each section's own Provider nesting stays in
 * its descriptor row. Every domain reads `useSyncDomains` to know when the
 * data IT owns changed, so since #499 a note edit does not refetch the todo
 * tree, the tag graph, or the timer settings.
 *
 * Section routing is a local `useState` switch (no React Router — the
 * Tauri app uses `App.tsx::activeSection`, CLAUDE.md §3.2). The target IA
 * (IA.md 2026-07-05) collapses the old flat sections into 5 mainline + 2
 * utility, with the document surfaces (Notes / Daily) folded under a single
 * "Materials" section addressed by an in-section tab (`materialsTab`). Todos
 * left that group in #411 and are now Schedule's second tab (`scheduleTab`),
 * next to the calendar they get scheduled onto.
 *
 * This host only wires the SHELL. Section identity/order/icons come from the
 * shared registry (SSOT — shared/src/sections.ts, derived inside
 * useShellChrome), and everything per-section the web host draws — width, tab
 * band, narrow row, body + its Provider nesting — comes from ONE row of
 * SECTION_DESCRIPTORS (#676 (b)). Adding a section is a registry edit plus a
 * descriptor row; nothing below switches on a section id.
 */

/**
 * One lifted in-section tab band, already translated (§6.4). The same object
 * feeds BOTH controls — the wide SectionHeader's HeaderTabs and the narrow
 * SegmentedControl — so the two can never drift apart.
 */
interface TabBand {
  readonly defs: HeaderTab[];
  readonly active: string;
  readonly onSelect: (id: string) => void;
  readonly label: string;
}

export function MainScreen({ session }: { session: Session }) {
  const { t } = useTranslation();
  const ds = useMemo(() => getDataService(), []);
  // Navigation half (hooks split — useShellNavigation): the section switch
  // (§3.2), the lifted in-section tab states, and the pending-intent stashes
  // (new-todo flag / "[[" item-nav) the destination views consume on mount.
  /*
   * #753: a section change unmounts the whole body, so a draft inside it is
   * discarded by an act the panel never sees. Every navigation runs past the
   * shell-level guard first (App.tsx mounts the Provider ABOVE MainScreen —
   * this body sits outside every Provider MainScreen itself renders).
   */
  const unsavedGuard = useUnsavedGuardOptional();
  const nav = useShellNavigation({
    confirmLeave: unsavedGuard?.confirmDiscard,
  });
  const { section, setSection } = nav;
  // Chrome half (hooks split — useShellChrome): the palette commands, the
  // registry-derived nav section lists, the per-section tab-band defs, the
  // translated shell labels, and the Materials count badges the headless
  // MaterialsCountsBridge feeds via setMaterialsCounts.
  const {
    setMaterialsCounts,
    commands,
    navSections,
    utilitySections,
    mobileSections,
    materialsTabDefs,
    scheduleTabDefs,
    analyticsTabDefs,
    briefingTabDefs,
    shellLabels,
  } = useShellChrome({
    setSection,
    setMaterialsTab: nav.setMaterialsTab,
    setScheduleTab: nav.setScheduleTab,
  });
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Global tag editor (#409). Opened from the sidebar footer row above ⌘K, so
  // the tag master is reachable from every section — the panel itself is
  // mount-on-open (TagEditorHost) and fetches nothing while closed.
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  // Narrow-width switch for the in-section tab controls (HeaderTabs ↔
  // Segmented). Independent of AppShell's own wide/narrow switch (same query,
  // own read).
  const isWide = useMediaQuery(WIDE_QUERY, true);

  // The active section's descriptor — the one place per-section layout is
  // decided (#676 (b)). Width, tab band, narrow row and body all read off it.
  const descriptor = SECTION_DESCRIPTORS[section];

  // Detail-panel (rightSidebar) toggle, injected already-translated (§6.4).
  // Desktop = PanelRight at the header-tab row's right end; Mobile = a bordered
  // hamburger at the left of the segment row that opens the left drawer. The
  // toggle flips its own aria-label between the two (open ↔ close action).
  const detailOpenLabel = t("detailPanel.open");
  const detailCloseLabel = t("detailPanel.close");

  // Standard header controls (v2 §1). Left→right: the command-palette search
  // field (#306), app-level Undo/Redo (#304), then the rightSidebar toggle:
  // [search][Undo][Redo][rightSidebar]. The rightSidebar toggle is
  // UNCONDITIONAL for all sections (v2 §3); the v2 §5 width tab was retired
  // 2026-07-11 (all sections wide).
  const headerControls = (
    <>
      <CommandSearchField
        onOpen={() => setPaletteOpen(true)}
        placeholder={t("commandPalette.trigger")}
        label={t("nav.commandPalette")}
        shortcutHint={isMac ? "⌘K" : "Ctrl K"}
      />
      <HeaderUndoRedo />
      <RightSidebarToggle
        variant="panel"
        openLabel={detailOpenLabel}
        closeLabel={detailCloseLabel}
      />
    </>
  );

  // The four lifted tab bands, keyed by the id a descriptor names. Building
  // them all is free (they are plain objects over already-memoised defs) and
  // keeps the lookup total — a descriptor can never name a band that has no
  // state behind it.
  const tabBands: Record<TabBandId, TabBand> = {
    materials: {
      defs: materialsTabDefs,
      active: nav.materialsTab,
      onSelect: (id) => nav.setMaterialsTab(id as typeof nav.materialsTab),
      label: t("section.materials"),
    },
    schedule: {
      defs: scheduleTabDefs,
      active: nav.scheduleTab,
      onSelect: (id) => nav.setScheduleTab(id as typeof nav.scheduleTab),
      label: t("section.schedule"),
    },
    analytics: {
      defs: analyticsTabDefs,
      active: nav.analyticsTab,
      onSelect: (id) => nav.setAnalyticsTab(id as typeof nav.analyticsTab),
      label: t("analytics.tabsLabel"),
    },
    briefing: {
      defs: briefingTabDefs,
      active: nav.briefingTab,
      onSelect: (id) => nav.setBriefingTab(id as typeof nav.briefingTab),
      label: t("briefing.tabsLabel"),
    },
  };
  const band = descriptor.tabBand ? tabBands[descriptor.tabBand] : undefined;

  // Standard section header row (v2 §1), mounted in AppShell's header slot —
  // ABOVE the main + detail-panel flex row (§4), so the divider spans both
  // and the controls never move when the panel opens. A section with a tab
  // band shows it as its title (divider={false}: the SectionHeader owns the
  // line); every other section shows its translated title.
  const sectionHeader = band ? (
    <SectionHeader
      tabs={
        <HeaderTabs
          divider={false}
          tabs={band.defs}
          activeTab={band.active}
          onSelect={band.onSelect}
          label={band.label}
        />
      }
      controls={headerControls}
    />
  ) : (
    <SectionHeader
      title={t(`section.${section}`, { defaultValue: section })}
      controls={headerControls}
    />
  );

  // NARROW layout row — unchanged from v1 (v2 non-goal: mobile untouched).
  // The shape comes from the descriptor (`narrowHeader`), so the old
  // MOBILE_HAMBURGER_SECTIONS set and the per-section switcher constants are
  // gone: Materials/Briefing get hamburger + segmented, Schedule the segmented
  // alone (its Calendar body draws its own hamburger and its Todo body closes
  // the drawer outright below 768px — the mobile Kanban carries todo detail in
  // its own bottom sheet, #470), Connect/Work/Settings the hamburger alone.
  const detailHamburger = (
    <RightSidebarToggle
      variant="hamburger"
      openLabel={detailOpenLabel}
      closeLabel={detailCloseLabel}
    />
  );
  const narrowRow = isWide
    ? undefined
    : renderNarrowRow(descriptor.narrowHeader, band, detailHamburger);

  /*
   * Shared Suspense fallback for the code-split section bodies (#676 (a)).
   * Plain text on a `lumen-*` token — no spinner, because the chunk usually
   * lands within a frame or two on a warm cache and a flashing spinner reads
   * as a glitch. `role="status"` so a screen reader announces the wait.
   */
  const sectionLoadingFallback = (
    <p className="text-lumen-text-secondary" role="status">
      {t("common.loading")}
    </p>
  );

  const detailPanelLabels = {
    title: t("detailPanel.title"),
    close: t("detailPanel.close"),
    empty: t("detailPanel.empty"),
    resize: t("detailPanel.resize"),
  };

  const sectionBody = descriptor.body({
    ds,
    nav,
    // Briefing hosts its narrow band inside its own body (at the top of the
    // paper, above the masthead — #879); every other section puts it in the
    // PageContainer header below.
    narrowTabRow: descriptor.narrowHeaderInBody ? narrowRow : undefined,
    loadingFallback: sectionLoadingFallback,
  });

  return (
    /*
     * The global Provider chain — order, the two headless bridges, and the
     * Mobile 省略 gate all live in AppProviders (#676 (a)). What stays here is
     * the part that changes per render: the chrome above and the three
     * shell-level children below.
     *
     * The shortcut handlers are handed over rather than wired here because the
     * executor has to sit inside the ShortcutConfig Provider, which is inside
     * the chain; nav:* + new-todo route through the target-IA mapping
     * (handleNavigate / handleNewTodo → Materials + tab + create dialog), and
     * undo / redo route through the ambient UndoRedo context inside
     * GlobalShortcuts itself (#304 / PR #316).
     */
    <AppProviders
      dataService={ds}
      onMaterialsCounts={setMaterialsCounts}
      shortcuts={{
        onNavigate: nav.handleNavigate,
        onOpenSettings: () => setSection("settings"),
        onTogglePalette: () => setPaletteOpen((v) => !v),
        onNewTodo: nav.handleNewTodo,
      }}
    >
      {/*
       * W5 app shell — responsive single shell (wide sidebar ↔ narrow bottom
       * tabs via useMediaQuery). Section state stays here (useState switch, no
       * React Router — §3.2); the shell is pure presentation (DataService-free,
       * §3.1) and receives section list / labels / callbacks as props (§6.4).
       * detailPanelLabels mounts the Turn 2 push-in panel (Desktop) / left
       * drawer (Mobile) — valid because AppProviders wraps us in a
       * RightSidebarProvider.
       */}
      <AppShell
        sections={navSections}
        utilitySections={utilitySections}
        mobileSections={mobileSections}
        activeSection={section}
        onNavigate={(id) => setSection(id as SectionId)}
        onTogglePalette={() => setPaletteOpen((v) => !v)}
        onOpenTagEditor={() => setTagEditorOpen(true)}
        userEmail={session.user.email ?? ""}
        onSignOut={() => void signOut()}
        labels={shellLabels}
        detailPanelLabels={detailPanelLabels}
        header={sectionHeader}
        /*
         * Narrow-only counterpart to `header` (#472). `header` is a wide-branch
         * slot, so undo/redo and the command palette (#473) would otherwise be
         * unreachable on mobile; AppShell hands these to the bottom bar's
         * "More" sheet. A callback (not a node) because the rows read
         * UndoRedoContext, and MainScreen's own body sits OUTSIDE the
         * UndoRedo Provider that AppProviders mounts.
         */
        bottomBarActions={(closeSheet) => (
          <MobileShellActions
            onOpenPalette={() => setPaletteOpen(true)}
            closeSheet={closeSheet}
          />
        )}
      >
        {/*
         * PageContainer (Layout Standard v1 #180 / v2) owns width + gutter +
         * scroll for every section. On the WIDE layout the section chrome lives
         * in AppShell's header slot (the standard SectionHeader above), so the
         * header slot here only carries the NARROW-layout row the descriptor
         * asked for.
         */}
        <PageContainer
          width={descriptor.width}
          header={
            descriptor.narrowHeaderInBody ? undefined : (narrowRow ?? undefined)
          }
        >
          {sectionBody}
        </PageContainer>
      </AppShell>

      {/*
       * Command palette mounted ONCE at the shell level, outside the section
       * switch (so Cmd+K works from any section). Copy is injected as props —
       * the primitive never calls useTranslation.
       */}
      <PaletteWithItemSearch
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
        placeholder={t("commandPalette.placeholder")}
        noResultsLabel={t("commandPalette.noResults")}
        dataService={ds}
        onOpenItem={nav.navigateToItem}
      />

      {/*
       * Global tag editor (#409), mounted beside the palette at the shell level
       * so it opens over any section. It owns its own tag hook instance rather
       * than a WikiTagsUnifiedProvider — that Provider is section-layer and
       * absent on Briefing / Work / Analytics / Settings / Trash (see
       * TagEditorHost).
       */}
      <TagEditorHost
        open={tagEditorOpen}
        onClose={() => setTagEditorOpen(false)}
        dataService={ds}
      />
    </AppProviders>
  );
}

/**
 * The narrow-layout row a descriptor asked for. Called on the narrow branch
 * only, so every arm is already width-gated. A `tabs*` shape without a band is
 * impossible by construction (the descriptor that asks for tabs also names a
 * tabBand), and falls back to no row rather than a half-drawn one.
 */
function renderNarrowRow(
  shape: NarrowHeader,
  band: TabBand | undefined,
  hamburger: ReactNode,
): ReactNode {
  if (shape === "none") return undefined;
  if (shape === "hamburger")
    return <div className="flex items-center">{hamburger}</div>;
  if (!band) return undefined;
  const segmented = (
    <SegmentedControl
      className={shape === "tabs+hamburger" ? "flex-1" : undefined}
      options={band.defs}
      value={band.active}
      onChange={band.onSelect}
      label={band.label}
    />
  );
  if (shape === "tabs") return segmented;
  return (
    <div className="flex items-center gap-2">
      {hamburger}
      {segmented}
    </div>
  );
}

/*
 * CommandPalette and its cross-item search (#503) mounted as one child. The
 * search hook (usePaletteItemSearch → useSyncDomains) reads SyncContext, and
 * MainScreen's own body runs OUTSIDE the SyncProvider MainScreen renders —
 * calling the hook there crashed every post-login mount (#548). Fusing hook
 * and palette into a child mounted inside the Provider makes the constraint
 * structural instead of remembered.
 */
function PaletteWithItemSearch({
  dataService,
  onOpenItem,
  ...palette
}: Omit<
  ComponentProps<typeof CommandPalette>,
  "externalResults" | "onQueryChange"
> & {
  dataService: DataService | undefined;
  onOpenItem: (target: { id: string; role: string; date?: string }) => void;
}) {
  // Lazy stays lazy (#430): nothing is fetched until a non-empty query is
  // typed, so opening the palette to jump sections still costs zero queries.
  const { results, handleQueryChange } = usePaletteItemSearch({
    dataService,
    isOpen: palette.isOpen,
    onOpenItem,
  });
  return (
    <CommandPalette
      {...palette}
      externalResults={results}
      onQueryChange={handleQueryChange}
    />
  );
}
