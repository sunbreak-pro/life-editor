/*
 * Shared Tailwind class-string tokens (C5 dedup). These strings must stay
 * inside a Tailwind-scanned root (web/src/index.css declares
 * `@source ../../shared/src`), otherwise the utilities they name would not
 * be generated.
 */

/** Focus-visible ring with bg offset — the standard interactive affordance. */
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent focus-visible:ring-offset-2 focus-visible:ring-offset-lumen-bg";

/** Offset-less ring for tight inline controls. */
export const FOCUS_RING_TIGHT =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";

/** Standard form-field shell (schedule editors). */
export const FIELD =
  "w-full rounded-lumen-md border border-lumen-border bg-lumen-bg px-2.5 py-2 text-sm text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";

/** Caption label above a FIELD input. */
export const FIELD_LABEL = "text-xs text-lumen-text-secondary";

/**
 * Minimum hit area for a small control (2026-08-02).
 *
 * styles/tokens.css already floors icon-ONLY buttons via `:has()`, so reach for
 * this only where that selector cannot: a control that pairs a glyph with a
 * label, or one that is not a <button>/<a>. Applying it on top of the CSS floor
 * is harmless — same custom property, same result.
 *
 * The floor is rem, so it tracks the Settings font-size step (see the token's
 * note in tokens.css).
 */
export const TAP_TARGET =
  "inline-flex items-center justify-center min-h-lumen-tap-min min-w-lumen-tap-min";
