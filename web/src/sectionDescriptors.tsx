import { Suspense, type ReactNode } from "react";
import {
  DailiesUnifiedProvider,
  NotesUnifiedProvider,
  RoutineProvider,
  ScheduleItemsProvider,
  CalendarProvider,
  TodoTreeProvider,
  WikiTagsUnifiedProvider,
  type DataService,
  type PageContainerWidth,
  type SectionId,
} from "@life-editor/shared";
import { TrashScreen } from "./trash/TrashScreen";
import { DailyView } from "./daily/DailyView";
import { BriefingScreen } from "./briefing/BriefingScreen";
import { ScheduleScreen } from "./schedule/ScheduleScreen";
import { SettingsScreen } from "./settings/SettingsScreen";
import { WorkScreen } from "./work/WorkScreen";
// The three heavy screens, code-split behind lazy() — see lazySections.ts.
import { AnalyticsScreen, ConnectScreen, NotesView } from "./lazySections";
import type { ShellNavigation } from "./hooks/useShellNavigation";

/*
 * Section descriptor table (#676 (b)).
 *
 * The shared registry (`shared/src/sections.ts`) stays the SSOT for section
 * IDENTITY — the `SectionId` union, the sidebar/mobile order, the icon and the
 * i18n label key. What it deliberately does not know is how the WEB host draws
 * each section, and that knowledge used to be smeared across five places in
 * MainScreen: a `MOBILE_HAMBURGER_SECTIONS` set, an `ownsFullBleed` boolean, a
 * four-armed ternary picking the header tab band, a seven-armed `section ===
 * …` body switch, and a separate Materials branch around PageContainer.
 * Adding a section meant finding all five.
 *
 * They live here instead, as ONE row per section:
 *
 *   - `width`      → the PageContainer variant (scroll ownership)
 *   - `tabBand`    → which lifted tab band the standard SectionHeader renders
 *   - `narrowHeader` → the narrow-layout row above the body
 *   - `body`       → the section body plus its own Provider nesting (§6.2)
 *
 * The table is a `Record<SectionId, …>`, so adding a section to the registry
 * fails to compile until its row exists — registry + descriptor, and nothing
 * else (#676 DoD). Behaviour is verbatim from the pre-split MainScreen.
 */

/**
 * The lifted in-section tab bands. The state itself lives in
 * `useShellNavigation` and the translated defs in `useShellChrome`; a
 * descriptor only names WHICH band its chrome shows, so the two never drift.
 */
export type TabBandId = "materials" | "analytics" | "briefing";

/**
 * The narrow-layout row that sits above the body (below 768px only — the wide
 * SectionHeader band lives in AppShell's header slot). The value names what
 * THIS SECTION puts in the row; the app-global controls at its right end are
 * the same on all seven and are not described here (see NarrowHeaderRow).
 * "alone" below therefore means "alone among the per-section chrome":
 *
 *  - `none`            — no chrome of its own (Analytics / Trash). Since
 *    #1035 this no longer means "no row": the row is drawn regardless to
 *    carry the app-global Undo/Redo, and these two sections simply contribute
 *    nothing to its left and middle
 *  - `hamburger`       — the detail-panel hamburger alone (Connect / Work / Settings)
 *  - `tabs`            — the segmented tab control alone, no hamburger. No
 *    section uses it today: Schedule was the last one, until #1033 moved its
 *    hamburger out of the Calendar body and into the band
 *  - `tabs+hamburger`  — hamburger at the left edge, tabs filling the rest
 */
export type NarrowHeader = "none" | "hamburger" | "tabs" | "tabs+hamburger";

/** Everything a section body needs from the host, injected (§6.4). */
export interface SectionBodyContext {
  /** The one DataService instance, created once by the host (§3.1 / §6.4). */
  readonly ds: DataService;
  /** Section switch + lifted tab state + the pending-intent stashes. */
  readonly nav: ShellNavigation;
  /**
   * The narrow-layout tab row, for the sections that host it INSIDE their own
   * body rather than in the PageContainer header (`narrowHeaderInBody`).
   * `undefined` on the wide layout and for every other section.
   */
  readonly narrowTabRow: ReactNode;
  /** Shared Suspense fallback for the code-split bodies (#676 (a)). */
  readonly loadingFallback: ReactNode;
}

