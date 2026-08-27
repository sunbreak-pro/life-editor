/*
 * The one layout breakpoint the app has: wide (desktop / tablet landscape)
 * vs narrow (phone). Every `useMediaQuery(...)` wide↔narrow switch and the
 * `wideQuery` prop defaults read from here.
 *
 * The literal `"(min-width: 768px)"` was written out at 12 call sites across
 * `shared/` and `web/` (#670 C3 PR 3). Nothing forced them to agree, so
 * moving the breakpoint meant finding all 12 by grep and getting every one
 * right — and a missed site shows up as one screen switching layouts at a
 * different width than the rest, which is easy to see and hard to trace.
 *
 * Kept in `constants/` rather than in a CSS token because it is consumed by
 * `window.matchMedia`, not by the stylesheet. If a CSS-side breakpoint is
 * ever added, the two must be changed together.
 *
 * That happened in #1134: the mobile text-field font floor is a CSS
 * `@media (max-width: 767px)` block in `styles/tokens.css`, repeated for the
 * note editor in `web/src/index.css`. A media query cannot read a custom
 * property, so those two literals cannot be replaced by this constant — they
 * are pinned to it by `web/tests/fieldFontFloorLockstep.test.ts` instead.
 * Moving this number means moving those two blocks in the same change.
 */

/** Wide-layout threshold in px. */
export const WIDE_BREAKPOINT_PX = 768;

/** `matchMedia` query for the wide layout. */
export const WIDE_QUERY = `(min-width: ${WIDE_BREAKPOINT_PX}px)`;
