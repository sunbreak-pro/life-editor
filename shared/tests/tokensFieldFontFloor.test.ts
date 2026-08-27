// @vitest-environment node (#1079 — this suite touches no DOM)
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * #1134 — tapping a text field on iOS must not zoom the viewport.
 *
 * iOS Safari zooms whenever the focused control's font-size resolves under
 * 16px, and it never zooms back out, so one tap leaves the layout scrolled
 * sideways for the rest of the session. The fix is a mobile-scoped floor in
 * tokens.css rather than a sweep of the ~30 sub-16px call sites, because a
 * sweep has to stay correct forever AND still misses the inherited case (an
 * input with no size class of its own picking up its parent's 12.5px through
 * Tailwind preflight's `font: inherit`).
 *
 * jsdom loads no stylesheet and has no layout, so `getComputedStyle(input)`
 * is worthless here (CLAUDE.md §7.1) and the real check is on-device (the
 * Issue's 備考 says so explicitly). What CAN be pinned is the shape of the
 * declaration — and the shape is the entire safety argument. Each assertion
 * below guards a way of writing this rule that still looks right on one phone
 * and breaks something else:
 *
 *   - layered instead of unlayered → loses to every `text-sm` and fixes nothing
 *   - a flat 16px instead of max() → freezes fields against the Settings
 *     font-size slider at steps 6-10
 *   - no escape hatch → flattens the 28px note/daily title to body size
 *   - a wider selector → forces a font-size onto sliders and colour swatches
 */

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(
  join(here, "../src/styles/tokens.css"),
  "utf8",
).replace(/\r\n/g, "\n");

/** Start offset of the mobile floor's `@media` at-rule, or -1. */
const floorMediaIndex = (): number =>
  css.search(/@media\s*\(\s*max-width:\s*767px\s*\)/);

/** The body of that `@media` block, brace-counted (it nests a rule). */
const floorBlock = (): string => {
  const at = floorMediaIndex();
  if (at < 0) return "";
  const open = css.indexOf("{", at);
  let depth = 1;
  let i = open + 1;
  const start = i;
  while (i < css.length && depth > 0) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") depth -= 1;
    i += 1;
  }
  return css.slice(start, i - 1);
};

/** True when `pos` sits inside an `@layer … { }` block. */
const insideLayer = (pos: number): boolean => {
  const layerDepths: number[] = [];
  let depth = 0;
  for (let i = 0; i < pos; i += 1) {
    if (css[i] === "{") {
      // A brace opens a layer block only if `@layer` introduced it.
      const head = css.slice(Math.max(0, i - 40), i);
      depth += 1;
      if (/@layer[^;{}]*$/.test(head)) layerDepths.push(depth);
    } else if (css[i] === "}") {
      if (layerDepths.at(-1) === depth) layerDepths.pop();
      depth -= 1;
    }
  }
  return layerDepths.length > 0;
};

describe("tokens.css — mobile text-field font floor (#1134)", () => {
  it("declares the 16px trigger threshold as a token", () => {
    expect(css).toMatch(/--field-font-size-min:\s*16px\s*;/);
  });

  it("scopes the floor to narrow viewports", () => {
    expect(
      floorMediaIndex(),
      "no @media (max-width: 767px) block",
    ).toBeGreaterThanOrEqual(0);
  });

  it("keeps the rule unlayered so it outranks Tailwind's text-* utilities", () => {
    // The icon/tap floors a few lines above deliberately sit in
    // @layer components so a call site's utility still wins. This one is the
    // opposite case: the `text-sm` / `text-xs` classes ARE the bug, and an
    // unlayered declaration beats every @layer utilities rule regardless of
    // specificity. Move it into a layer and the suite stays green on every
    // other gate while the zoom comes back.
    expect(insideLayer(floorMediaIndex())).toBe(false);
  });

  it("floors rather than assigns, so the Settings font-size still scales up", () => {
    const block = floorBlock();
    expect(block).toMatch(
      /font-size:\s*max\(\s*var\(--field-font-size-min\)\s*,\s*var\(--field-font-size,\s*1em\)\s*\)/,
    );
    // A bare assignment would satisfy "never under 16px" and pin every field
    // AT 16px for the users who raised the setting to 19-25px.
    expect(block).not.toMatch(/font-size:\s*var\(--field-font-size-min\)\s*;/);
    expect(block).not.toMatch(/font-size:\s*16px\s*;/);
  });

  it("covers every control iOS zooms for", () => {
    // Whitespace-stripped: prettier is free to wrap the long :not() chain
    // across lines, and where it breaks is not part of the contract.
    const tight = floorBlock().replace(/\s+/g, "");
    expect(tight).toContain("input:not(");
    expect(tight).toContain(",textarea,");
    expect(tight).toContain(",select,");
    expect(tight).toContain('[contenteditable="true"]');
  });

  it("leaves the non-text input types alone", () => {
    // A range slider or a colour swatch has no text to zoom, and giving them a
    // font-size is meaningless at best.
    const tight = floorBlock().replace(/\s+/g, "");
    for (const type of ["range", "color", "checkbox", "radio", "file"]) {
      expect(tight, `input[type=${type}] not excluded`).toContain(
        `:not([type="${type}"])`,
      );
    }
  });

  it("keeps the floor off desktop", () => {
    // Everything before the media query must stay free of the floor: at wide
    // widths the small field sizes are the intended design and there is no
    // auto-zoom to prevent.
    const at = floorMediaIndex();
    expect(css.slice(0, at)).not.toContain("var(--field-font-size, 1em)");
  });
});