export interface SectionDescriptor {
  /**
   * PageContainer width (Issue #305 — every section is one centered column
   * clamped to max-w-lumen-wide; the px lives in tokens.css). What varies is
   * SCROLL OWNERSHIP: "fluid" for the canvas/board surfaces that own their
   * full-bleed h-full layout and self-scroll inside the clamped box (Connect
   * graph, both Schedule tabs, Analytics' own centered data column), "wide"
   * for the document surfaces where PageContainer owns the vertical scroll.
   */
  readonly width: PageContainerWidth;
  /**
   * Width to use on the NARROW layout instead of `width` (omitted = same at
   * both). Materials is the case this exists for (#875): its desktop surfaces
   * want the page scroller ("wide"), while its narrow surfaces are written as
   * full-height self-scrolling lists — and only under "fluid" does their
   * `h-full` resolve against a definite box, which is what a floating "+"
   * needs to pin to the screen edge instead of to the end of the list.
   */
  readonly narrowWidth?: PageContainerWidth;
  /** Tab band shown by the standard SectionHeader (omitted = plain title). */
  readonly tabBand?: TabBandId;
  readonly narrowHeader: NarrowHeader;
  /**
   * Draw the narrow row inside the body (via `ctx.narrowTabRow`) instead of in
   * the PageContainer header. Briefing only: its body is a centered "paper"
   * that re-issues the band as its own first row, above the masthead (#318 /
   * #609 / #879), so a second row above it would push the paper down for one
   * button.
   */
  readonly narrowHeaderInBody?: boolean;
  readonly body: (ctx: SectionBodyContext) => ReactNode;
}

export const SECTION_DESCRIPTORS: Readonly<
  Record<SectionId, SectionDescriptor>
