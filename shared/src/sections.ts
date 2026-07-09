/*
 * Section registry — the single source of truth (SSOT) for the app's
 * top-level sections (target IA, 2026-07-05). Everything the hosts need to
 * render navigation is derived from ONE ordered list here:
 *
 *   - the `SectionId` union (types/taskTree.ts re-exports it)
 *   - the desktop sidebar order (main vs. utility groups)
 *   - the mobile bottom-bar order (fixed 4 + More overflow)
 *   - each section's icon and its `section.*` i18n label key
 *
 * The web host (web/src/MainScreen.tsx) imports the derived views below
 * instead of hand-maintaining five parallel literal lists. Adding or
 * retiring a section is a one-line edit here — the union, both nav orders,
 * the icon map, and the command palette all follow automatically.
 *
 * Pure data (DataService-free, no useTranslation): the icon is a lucide
 * component and the label is an i18n KEY — hosts resolve copy via props
 * (CLAUDE.md §6.4). The old REPL section is retired (§8) and never appears here.
 */
import type { LucideIcon } from "lucide-react";
import {
  Clock,
  Library,
  Network,
  Timer,
  BarChart3,
  Settings,
  Trash2,
} from "lucide-react";

/** Sidebar grouping: mainline nav rows vs. the utility (settings/trash) set. */
export type SectionGroup = "main" | "utility";

export interface SectionDef {
  /** Stable section id (widened to string here; the literal union is
   *  derived from the const list below as `SectionId`). */
  readonly id: string;
  readonly group: SectionGroup;
  /** lucide icon component — rendered by the host (`<Icon size={18} />`). */
  readonly icon: LucideIcon;
  /** i18n key (`section.*`); the host resolves it via t() (§6.4). */
  readonly labelKey: string;
  /** Mobile bottom-bar priority (ascending). Fixed 4 = lowest, rest → More. */
  readonly mobileOrder: number;
  /**
   * Whether this section owns detail-panel (rightSidebar) content. The host
   * only renders the RightSidebarToggle for a section when this is true — a
   * section that supplies no `RightSidebarPortal` content (Analytics / Trash)
   * would otherwise open an empty panel. Sections marked true supply content
   * either through the shared push-in panel (Connect / Work / Settings) or
   * their own in-section chrome (Materials tabs / Schedule). SSOT for the
   * "toggle shown ⟺ content supplied" invariant (plan 2026-07-08 Step 3).
   */
  readonly rightSidebar: boolean;
}

/*
 * Canonical order = desktop sidebar order (main group first, then utility).
 * `as const satisfies` keeps the literal `id`s (so `SectionId` is the exact
 * union) while validating each row against SectionDef.
 */
export const SECTIONS = [
  {
    id: "schedule",
    group: "main",
    icon: Clock,
    labelKey: "section.schedule",
    mobileOrder: 0,
    // Schedule owns its detail toggle inside ScheduleScreen (CalendarTab
    // supplies the RightSidebarPortal); the host skips the generic toolbar.
    rightSidebar: true,
  },
  {
    id: "materials",
    group: "main",
    icon: Library,
    labelKey: "section.materials",
    mobileOrder: 1,
    // Materials carries its toggle in the tab switcher; each surface
    // (Kanban / Notes / Daily / Tags) supplies its own RightSidebarPortal.
    rightSidebar: true,
  },
  {
    id: "connect",
    group: "main",
    icon: Network,
    labelKey: "section.connect",
    mobileOrder: 4,
    // ConnectGraphView portals its Graph settings / Backlinks panel.
    rightSidebar: true,
  },
  {
    id: "work",
    group: "main",
    icon: Timer,
    labelKey: "section.work",
    mobileOrder: 2,
    // WorkScreen portals the Pomodoro settings / task-selector panel.
    rightSidebar: true,
  },
  {
    id: "analytics",
    group: "main",
    icon: BarChart3,
    labelKey: "section.analytics",
    mobileOrder: 3,
    // Dashboard with no per-item detail context — no panel content, so the
    // host hides the toggle (would otherwise open an empty panel).
    rightSidebar: false,
  },
  {
    id: "settings",
    group: "utility",
    icon: Settings,
    labelKey: "section.settings",
    mobileOrder: 5,
    // SettingsScreen portals the SettingsDetailPanel.
    rightSidebar: true,
  },
  {
    id: "trash",
    group: "utility",
    icon: Trash2,
    labelKey: "section.trash",
    mobileOrder: 6,
    // Cross-category restore list with no selection detail — no panel
    // content, so the host hides the toggle.
    rightSidebar: false,
  },
] as const satisfies readonly SectionDef[];

/** The section id union, derived from the registry (SSOT). */
export type SectionId = (typeof SECTIONS)[number]["id"];

/** Mainline sidebar sections (in canonical order). */
export const MAIN_SECTIONS: readonly SectionDef[] = SECTIONS.filter(
  (s) => s.group === "main",
);

/** Utility sidebar sections (settings / trash, in canonical order). */
export const UTILITY_SECTIONS: readonly SectionDef[] = SECTIONS.filter(
  (s) => s.group === "utility",
);

/** All sections in mobile bottom-bar order (fixed 4 first, then More). */
export const MOBILE_SECTIONS: readonly SectionDef[] = [...SECTIONS].sort(
  (a, b) => a.mobileOrder - b.mobileOrder,
);

/** All section ids in canonical order (command palette / iteration). */
export const SECTION_IDS: readonly SectionId[] = SECTIONS.map((s) => s.id);

/** Icon lookup by section id. */
export const SECTION_ICONS: Readonly<Record<SectionId, LucideIcon>> =
  Object.fromEntries(SECTIONS.map((s) => [s.id, s.icon])) as Record<
    SectionId,
    LucideIcon
  >;

/**
 * Detail-panel (rightSidebar) ownership by section id. The host gates the
 * RightSidebarToggle on this so a section without portal content never opens
 * an empty panel (plan 2026-07-08 Step 3 — "toggle shown ⟺ content supplied").
 */
export const SECTION_HAS_RIGHT_SIDEBAR: Readonly<Record<SectionId, boolean>> =
  Object.fromEntries(SECTIONS.map((s) => [s.id, s.rightSidebar])) as Record<
    SectionId,
    boolean
  >;
