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

/**
 * Focus affordance for accent-FILLED controls (primary buttons, the FAB).
 *
 * FOCUS_RING is wrong on these in two ways, which together read as white lines
 * running inside the Save button (#880):
 *
 * 1. Its ring color IS the control's own fill. The ring lands outside the
 *    button and merges with it, so the button looks bigger than it is and the
 *    offset gap looks like a line carved inside it rather than a gap around it.
 * 2. It paints that gap `lumen-bg` — the page background — but these controls
 *    sit on `lumen-bg-secondary` (settings blocks) or `lumen-bg-subsidebar`
 *    (the mobile drawer). A hardcoded gap color can only ever match one
 *    surface; everywhere else it shows up as a stray lighter band.
 *
 * `outline` fixes both. Its offset gap is genuinely transparent, so it shows
 * whatever surface is actually behind the control, and the outline color
 * contrasts with the fill instead of repeating it.
 */
export const FOCUS_RING_ON_ACCENT =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lumen-text";

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

/**
 * Invisible hit-area extension up to the 44px mobile floor (#1039).
 *
 * TAP_TARGET floors the control's own BOX, which is the right answer wherever
 * the box is free to grow. In a dense row it is the wrong one: the mobile tab
 * band was shrunk precisely so it would stop eating the page, and flooring the
 * painted box back to 44px would undo the change it was asked for. This leaves
 * the box alone and hangs a transparent `::after` over it instead, centred
 * vertically at the full 44px — so the band reads smaller and taps larger.
 *
 * `inset-x-0` holds the extension to the control's OWN width, so a row of
 * segments never reaches over its neighbours; it only claims the empty space
 * directly above and below the row. That is what makes it safe in the tab band
 * (the header's own padding above and the page gutter below are each wider
 * than the ~6px it overhangs) and unsafe on a control that sits flush against
 * something tappable — check the surroundings before reusing it.
 *
 * BottomSheet's close button solves the same problem the other way (a 44px box
 * pulled back with negative margins). Use that when the control is alone in
 * its row; use this when several sit side by side and their heights are what
 * set the row's height.
 */
export const TAP_TARGET_TALL =
  "relative after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-['']";

/**
 * Disabled treatment for accent-FILLED buttons (#1474).
 *
 * `disabled:opacity-50` was the wrong lever. Opacity only composites the fill
 * against whatever is behind it — it keeps the HUE, and the hue is the entire
 * signal a user reads as "this is the primary action". In dark theme it is
 * worst: the accent is a pale indigo, so 50% of it over the card lands close
 * enough to the enabled fill to be indistinguishable. `cursor: not-allowed`
 * was the only honest cue, and it is invisible until the pointer is already
 * on the control.
 *
 * Changing the hue instead of the alpha is what "not pressable" actually looks
 * like: the fill drops to the sunken surface and the label to the tertiary
 * text tier. Measured against the tokens (light / dark):
 *   - label on the new fill      3.72:1 / 4.90:1  (legible)
 *   - new fill against a card    1.07:1 / 1.21:1  (nearly invisible on its own)
 *   - the ring against a card    1.46:1 / 1.85:1
 * That middle row is why the ring is here rather than being decoration: the
 * sunken surface is a recess, so without it the button's BOX disappears into
 * the card and the control stops looking like a control at all. It is a ring
 * (a box-shadow) and not a border so nothing reflows on the state change.
 *
 * Both `disabled:hover:` entries are load-bearing, not belt-and-braces.
 * `:hover` still matches a disabled button — that is exactly why
 * `disabled:cursor-not-allowed` works — and `.hover\:x:hover` and
 * `.disabled\:y:disabled` are both specificity (0,2,0), a tie broken by source
 * order. Without the (0,3,0) overrides, hovering a dead button repaints it
 * accent again.
 */
export const DISABLED_FILLED_BTN =
  "disabled:cursor-not-allowed disabled:bg-lumen-surface-sunken disabled:text-lumen-text-tertiary disabled:ring-1 disabled:ring-inset disabled:ring-lumen-border-strong disabled:hover:bg-lumen-surface-sunken disabled:hover:opacity-100";