> = {
  /*
   * Briefing (Briefing plan Step 1) — the morning-paper home surface and the
   * default landing section (useStartupSection). Crosses four domains
   * (schedule / todos / timer / dailies) read-only, so it uses no per-section
   * Provider — BriefingScreen calls the injected DataService directly (same
   * pattern as TrashScreen) and re-fetches on Realtime syncVersion bumps,
   * which is how a briefing written by Claude via MCP appears without a
   * reload.
   */
  briefing: {
    width: "wide",
    tabBand: "briefing",
    narrowHeader: "tabs+hamburger",
    narrowHeaderInBody: true,
    body: ({ ds, nav, narrowTabRow }) => (
      <BriefingScreen
        dataService={ds}
        onNavigate={nav.navigateTo}
        tab={nav.briefingTab}
        tabSwitcher={narrowTabRow}
      />
    ),
  },
  /*
   * Schedule pair order (CLAUDE.md §6.2): Routine → ScheduleItems. Each inner
   * Provider may read the outer one (ScheduleItems sits INSIDE Routine).
   * CalendarProvider is NOT part of the pair — kept higher and enabled on
   * Mobile (§2). The Routine→schedule_items generator (S4-5) is the headless
   * RoutineScheduleSync, mounted inside the Providers.
   *
   * WikiTagsUnifiedProvider provides both the Event Tag/Link surface for
   * ScheduleItemsView (DU-F Step 7) and the life-tag <select> for CalendarView
   * (life-tags S2: calendars.tag_id FKs wiki_tags(id) ON DELETE CASCADE — the
   * folder-scoped view is now a tag-scoped view, so TodoTreeProvider is no
   * longer needed on that count).
   *
   * TodoTreeProvider is OUTERMOST here (schedule redesign A-1): the Calendar
   * reads scheduled TodoNodes to render todo=blue chips. Provider order (§6.2)
   * places TodoTree before Calendar, and TodoTree depends on neither WikiTags
   * nor Calendar, so it sits at the very outside. #411 folded the Kanban in as
   * the Todo tab. It needs the same two Providers it had in Materials
   * (TodoTree + WikiTags) and both are already on this branch, so the tab
   * reuses them rather than nesting a second pair — one todo store for the
   * calendar chips, the Todo tray and the board. `persistSelection` moved with
   * the board: it is what re-opens the todo the user was reading after a tab
   * switch (#282).
   */
  schedule: {
    width: "fluid",
    // #1153: no tab band. The section is one surface again — the Todo board
    // that was its second tab is retired and its list lives in the section's
    // own rightSidebar, which is not shell state and needs no band.
    // #1033: was "tabs" — the Calendar body drew a second hamburger of its own,
    // left of the month heading. One hamburger, in the band, like every other
    // section.
    narrowHeader: "tabs+hamburger",
    body: ({ ds, nav }) => (
      <TodoTreeProvider dataService={ds} persistSelection>
        <WikiTagsUnifiedProvider dataService={ds}>
          <CalendarProvider dataService={ds}>
            <RoutineProvider dataService={ds}>
              <ScheduleItemsProvider dataService={ds}>
                <ScheduleScreen
                  dataService={ds}
                  pendingNewTodo={nav.pendingNewTodo}
                  onConsumeNewTodo={nav.consumeNewTodo}
                  pendingTodoTray={nav.pendingTodoTray}
                  onConsumeTodoTray={nav.consumeTodoTray}
                  pendingSelectTodoId={nav.pendingTodoSelect}
                  onConsumePendingSelect={nav.consumeItemNav}
                  pendingSelectEvent={nav.pendingEventSelect}
                  onConsumePendingEvent={nav.consumeItemNav}
                  onNavigateToItem={nav.navigateToItem}
                />
              </ScheduleItemsProvider>
            </RoutineProvider>
          </CalendarProvider>
        </WikiTagsUnifiedProvider>
      </TodoTreeProvider>
    ),
  },
  /*
   * Materials — the document surfaces (Notes / Daily) folded under one section
   * and addressed by an in-section tab. Provider nesting is verbatim from the
   * old flat sections (§6.2); only the addressing changed (section+tab).
   */
  materials: {
    width: "wide",
    // Narrow: the section box owns its height and each tab scrolls inside it
    // (NotesView's main column and DailyView's narrow branch are both written
    // that way — `h-full` roots over an inner `overflow-y-auto`). Under "wide"
    // those roots collapse to auto and the page scroller takes over, which is
    // what parked the Notes "+" at the end of the list (#875).
    narrowWidth: "fluid",
    tabBand: "materials",
    narrowHeader: "tabs+hamburger",
    body: ({ ds, nav, loadingFallback }) => (
      <>
        {nav.materialsTab === "notes" && (
          <WikiTagsUnifiedProvider dataService={ds}>
            <NotesUnifiedProvider dataService={ds}>
              <Suspense fallback={loadingFallback}>
                <NotesView
                  dataService={ds}
                  onNavigateToItem={nav.navigateToItem}
                  pendingSelectNoteId={nav.pendingNoteSelect}
                  onConsumePendingSelect={nav.consumeItemNav}
                />
              </Suspense>
            </NotesUnifiedProvider>
          </WikiTagsUnifiedProvider>
        )}
        {nav.materialsTab === "daily" && (
          <WikiTagsUnifiedProvider dataService={ds}>
            <DailiesUnifiedProvider dataService={ds}>
              <DailyView
                dataService={ds}
                onNavigateToItem={nav.navigateToItem}
                pendingSelectDate={nav.pendingDailySelect}
                onConsumePendingSelect={nav.consumeItemNav}
              />
            </DailiesUnifiedProvider>
          </WikiTagsUnifiedProvider>
        )}
      </>
    ),
  },
  /*
   * Connect (W4; STEP 2 link editing) — node graph + backlink over the UNIFIED
   * item-link model. ConnectScreen mounts its own WikiTagsUnifiedProvider
   * internally. Legacy note_links are NOT used.
   */
  connect: {
    width: "fluid",
    narrowHeader: "hamburger",
    body: ({ ds, loadingFallback }) => (
      <Suspense fallback={loadingFallback}>
        <ConnectScreen dataService={ds} />
      </Suspense>
    ),
  },
  /*
   * Work (W3-B) — Pomodoro timer + TodoSelector + settings/preset editor.
   * TimerProvider is mounted at the shell level; this view reads
   * useTimerContext + fetches the todo list via the injected DataService.
   */
  work: {
    width: "wide",
    narrowHeader: "hamburger",
    body: ({ ds }) => <WorkScreen dataService={ds} />,
  },
  /*
   * Analytics (W4) — recharts dashboards (Overview/Todos/Work/Schedule). Host
   * fetches sessions/todos/schedule/routines via DataService and injects data
   * + t into the pure shared <AnalyticsView>.
   */
  analytics: {
    width: "fluid",
    tabBand: "analytics",
    narrowHeader: "none",
    body: ({ ds, nav, loadingFallback }) => (
      <Suspense fallback={loadingFallback}>
        <AnalyticsScreen
          dataService={ds}
          tab={nav.analyticsTab}
          onTabChange={nav.setAnalyticsTab}
        />
      </Suspense>
    ),
  },
  /*
   * Settings (W1) — reads useThemeContext + useShortcutConfig (the
   * ShortcutConfigProvider wrapping the whole shell) and injects values + t()
   * copy into the shared pure primitives. No extra Provider needed.
   */
  settings: {
    width: "wide",
    narrowHeader: "hamburger",
    body: () => <SettingsScreen />,
  },
  /*
   * Trash (W2). Crosses all five soft-delete categories, so it uses no
   * per-section Provider — TrashScreen calls the injected DataService directly
   * and feeds the pure shared TrashView (§6.4).
   */
  trash: {
    width: "wide",
    narrowHeader: "none",
    body: ({ ds }) => <TrashScreen dataService={ds} />,
  },
};
