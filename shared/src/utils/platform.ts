/*
 * Platform detection (W1). Ported from the FROZEN
 * `frontend/src/utils/platform.ts` (web-lean: only what shortcut display
 * needs). Guards `navigator` so it is safe under SSR / non-browser test runs.
 */
const ua =
  typeof navigator !== "undefined" && navigator.userAgent
    ? navigator.userAgent
    : "";

export const isMac = /Mac|iPhone|iPad/.test(ua);
