/*
 * Section registry — the single source of truth (SSOT) for the app's
 * top-level sections (target IA, 2026-07-05). Everything the hosts need to
 * render navigation is derived from ONE ordered list here:
 *
 *   - the `SectionId` union (types/todoTree.ts re-exports it)
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
 * (CLAUDE.md §6.4). Retired sections never appear here: the old REPL (#146)
 * is gone for good.
 *
 * `connect` is back (#1171) and is NOT the section #1152 retired. That one was
 * a force-directed graph of every item at once; this one is a tag hub — pick a
 * topic, read its items. The id is reused because it names the same place in
 * the IA ("the topic-axis entrance"), which is what the sidebar, the mobile
 * bottom bar and the command palette all derive from.
 */
import type { LucideIcon } from "lucide-react";
import type { TranslationKey } from "./i18n/resources";
import {
  Sunrise,
  Clock,
  Library,
  Tags,
  Timer,
  BarChart3,
  Settings,
} from "lucide-react";

/** Sidebar grouping: mainline nav rows vs. the utility set (settings — Trash
 *  moved inside it in #1293). */
export type SectionGroup = "main" | "utility";

export interface SectionDef {
  /** Stable section id (widened to string here; the literal union is
   *  derived from the const list below as `SectionId`). */
  readonly id: string;
  readonly group: SectionGroup;
  /** lucide icon component — rendered by the host (`<Icon size={18} />`). */
  readonly icon: LucideIcon;
  /** i18n key (`section.*`); the host resolves it via t() (§6.4). Typed as
   *  the catalog's key union (#726) so a section whose label was never
   *  translated fails here, not silently on screen. */
  readonly labelKey: TranslationKey;
  /** Mobile bottom-bar priority (ascending). Fixed 4 = lowest, rest → More. */
  readonly mobileOrder: number;
}

/*
 * Content width is no longer a per-section knob. The Layout Standard v2 §5
 * width tab (wide/narrow) was retired 2026-07-11 — sections are unified to
 * wide. The host maps each surface straight to a PageContainer width with no
 * persisted per-section choice: "fluid" for canvas surfaces that own their
 * full-bleed scroll, "full" for gutter-padded documents, and "reading" kept
 * only for the Materials text editors (Notes / Daily) whose line length still
 * wants the narrowest column (see web/src/MainScreen.tsx; the px itself lives
 * in styles/tokens.css).
 *
 * The `rightSidebar` gate is likewise retired (v2 §3): every section shows
 * the detail-panel toggle. A section without portal content (Analytics) opens
 * the shared placeholder empty state until its refine pass defines panel
 * content.
 */

/*
 * Canonical order = desktop sidebar order (main group first, then utility).
 * `as const satisfies` keeps the literal `id`s (so `SectionId` is the exact
 * union) while validating each row against SectionDef.
 */
export const SECTIONS = [
  /*
   * Briefing (Briefing plan Step 1) — the morning-paper home surface and the
   * app's default landing section (DEFAULT_STARTUP_SECTION follows this id).
   * First in both the sidebar and the mobile bottom bar: the whole point of
   * the section is "the first screen you open in the morning".
   */
  {
    id: "briefing",
    group: "main",
    icon: Sunrise,
    labelKey: "section.briefing",
    mobileOrder: 0,
  },
  {
    id: "schedule",
    group: "main",
    icon: Clock,
    labelKey: "section.schedule",
    mobileOrder: 1,
  },
  {
    id: "materials",
    group: "main",
    icon: Library,
    labelKey: "section.materials",
    mobileOrder: 2,
  },
  /*
   * Connect (#1171) — the topic-axis entrance, paired with Schedule's
   * time-axis one. Sits straight after Materials because those three are the
   * ways INTO the records (when / what / about what), and before Work, which
   * is a thing you do rather than a thing you read.
   *
   * `mobileOrder: 5` puts it in the More sheet, not the fixed bottom four.
   * Deliberate: the phone's job is consumption and quick capture (§2), and the
   * four that already hold those slots are the ones a phone opens first. It is
   * also the slot the retired Connect held, so adding this section moves no
   * other row on the bottom bar.
   */
  {
    id: "connect",
    group: "main",
    icon: Tags,
    labelKey: "section.connect",
    mobileOrder: 5,
  },
  {
    id: "work",
    group: "main",
    icon: Timer,
    labelKey: "section.work",
    mobileOrder: 3,
  },
  {
    id: "analytics",
    group: "main",
    icon: BarChart3,
    labelKey: "section.analytics",
    mobileOrder: 4,
  },
  /*
   * Settings is the only utility row left. Trash was the other one until
   * #1293 moved it INSIDE Settings — it is a place you visit to undo
   * something, not a place the app is for, and it was spending a permanent
   * sidebar row (and a mobile More slot) on that. The view itself did not
   * change: web/src/settings/SettingsScreen.tsx renders the same TrashScreen
   * under a category row.
   */
  {
    id: "settings",
    group: "utility",
    icon: Settings,
    labelKey: "section.settings",
    mobileOrder: 6,
  },
] as const satisfies readonly SectionDef[];

/** The section id union, derived from the registry (SSOT). */
export type SectionId = (typeof SECTIONS)[number]["id"];

/** Mainline sidebar sections (in canonical order). */
export const MAIN_SECTIONS: readonly SectionDef[] = SECTIONS.filter(
  (s) => s.group === "main",
);

/** Utility sidebar sections (settings alone since #1293, in canonical order). */
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
