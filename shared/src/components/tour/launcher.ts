import type { TranslationKey } from "../../i18n/resources";
import type { SectionId } from "../../sections";

/*
 * One-line "what this section is for" copy, keyed by section (#1194).
 *
 * The launcher's first page is a map of the app, so it needs a sentence per
 * section that the section registry does not carry. It lives HERE rather than
 * in `sections.ts` because it is the tutorial's own framing — the same section
 * is described differently in a nav label, an empty state and a welcome
 * screen — and because #1194's Scope stops at the tour folder.
 *
 * EXHAUSTIVE over `SectionId` on purpose (`satisfies Record<SectionId, …>`):
 * a section added to the registry tomorrow fails HERE, at compile time, rather
 * than reaching the welcome page as a row with a blank line under it. Values
 * are typed `TranslationKey` for the same reason `SectionDef.labelKey` is —
 * copy that was never translated fails where the map is DEFINED (sections.ts:45).
 */
export const TOUR_SECTION_SUMMARY_KEYS = {
  briefing: "tour.launcher.summary.briefing",
  schedule: "tour.launcher.summary.schedule",
  materials: "tour.launcher.summary.materials",
  connect: "tour.launcher.summary.connect",
  work: "tour.launcher.summary.work",
  analytics: "tour.launcher.summary.analytics",
  settings: "tour.launcher.summary.settings",
  trash: "tour.launcher.summary.trash",
} as const satisfies Readonly<Record<SectionId, TranslationKey>>;
