/*
 * Tutorial tour sub-barrel (#1122). The root components barrel re-exports
 * exactly these names; everything else in this folder stays internal, the same
 * arrangement `./tagEdit` uses.
 */
export {
  resolveTourAnchor,
  tourAnchor,
  TOUR_ANCHOR_ATTRIBUTE,
  TOUR_ANCHOR_TIMEOUT_MS,
} from "./anchor";
export { TOUR_ACTIONS, TOUR_ANCHORS } from "./anchors";
export {
  TOUR_STEPS,
  TOUR_STEP_IDS,
  TOUR_SECTION_IDS,
  tourSectionIds,
} from "./registry";
export { TOUR_SECTION_SUMMARY_KEYS } from "./launcher";
export {
  TourLauncherModal,
  type TourLauncherModalProps,
  type TourLauncherLabels,
  type TourLauncherPage,
  type TourLauncherSection,
} from "./TourLauncherModal";
export { TourOverlay, type TourOverlayProps } from "./TourOverlay";
export type { TourLabels } from "./labels";
export {
  EMPTY_TOUR_PROGRESS,
  type TourAdvance,
  type TourProgress,
  type TourStep,
} from "./types";
