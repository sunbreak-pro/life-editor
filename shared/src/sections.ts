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

/**
 * Header width-tab mode (Layout Standard v2 §5): "wide" = full width,
 * "narrow" = centered reading column (--container-lumen-reading).
 */
export type PageWidthMode = "wide" | "narrow";

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
   * Initial value of the section's header width tab (Layout Standard v2 §5)
   * — the look before the user flips it (the choice is then persisted per
   * section, usePageWidthPrefs). Initial values mirror each section's pre-v2
   * look; the v2 plan's §5 table is the decision record, this field is the
   * runtime SSOT.
   *
   * The former `rightSidebar` gate is retired (v2 §3): every section now
   * shows the detail-panel toggle. Sections without portal content
   * (Analytics / Trash) open the shared placeholder empty state until their
   * refine pass defines panel content.
   */
  readonly defaultPageWidth: PageWidthMode;
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
    // Full-bleed calendar canvas — pre-v2 look is full width.
    defaultPageWidth: "wide",
  },
  {
    id: "materials",
    group: "main",
    icon: Library,
    labelKey: "section.materials",
    mobileOrder: 1,
    // Section-level default per the v2 §5 table. The web host currently
    // scopes the width tab PER MATERIALS TAB (tasks=wide, others=narrow —
    // the pre-v2 look) while the section-vs-tab decision is pending (v2 §5
    // 未定事項; being coordinated with materials-refine via outbox).
    defaultPageWidth: "wide",
  },
  {
    id: "connect",
    group: "main",
    icon: Network,
    labelKey: "section.connect",
    mobileOrder: 4,
    // Full-bleed node-graph canvas.
    defaultPageWidth: "wide",
  },
  {
    id: "work",
    group: "main",
    icon: Timer,
    labelKey: "section.work",
    mobileOrder: 2,
    // Centered timer column (reading width).
    defaultPageWidth: "narrow",
  },
  {
    id: "analytics",
    group: "main",
    icon: BarChart3,
    labelKey: "section.analytics",
    mobileOrder: 3,
    // Wide: the shared AnalyticsView keeps drawing its own centered data
    // column (--container-lumen-data) inside the full-width body — the v1
    // implementation judgment carried forward (v2 §5 table).
    defaultPageWidth: "wide",
  },
  {
    id: "settings",
    group: "utility",
    icon: Settings,
    labelKey: "section.settings",
    mobileOrder: 5,
    // Centered settings column (reading width).
    defaultPageWidth: "narrow",
  },
  {
    id: "trash",
    group: "utility",
    icon: Trash2,
    labelKey: "section.trash",
    mobileOrder: 6,
    // Centered restore list (reading width).
    defaultPageWidth: "narrow",
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
 * Header width-tab initial value by section id (Layout Standard v2 §5). The
 * host falls back to this when the user has not flipped the section's width
 * tab yet (usePageWidthPrefs holds the persisted choices).
 */
export const SECTION_DEFAULT_PAGE_WIDTH: Readonly<
  Record<SectionId, PageWidthMode>
> = Object.fromEntries(
  SECTIONS.map((s) => [s.id, s.defaultPageWidth]),
) as Record<SectionId, PageWidthMode>;
