import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * #1844 — the Light palette's text tiers, measured rather than eyeballed.
 *
 * The audit that opened the issue read three failures off the running app
 * (4.32:1 for a tag count, 4.15:1 for the same count in the sidebar, 4.03:1 on
 * a chip) and all three were the same token: --color-text-tertiary, which the
 * old floor in PRINCIPLES §3.6 allowed to sit at 3:1. That tier carries counts,
 * timestamps and search placeholders — 14.6px text people read, not decoration.
 *
 * jsdom resolves no custom properties, so there is no rendered pixel to sample
 * here (the same constraint tokensNestedTheme.test.ts works around). The ratios
 * are computed from the declarations instead, which is enough: a token is one
 * hex value, and the surfaces it is set on are the other hex values in the same
 * block. What this cannot see is which surface a given element actually sits
 * on, so every surface the tier is used on is checked, worst case included.
 */

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "../src/styles/tokens.css"), "utf8");

/** The `:root, [data-theme="light"]` declarations, and only those. */
const lightBlock = /:root,\s*\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/.exec(
  css,
);
if (!lightBlock) throw new Error("tokens.css has no light block");

const light = new Map<string, string>();
for (const [, name, hex] of lightBlock[1].matchAll(
  /(--color-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g,
)) {
  light.set(name, hex);
}

function value(token: string): string {
  const hex = light.get(token);
  if (!hex) throw new Error(`tokens.css light block has no ${token}`);
  return hex;
}

/** WCAG 2.x relative luminance of an #rrggbb colour. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((at) => {
    const srgb = parseInt(hex.slice(at, at + 2), 16) / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return (
    0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  );
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/*
 * Every Light surface a text token is set on. surface-sunken is the darkest of
 * them and is where the sidebar's search placeholder lives, so it decides the
 * floor; success-subtle is the darkest wash any text is written on.
 */
const SURFACES = [
  "--color-bg-primary",
  "--color-bg-secondary",
  "--color-bg-subsidebar",
  "--color-hover",
  "--color-surface-sunken",
  "--color-success-subtle",
] as const;

describe("Light theme text contrast (#1844)", () => {
  it.each(SURFACES)("clears AA for tertiary text on %s", (surface) => {
    expect(ratio(value("--color-text-tertiary"), value(surface))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(SURFACES)("clears AA for secondary text on %s", (surface) => {
    expect(ratio(value("--color-text-secondary"), value(surface))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps body copy at AAA on the page background", () => {
    expect(
      ratio(value("--color-text-primary"), value("--color-bg-primary")),
    ).toBeGreaterThanOrEqual(7);
  });

  it("keeps the three tiers distinguishable from one another", () => {
    // Darkening tertiary closes the gap to secondary. This is the floor below
    // which the two tiers stop reading as two (see the issue's PR discussion):
    // a visible step, not the 1.73 the palette shipped with.
    const primary = luminance(value("--color-text-primary"));
    const secondary = luminance(value("--color-text-secondary"));
    const tertiary = luminance(value("--color-text-tertiary"));
    expect(secondary).toBeGreaterThan(primary);
    expect(tertiary).toBeGreaterThan(secondary);
  });

  it("reproduces the three ratios the audit measured", () => {
    // The issue's own numbers, so a future change that reverts the token is
    // caught by the thing that found it rather than by another audit.
    expect(
      ratio(value("--color-text-tertiary"), value("--color-bg-primary")),
    ).toBeCloseTo(5.34, 1);
    expect(
      ratio(value("--color-text-tertiary"), value("--color-bg-subsidebar")),
    ).toBeCloseTo(5.12, 1);
    expect(
      ratio(value("--color-text-tertiary"), value("--color-bg-secondary")),
    ).toBeCloseTo(4.94, 1);
  });
});
