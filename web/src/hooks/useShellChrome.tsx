import { useCallback, useMemo, useState } from "react";
import { CalendarDays, FileText, type LucideIcon } from "lucide-react";
import {
  useTranslation,
  isMac,
  NavTimerStatus,
  SECTIONS,
  MAIN_SECTIONS,
  UTILITY_SECTIONS,
  MOBILE_SECTIONS,
  EMPTY_MATERIALS_COUNTS,
  ANALYTICS_TAB_ORDER,
  TOUR_ANCHORS,
  type AppShellSection,
  type MaterialsCounts,
  type SectionId,
  type SectionDef,
  type Command,
} from "@life-editor/shared";
import type { MaterialsTab } from "./useShellNavigation";

/*
 * Chrome half of the app-shell host (extracted from MainScreen.tsx — hooks
 * split, zero behavior change): everything the shell DISPLAYS as opposed to
 * how it routes — the command-palette entries, the desktop/mobile nav
 * section lists derived from the shared registry (SSOT —
 * shared/src/sections.ts), the per-section tab-band defs, the translated
 * shell labels, and the Materials tab count badges fed by the headless
 * MaterialsCountsBridge. Setters come in from useShellNavigation so a
 * command / tab click routes through the same state the shell switches on.
 */

const MATERIALS_TABS: readonly MaterialsTab[] = ["notes", "daily"];

const MATERIALS_ICON: Record<MaterialsTab, LucideIcon> = {
  notes: FileText,
  daily: CalendarDays,
};

/*
 * In-Schedule tabs (#411). Todos left Materials so that "the place you build
 * today" holds both the calendar and the list that feeds it (Epic #290) — the
 * Todo tray in the Calendar's rightSidebar pulls from the same todos. The
 * union itself lives with the screen that switches on it (ScheduleScreen).
 */

export function useShellChrome({
  setSection,
  setMaterialsTab,
}: {
  // Deliberately narrower than the useState setters the shell passes in:
  // the commands memo lists these in its deps and stays cached only while
  // their identity is stable, so the contract asks for a plain callback —
  // hand it a per-render closure and every render rebuilds the palette list.
  setSection: (id: SectionId) => void;
  setMaterialsTab: (tab: MaterialsTab) => void;
}) {
  const { t } = useTranslation();

  // Materials tab count badges, fed by the headless MaterialsCountsBridge
  // (mounted inside SyncProvider so it can refetch on Realtime changes).
  const [materialsCounts, setMaterialsCounts] = useState<MaterialsCounts>(
    EMPTY_MATERIALS_COUNTS,
  );

  const commands = useMemo<Command[]>(() => {
    const goTo = t("commandPalette.goTo", { defaultValue: "Go to" });
    const sectionCmds = SECTIONS.map<Command>((s) => ({
      id: `section-${s.id}`,
      title: t(s.labelKey, { defaultValue: s.id }),
      category: goTo,
      icon: s.icon,
      action: () => setSection(s.id),
    }));
    const materialsCmds = MATERIALS_TABS.map<Command>((tab) => ({
      id: `materials-${tab}`,
      title: t(`section.${tab}`, { defaultValue: tab }),
      category: goTo,
      icon: MATERIALS_ICON[tab],
      action: () => {
        setSection("materials");
        setMaterialsTab(tab);
      },
    }));
    // #1153: Schedule's two per-tab entries went with the tabs. The bare
    // "Schedule" section command above is the whole of it now — asking for the
    // todo tray specifically is nav:tasks, which raises an intent the section
    // consumes rather than setting shell state.
    return [...sectionCmds, ...materialsCmds];
  }, [t, setSection, setMaterialsTab]);

  // W5 app shell: section lists (icon node + translated label). i18n is
  // resolved here and injected — the shared shell never calls useTranslation
  // (§6.4). Mainline vs utility vs mobile order are three views of the same
  // sections keyed by Section id.
  const toSections = useCallback(
    (defs: readonly SectionDef[]): AppShellSection[] =>
      defs.map((s) => {
        const Icon = s.icon;
        return {
          id: s.id,
          label: t(s.labelKey, { defaultValue: s.id }),
          icon: <Icon size={18} />,
        };
      }),
    [t],
  );
  // The Work row carries the live timer line (#550). The node is CREATED here
  // (outside the Provider tree) but RENDERED inside the sidebar, which sits
  // within TimerProvider — context resolves at the render position, and only
  // the status component re-renders on the 1 s tick, not the shell.
  const navSections = useMemo(
    () =>
      toSections(MAIN_SECTIONS).map((s) =>
        s.id === "work" ? { ...s, sublabel: <NavTimerStatus /> } : s,
      ),
    [toSections],
  );
  const utilitySections = useMemo(
    () => toSections(UTILITY_SECTIONS),
    [toSections],
  );
  const mobileSections = useMemo(
    () => toSections(MOBILE_SECTIONS),
    [toSections],
  );

  // Materials in-section tab defs (Notes / Daily). Each tab shows a live item
  // count badge fed by the MaterialsCountsBridge. A zero count leaves the badge
  // unset so empty surfaces don't render a noisy "0" pill.
  const materialsTabDefs = useMemo(
    () =>
      MATERIALS_TABS.map((id) => {
        const count = materialsCounts[id];
        return {
          id,
          label: t(`section.${id}`, { defaultValue: id }),
          badge: count > 0 ? count : undefined,
        };
      }),
    [t, materialsCounts],
  );

  // Analytics in-section tab defs (Overview / Todos / Work / Schedule). No
  // count badges — these tabs are views, not item lists. Order comes from the
  // shared ANALYTICS_TAB_ORDER (SSOT) so the shell band and AnalyticsView's
  // content never drift.
  const analyticsTabDefs = useMemo(
    () =>
      ANALYTICS_TAB_ORDER.map((id) => ({
        id,
        label: t(`analytics.tabs.${id}`, { defaultValue: id }),
      })),
    [t],
  );

  // Briefing in-section tab defs (朝刊 / 夕刊). One list feeds BOTH controls —
  // the wide SectionHeader band and the narrow in-body segmented control
  // (#318) — so the two can never drift apart.
  const briefingTabDefs = useMemo(
    () => [
      {
        id: "morning",
        label: t("briefing.tabs.morning"),
        // The tour's Briefing step anchors here (#1201). On the tab and not
        // inside the page because the band is drawn from the descriptor: it
        // survives the loading skeleton and the 17:00 default to 夕刊, both of
        // which take the page's own content away. One list feeds both
        // controls, and only one of them is mounted, so this stays a single
        // carrier at either width.
        tourId: TOUR_ANCHORS.briefingMorningTab,
      },
      { id: "evening", label: t("briefing.tabs.evening") },
    ],
    [t],
  );

  const shellLabels = useMemo(
    () => ({
      appName: "Life Editor",
      collapse: t("nav.collapse"),
      expand: t("nav.expand"),
      commandPalette: t("nav.commandPalette"),
      signOut: t("nav.signOut"),
      more: t("nav.more"),
      moreTitle: t("nav.moreTitle"),
      moreClose: t("common.close"),
      shortcutHint: isMac ? "⌘K" : "Ctrl K",
      tagEditor: t("nav.tagEditor"),
      // Narrow-only: names the action group in the bottom bar's More sheet (#472).
      bottomBarActionsTitle: t("nav.quickActions"),
    }),
    [t],
  );

  return {
    setMaterialsCounts,
    commands,
    navSections,
    utilitySections,
    mobileSections,
    materialsTabDefs,
    analyticsTabDefs,
    briefingTabDefs,
    shellLabels,
  };
}
